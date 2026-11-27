-- Revisão geral (Claude). Revisão: Codex.

-- 1. Cancelar tira o trabalho de todos os totais de valores. Por isso só vale para
--    trabalho que ainda não começou e que não tem pagamento feito.
create or replace function public.cancel_job(p_job_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not coalesce(public.current_role() in ('owner', 'manager'), false) then
    raise insufficient_privilege;
  end if;
  if p_reason is null or p_reason !~ '[^[:space:]]' then
    raise check_violation using message = 'Informe o motivo do cancelamento.';
  end if;

  update retratus_private.schedule_lock set id = true where id;
  if exists (
    select 1 from public.job_days d where d.job_id = p_job_id and d.starts_at <= clock_timestamp()
  ) then
    raise check_violation using message = 'Trabalho que já começou não pode ser cancelado.';
  end if;
  if exists (
    select 1 from public.selections s join public.payments pay on pay.selection_id = s.id
    where s.job_id = p_job_id and pay.paid_at is not null
  ) then
    raise check_violation using message = 'Este trabalho tem pagamento feito. Os donos precisam desmarcar o pagamento antes de cancelar.';
  end if;

  update public.jobs set status = 'cancelado', cancel_reason = p_reason
  where id = p_job_id and status in ('rascunho', 'publicado');
  if not found then
    raise check_violation using message = 'Somente rascunhos e trabalhos publicados podem ser cancelados.';
  end if;
end;
$$;

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
