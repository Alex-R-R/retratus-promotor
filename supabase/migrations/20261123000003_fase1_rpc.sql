create function public.dashboard_counts(p_from timestamptz, p_to timestamptz)
returns table (
  aguardando_briefing bigint, briefing_fechado bigint, vagas_abertas bigint, equipe_completa bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not coalesce(public.current_role() in ('owner', 'manager'), false) then
    raise insufficient_privilege;
  end if;

  return query
  with period_jobs as (
    select j.id, j.briefing, j.status
    from public.jobs j
    where j.status <> 'cancelado' and exists (
      select 1 from public.job_days d
      where d.job_id = j.id and d.starts_at >= p_from and d.starts_at < p_to
    )
  ),
  staffing as (
    select j.briefing, j.status,
      exists (select 1 from public.job_slots slot where slot.job_id = j.id)
      and not exists (
        select 1
        from public.job_days d
        join public.job_slots slot on slot.job_id = d.job_id
        where d.job_id = j.id and slot.capacity > (
          select count(*) from public.selection_days sd
          join public.selections s on s.id = sd.selection_id
          where sd.job_day_id = d.id and s.equipment = slot.equipment
        )
      ) as is_full
    from period_jobs j
  )
  select count(*) filter (where briefing = 'aguardando'),
         count(*) filter (where briefing = 'fechado'),
         count(*) filter (where status = 'publicado' and not is_full),
         count(*) filter (where status = 'publicado' and is_full)
  from staffing;
end;
$$;

create function public.promoter_job_counts(p_from timestamptz, p_to timestamptz)
returns table (promoter_id uuid, full_name text, eventos bigint, dias_acao bigint, valor_total numeric)
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
    select s.promoter_id, s.id as selection_id, j.id as job_id, j.type, d.id as day_id
    from public.selections s
    join public.jobs j on j.id = s.job_id
    join public.selection_days sd on sd.selection_id = s.id
    join public.job_days d on d.id = sd.job_day_id
    where j.status <> 'cancelado' and d.starts_at >= p_from and d.starts_at < p_to
  ),
  counts as (
    select a.promoter_id,
           count(distinct a.job_id) filter (where a.type = 'evento') as events,
           count(distinct a.day_id) filter (where a.type = 'acao') as action_days
    from assignments a
    group by a.promoter_id
  )
  select p.id, p.full_name, coalesce(c.events, 0), coalesce(c.action_days, 0),
    case when caller_role = 'owner' then coalesce((
      select sum(pay.amount)
      from public.payments pay
      where pay.selection_id in (
        select a.selection_id from assignments a where a.promoter_id = p.id
      )
    ), 0) end
  from public.profiles p
  left join counts c on c.promoter_id = p.id
  where p.role = 'promoter'
  order by p.full_name, p.id;
end;
$$;

create function public.agenda(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, job_id uuid, title text, type public.job_type, status public.job_status,
  location text, city text, starts_at timestamptz, ends_at timestamptz, promoters jsonb
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  caller_role public.user_role := public.current_role();
begin
  if caller_role is null then
    raise insufficient_privilege;
  end if;

  return query
  select d.id, j.id, j.title, j.type, j.status, j.location, j.city, d.starts_at, d.ends_at,
         coalesce(assigned.promoters, '[]'::jsonb)
  from public.job_days d
  join public.jobs j on j.id = d.job_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'promoter_id', p.id, 'full_name', p.full_name, 'equipment', s.equipment
    ) order by p.full_name, s.id) as promoters
    from public.selection_days sd
    join public.selections s on s.id = sd.selection_id
    join public.profiles p on p.id = s.promoter_id
    where sd.job_day_id = d.id and (caller_role <> 'promoter' or p.id = auth.uid())
  ) assigned on true
  where d.starts_at < p_to and d.ends_at > p_from
    and (caller_role <> 'promoter' or assigned.promoters is not null)
  order by d.starts_at, d.id;
end;
$$;

create function public.select_promoter(
  p_job_id uuid, p_promoter_id uuid, p_equipment text, p_day_ids uuid[]
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_selection_id uuid;
begin
  if not coalesce(public.current_role() in ('owner', 'manager'), false) then
    raise insufficient_privilege;
  end if;

  -- A mesma ordem de bloqueio dos triggers evita disputar a escala depois do perfil.
  update retratus_private.schedule_lock set id = true where id;
  if not exists (
    select 1 from public.profiles
    where id = p_promoter_id and role = 'promoter' and approved
    for share
  ) then
    raise check_violation using message = 'Seleção exige promotor aprovado.';
  end if;

  if coalesce(cardinality(p_day_ids), 0) = 0 or (
    select count(*) from public.job_days d where d.id = any(p_day_ids) and d.job_id = p_job_id
  ) <> cardinality(p_day_ids) then
    raise check_violation using message = 'Informe dias distintos do trabalho.';
  end if;

  insert into public.selections (job_id, promoter_id, equipment, created_by)
  values (p_job_id, p_promoter_id, p_equipment, auth.uid())
  returning selections.id into new_selection_id;

  insert into public.selection_days (selection_id, job_day_id)
  select new_selection_id, day_id from unnest(p_day_ids) as days(day_id);

  return new_selection_id;
end;
$$;

-- Ao confirmar um evento, grava apenas uma sugestão disponível, preservando ajustes manuais.
create function retratus_private.suggest_event_payment() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  duration_hours numeric;
  max_rate public.event_pay_rates%rowtype;
  suggested_amount numeric;
begin
  select extract(epoch from (d.ends_at - d.starts_at)) / 3600 into duration_hours
  from public.selection_days sd
  join public.job_days d on d.id = sd.job_day_id
  join public.selections s on s.id = sd.selection_id and s.job_id = d.job_id
  join public.jobs j on j.id = s.job_id and j.type = 'evento'
  where sd.selection_id = new.selection_id and sd.job_day_id = new.job_day_id;

  if duration_hours is null then return null; end if;

  select r.amount into suggested_amount from public.event_pay_rates r where r.hours = duration_hours;
  if suggested_amount is null then
    select * into max_rate from public.event_pay_rates order by hours desc limit 1;
    if duration_hours > max_rate.hours then
      select max_rate.amount + (duration_hours - max_rate.hours) * s.extra_hour_amount
      into suggested_amount from public.pay_settings s where s.id;
    end if;
  end if;

  if suggested_amount is not null then
    insert into public.payments (selection_id, amount, source)
    values (new.selection_id, round(suggested_amount, 2), 'tabela')
    on conflict (selection_id) do nothing;
  end if;

  return null;
end;
$$;

revoke execute on function retratus_private.suggest_event_payment() from public;
create trigger suggest_event_payment after insert on public.selection_days
for each row execute function retratus_private.suggest_event_payment();

revoke execute on function public.dashboard_counts(timestamptz, timestamptz),
  public.promoter_job_counts(timestamptz, timestamptz), public.agenda(timestamptz, timestamptz),
  public.select_promoter(uuid, uuid, text, uuid[])
from public, anon, service_role;
grant execute on function public.dashboard_counts(timestamptz, timestamptz),
  public.promoter_job_counts(timestamptz, timestamptz), public.agenda(timestamptz, timestamptz),
  public.select_promoter(uuid, uuid, text, uuid[])
to authenticated;
