alter table public.payments add column paid_at timestamptz;

create function retratus_private.event_suggestion(hours numeric) returns numeric
language sql stable security definer set search_path = ''
as $$
  -- Arredonda para centavos: 4h20 com hora adicional não deve virar dízima.
  select round(case when r.hours = $1 then r.amount
              else r.amount + ($1 - r.hours) * (
                select s.extra_hour_amount from public.pay_settings s where s.id
              )
         end, 2)
  from public.event_pay_rates r
  where r.hours = $1
     or ($1 > r.hours and r.hours = (select max(top_rate.hours) from public.event_pay_rates top_rate))
  order by r.hours desc
  limit 1;
$$;

create function retratus_private.refresh_event_payments(
  p_day_id uuid default null, p_selection_id uuid default null
) returns void
language sql security definer set search_path = ''
as $$
  with suggestions as (
    select s.id, retratus_private.event_suggestion(extract(epoch from (d.ends_at - d.starts_at)) / 3600) as amount
    from public.selections s
    join public.jobs j on j.id = s.job_id
    join public.selection_days sd on sd.selection_id = s.id
    join public.job_days d on d.id = sd.job_day_id and d.job_id = j.id
    where j.type = 'evento' and j.status <> 'cancelado'
      and (p_day_id is null or d.id = p_day_id)
      and (p_selection_id is null or s.id = p_selection_id)
  ),
  removed as (
    delete from public.payments pay using suggestions sug
    where pay.selection_id = sug.id and sug.amount is null
      and pay.source = 'tabela' and pay.paid_at is null
  )
  insert into public.payments as pay (selection_id, amount, source)
  select sug.id, sug.amount, 'tabela' from suggestions sug where sug.amount is not null
  on conflict (selection_id) do update set amount = excluded.amount, updated_by = auth.uid()
    where pay.source = 'tabela' and pay.paid_at is null and pay.amount is distinct from excluded.amount;
$$;

create or replace function retratus_private.suggest_event_payment() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform retratus_private.refresh_event_payments(new.job_day_id, new.selection_id);
  return null;
end;
$$;

create function retratus_private.refresh_event_payments_trigger() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'job_days' then
    perform retratus_private.refresh_event_payments(new.id);
  else
    perform retratus_private.refresh_event_payments();
  end if;
  return null;
end;
$$;

-- Rate edits and schedule edits share the same lock before computing suggestions.
create trigger lock_event_pay_rates before insert or update or delete or truncate on public.event_pay_rates
for each statement execute function retratus_private.lock_schedule();
create trigger lock_pay_settings before insert or update or delete or truncate on public.pay_settings
for each statement execute function retratus_private.lock_schedule();
create trigger refresh_event_pay_rates after insert or update or delete or truncate on public.event_pay_rates
for each statement execute function retratus_private.refresh_event_payments_trigger();
create trigger refresh_pay_settings after insert or update or delete or truncate on public.pay_settings
for each statement execute function retratus_private.refresh_event_payments_trigger();
create trigger refresh_event_day_payments after update of starts_at, ends_at on public.job_days
for each row when ((old.starts_at, old.ends_at) is distinct from (new.starts_at, new.ends_at))
execute function retratus_private.refresh_event_payments_trigger();

select retratus_private.refresh_event_payments();

drop function public.promoter_job_counts(timestamptz, timestamptz);
create function public.promoter_job_counts(p_from timestamptz, p_to timestamptz)
returns table (
  promoter_id uuid, full_name text, eventos bigint, dias_acao bigint,
  valor_total numeric, valor_pago numeric, sem_valor bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  caller_role public.user_role := public.current_role();
begin
  if not coalesce(caller_role in ('owner', 'manager'), false) then
    raise insufficient_privilege;
  end if;

  return query
  with assignments as (
    select s.promoter_id, s.id as selection_id, j.id as job_id, j.type, d.id as day_id, d.starts_at
    from public.selections s
    join public.jobs j on j.id = s.job_id
    join public.selection_days sd on sd.selection_id = s.id
    join public.job_days d on d.id = sd.job_day_id
    where j.status <> 'cancelado'
  ),
  counts as (
    select a.promoter_id,
           count(distinct a.job_id) filter (where a.type = 'evento') as events,
           count(distinct a.day_id) filter (where a.type = 'acao') as action_days
    from assignments a
    where a.starts_at >= p_from and a.starts_at < p_to
    group by a.promoter_id
  ),
  first_days as (
    select a.promoter_id, a.selection_id, min(a.starts_at) as first_start
    from assignments a
    where caller_role = 'owner'
    group by a.promoter_id, a.selection_id
  ),
  amounts as (
    select f.promoter_id, sum(pay.amount) as total,
      sum(pay.amount) filter (where pay.paid_at is not null) as paid,
      count(*) filter (where pay.selection_id is null) as missing
    from first_days f
    left join public.payments pay on pay.selection_id = f.selection_id
    where f.first_start >= p_from and f.first_start < p_to
    group by f.promoter_id
  )
  select p.id, p.full_name, coalesce(c.events, 0), coalesce(c.action_days, 0),
    case when caller_role = 'owner' then coalesce(a.total, 0) end,
    case when caller_role = 'owner' then coalesce(a.paid, 0) end,
    case when caller_role = 'owner' then coalesce(a.missing, 0) end
  from public.profiles p
  left join counts c on c.promoter_id = p.id
  left join amounts a on a.promoter_id = p.id
  where p.role = 'promoter' and (p.approved or c.promoter_id is not null)
  order by p.full_name, p.id;
end;
$$;

create function public.payments_overview(p_from timestamptz, p_to timestamptz)
returns table (
  selection_id uuid, job_id uuid, title text, type public.job_type, promoter_id uuid,
  full_name text, equipment text, day_count bigint, hours numeric, first_start timestamptz,
  amount numeric, source public.pay_source, suggested numeric, paid_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.current_role() is distinct from 'owner' then
    raise insufficient_privilege;
  end if;

  return query
  with selection_dates as (
    select sd.selection_id, count(*) as day_count,
      extract(epoch from sum(d.ends_at - d.starts_at)) / 3600 as hours,
      min(d.starts_at) as first_start
    from public.selection_days sd
    join public.job_days d on d.id = sd.job_day_id
    group by sd.selection_id
    having min(d.starts_at) >= p_from and min(d.starts_at) < p_to
  )
  select s.id, j.id, j.title, j.type, s.promoter_id, p.full_name, s.equipment,
    d.day_count, d.hours, d.first_start, pay.amount, pay.source,
    case when j.type = 'evento' then retratus_private.event_suggestion(d.hours) end,
    pay.paid_at
  from selection_dates d
  join public.selections s on s.id = d.selection_id
  join public.jobs j on j.id = s.job_id
  join public.profiles p on p.id = s.promoter_id
  left join public.payments pay on pay.selection_id = s.id
  where j.status <> 'cancelado'
  order by d.first_start, p.full_name, s.id;
end;
$$;

create function public.set_payment(p_selection_id uuid, p_amount numeric) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  payment_paid_at timestamptz;
begin
  if public.current_role() is distinct from 'owner' then
    raise insufficient_privilege;
  end if;

  update retratus_private.schedule_lock set id = true where id;

  if p_amount < 0 then
    raise check_violation using message = 'O valor do pagamento deve ser positivo ou zero.';
  end if;

  if not exists (
    select 1 from public.selections s join public.jobs j on j.id = s.job_id
    where s.id = p_selection_id and j.status <> 'cancelado'
  ) then
    raise check_violation using message = 'Informe uma seleção de trabalho não cancelado.';
  end if;

  select pay.paid_at into payment_paid_at
  from public.payments pay where pay.selection_id = p_selection_id for update;
  if payment_paid_at is not null then
    raise check_violation using message = 'Desmarque o pagamento antes de alterar o valor.';
  end if;

  if p_amount is null then
    delete from public.payments pay where pay.selection_id = p_selection_id and pay.source = 'manual';
    perform retratus_private.refresh_event_payments(null, p_selection_id);
  else
    insert into public.payments as pay (selection_id, amount, source)
    values (p_selection_id, p_amount, 'manual')
    on conflict (selection_id) do update set amount = excluded.amount,
      source = excluded.source, updated_by = auth.uid()
    where pay.paid_at is null;
    if not found then
      raise check_violation using message = 'Desmarque o pagamento antes de alterar o valor.';
    end if;
  end if;
end;
$$;

create function public.set_paid(p_selection_ids uuid[], p_paid boolean) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  changed integer;
begin
  if public.current_role() is distinct from 'owner' then
    raise insufficient_privilege;
  end if;

  update retratus_private.schedule_lock set id = true where id;

  if p_paid is null then
    raise check_violation using message = 'Informe o estado do pagamento.';
  end if;

  perform 1 from public.payments pay where pay.selection_id = any(p_selection_ids) for update;

  if exists (
    select 1 from unnest(p_selection_ids) ids(id)
    where not exists (select 1 from public.payments pay where pay.selection_id = ids.id)
  ) then
    raise check_violation using message = 'Toda seleção precisa ter um valor.';
  end if;

  update public.payments pay
  set paid_at = case when p_paid then now() end, updated_by = auth.uid()
  where pay.selection_id = any(p_selection_ids) and (pay.paid_at is not null) <> p_paid;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function retratus_private.event_suggestion(numeric),
  retratus_private.refresh_event_payments(uuid, uuid), retratus_private.refresh_event_payments_trigger(),
  retratus_private.suggest_event_payment()
from public, anon, authenticated, service_role;

revoke execute on function public.promoter_job_counts(timestamptz, timestamptz),
  public.payments_overview(timestamptz, timestamptz), public.set_payment(uuid, numeric),
  public.set_paid(uuid[], boolean)
from public, anon, service_role;
grant execute on function public.promoter_job_counts(timestamptz, timestamptz),
  public.payments_overview(timestamptz, timestamptz), public.set_payment(uuid, numeric),
  public.set_paid(uuid[], boolean)
to authenticated;
