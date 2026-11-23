-- TODO: restringir as verificações aos promotores e dias afetados quando houver ganho de desempenho.
create or replace function retratus_private.check_schedule() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.selection_days sd
    join public.selections s on s.id = sd.selection_id
    join public.job_days d on d.id = sd.job_day_id
    where s.job_id <> d.job_id
  ) then
    raise check_violation using message = 'Dia de seleção pertence a outro trabalho.';
  end if;

  if exists (
    select 1 from public.selection_days a
    join public.selections sa on sa.id = a.selection_id
    join public.jobs ja on ja.id = sa.job_id and ja.status <> 'cancelado'
    join public.job_days da on da.id = a.job_day_id
    join public.selections sb on sb.promoter_id = sa.promoter_id
    join public.jobs jb on jb.id = sb.job_id and jb.status <> 'cancelado'
    join public.selection_days b on b.selection_id = sb.id
    join public.job_days db on db.id = b.job_day_id
    where (a.selection_id, a.job_day_id) < (b.selection_id, b.job_day_id)
      and da.starts_at < db.ends_at and db.starts_at < da.ends_at
  ) then
    raise check_violation using message = 'Promotor já selecionado em horário sobreposto.';
  end if;

  if exists (
    select 1 from public.selection_days sd
    join public.selections s on s.id = sd.selection_id
    join public.jobs j on j.id = s.job_id and j.status <> 'cancelado'
    join public.job_slots slot on (slot.job_id, slot.equipment) = (s.job_id, s.equipment)
    group by sd.job_day_id, slot.id, slot.capacity
    having count(*) > slot.capacity
  ) then
    raise check_violation using message = 'Capacidade do equipamento excedida neste dia.';
  end if;
  return null;
end;
$$;

create or replace function public.job_candidates(p_job_id uuid)
returns table (
  promoter_id uuid, full_name text, phone text, link public.person_link,
  applied_equipment text[], applied_at timestamptz, selections jsonb, conflict_day_ids uuid[]
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not coalesce(public.current_role() in ('owner', 'manager'), false) then
    raise insufficient_privilege;
  end if;

  return query
  with candidates as (
    select a.promoter_id from public.applications a where a.job_id = p_job_id
    union
    select s.promoter_id from public.selections s where s.job_id = p_job_id
  )
  select p.id, p.full_name, p.phone, p.link, a.equipment, a.created_at,
    coalesce(assigned.selections, '[]'::jsonb),
    array(
      select d.id from public.job_days d where d.job_id = p_job_id and exists (
        select 1 from public.selections s
        join public.jobs j on j.id = s.job_id and j.status <> 'cancelado'
        join public.selection_days sd on sd.selection_id = s.id
        join public.job_days other_day on other_day.id = sd.job_day_id
        where s.promoter_id = p.id and s.job_id <> p_job_id
          and other_day.starts_at < d.ends_at and d.starts_at < other_day.ends_at
      )
      order by d.starts_at, d.id
    )
  from candidates c
  join public.profiles p on p.id = c.promoter_id
  left join public.applications a on a.job_id = p_job_id and a.promoter_id = p.id
  cross join lateral (
    select jsonb_agg(jsonb_build_object('selection_id', s.id, 'equipment', s.equipment,
      'day_ids', array(
        select sd.job_day_id from public.selection_days sd
        join public.job_days d on d.id = sd.job_day_id
        where sd.selection_id = s.id order by d.starts_at, d.id
      )) order by s.created_at, s.id) as selections
    from public.selections s where s.job_id = p_job_id and s.promoter_id = p.id
  ) assigned
  order by p.full_name, p.id;
end;
$$;

create function public.apply_to_job(p_job_id uuid, p_equipment text[]) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.current_role() is distinct from 'promoter' then
    raise insufficient_privilege;
  end if;

  insert into public.applications (job_id, promoter_id, equipment)
  values (p_job_id, auth.uid(), p_equipment)
  on conflict (job_id, promoter_id) do update
    set equipment = excluded.equipment;
end;
$$;

revoke execute on function public.apply_to_job(uuid, text[]) from public, anon, service_role;
grant execute on function public.apply_to_job(uuid, text[]) to authenticated;
