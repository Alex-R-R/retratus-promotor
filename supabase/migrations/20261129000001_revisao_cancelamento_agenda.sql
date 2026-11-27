-- Revisão geral (Claude). Revisão: Codex.

-- 1. Cancelar tira o trabalho de todos os totais de valores. Por isso só vale para
--    trabalho publicado que ainda não começou e que não tem pagamento feito.
--    A regra fica em trigger para valer também na escrita direta em jobs
--    (política jobs_manage), não só em cancel_job. O lock_jobs (BEFORE STATEMENT)
--    já pegou o schedule_lock antes desta checagem.
create function retratus_private.guard_job_cancel() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Rascunho nunca foi trabalhado; um rascunho com data passada ainda pode ser cancelado.
  if old.status <> 'rascunho' and exists (
    select 1 from public.job_days d where d.job_id = new.id and d.starts_at <= clock_timestamp()
  ) then
    raise check_violation using message = 'Trabalho que já começou não pode ser cancelado.';
  end if;
  if exists (
    select 1 from public.selections s join public.payments pay on pay.selection_id = s.id
    where s.job_id = new.id and pay.paid_at is not null
  ) then
    raise check_violation using message = 'Este trabalho tem pagamento feito. Os donos precisam desmarcar o pagamento antes de cancelar.';
  end if;
  return new;
end;
$$;

create trigger guard_job_cancel before update of status on public.jobs
for each row when (new.status = 'cancelado' and old.status is distinct from 'cancelado')
execute function retratus_private.guard_job_cancel();

-- O outro lado: pagamento não é marcado como feito em trabalho cancelado, nem por
-- set_paid nem por escrita direta do dono. O lock serializa com o cancelamento.
create trigger lock_payments before insert or update or delete on public.payments
for each statement execute function retratus_private.lock_schedule();

create function retratus_private.guard_paid_cancelled() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.selections s join public.jobs j on j.id = s.job_id
    where s.id = new.selection_id and j.status = 'cancelado'
  ) then
    raise check_violation using message = 'Trabalho cancelado não recebe pagamento.';
  end if;
  return new;
end;
$$;

create trigger guard_paid_cancelled before insert or update of paid_at on public.payments
for each row when (new.paid_at is not null)
execute function retratus_private.guard_paid_cancelled();

revoke execute on function retratus_private.guard_job_cancel(), retratus_private.guard_paid_cancelled()
from public, anon, authenticated, service_role;

-- 2. A gestão pode escalar em rascunho, e o promotor recebe o aviso na hora.
--    Agora ele também vê esses dias na agenda. Mídia continua sem ver rascunhos.
create or replace function public.calendar(p_from timestamptz, p_to timestamptz)
returns table (
  day_id uuid, job_id uuid, title text, type public.job_type, status public.job_status,
  briefing public.briefing_status, location text, city text, client_name text,
  starts_at timestamptz, ends_at timestamptz, slots jsonb, promoters jsonb
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
  select d.id, j.id, j.title, j.type, j.status, j.briefing, j.location, j.city,
    c.name, d.starts_at, d.ends_at,
    case when caller_role <> 'promoter' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'equipment', slot.equipment, 'capacity', slot.capacity, 'filled', (
          select count(*)
          from public.selection_days sd
          join public.selections s on s.id = sd.selection_id
          where sd.job_day_id = d.id and s.equipment = slot.equipment
        )
      ) order by slot.equipment)
      from public.job_slots slot where slot.job_id = j.id
    ), '[]'::jsonb) end,
    coalesce(assigned.promoters, '[]'::jsonb)
  from public.job_days d
  join public.jobs j on j.id = d.job_id
  left join public.clients c on c.id = j.client_id and caller_role <> 'promoter'
  cross join lateral (
    select jsonb_agg(jsonb_build_object(
      'promoter_id', p.id, 'full_name', p.full_name, 'equipment', s.equipment
    ) order by p.full_name, p.id, s.equipment) as promoters
    from public.selection_days sd
    join public.selections s on s.id = sd.selection_id
    join public.profiles p on p.id = s.promoter_id
    where sd.job_day_id = d.id
      and (caller_role <> 'promoter' or s.promoter_id = auth.uid())
  ) assigned
  where d.starts_at < p_to and d.ends_at > p_from
    and (j.status <> 'rascunho' or caller_role <> 'media')
    and (caller_role <> 'promoter' or assigned.promoters is not null)
  order by d.starts_at, d.id;
end;
$$;
