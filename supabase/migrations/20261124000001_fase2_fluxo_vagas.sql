create or replace function retratus_private.notify() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'jobs' then
    if new.status = 'publicado' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
      insert into public.notifications (user_id, kind, title, body, link)
      select id, 'job_published', 'Novo trabalho publicado', new.title, '/vagas/' || new.id
      from public.profiles where approved and role = 'promoter';
    elsif new.status = 'cancelado' and tg_op = 'UPDATE' and old.status <> new.status then
      insert into public.notifications (user_id, kind, title, body, link)
      select distinct promoter_id, 'job_cancelled', 'Trabalho cancelado', new.title, '/meus-trabalhos'
      from public.selections where job_id = new.id;
    end if;
  elsif tg_table_name = 'selections' then
    insert into public.notifications (user_id, kind, title, body, link)
    select new.promoter_id, 'selection_created', 'Seleção confirmada', title, '/meus-trabalhos'
    from public.jobs where id = new.job_id;
  elsif tg_table_name = 'applications' then
    insert into public.notifications (user_id, kind, title, body, link)
    select p.id, 'application_created', 'Nova candidatura', j.title, '/trabalhos/' || j.id
    from public.profiles p cross join public.jobs j
    where p.approved and p.role in ('owner', 'manager') and j.id = new.job_id;
  elsif new.approved and (tg_op = 'INSERT' or not old.approved) then
    insert into public.notifications (user_id, kind, title, body)
    values (new.id, 'profile_approved', 'Cadastro aprovado', 'Seu cadastro foi aprovado.');
  end if;
  return new;
end;
$$;

create trigger notify_application after insert on public.applications
for each row execute function retratus_private.notify();

update public.notifications
set link = case kind when 'job_published' then '/vagas/' || substr(link, 7) else '/meus-trabalhos' end
where kind in ('job_published', 'selection_created') and link like '/jobs/%';

create function public.save_job(p_job_id uuid, p_job jsonb, p_days jsonb, p_slots jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  job_data public.jobs;
  job_status public.job_status;
begin
  if not coalesce(public.current_role() in ('owner', 'manager'), false) then
    raise insufficient_privilege;
  end if;

  update retratus_private.schedule_lock set id = true where id;
  if jsonb_typeof(p_job) is distinct from 'object'
    or jsonb_typeof(p_days) is distinct from 'array'
    or jsonb_typeof(p_slots) is distinct from 'array' then
    raise check_violation using message = 'Informe os dados, dias e equipamentos do trabalho.';
  end if;
  job_data := jsonb_populate_record(null::public.jobs, p_job);
  if job_data.type = 'evento' and jsonb_array_length(p_days) <> 1 then
    raise check_violation using message = 'Evento deve ter exatamente um dia.';
  end if;

  if p_job_id is not null then
    select j.status into strict job_status from public.jobs j where j.id = p_job_id;
    if job_status in ('cancelado', 'realizado') then
      raise check_violation using message = 'Trabalho cancelado ou realizado não pode ser editado.';
    end if;
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_days) d(id uuid, starts_at timestamptz, ends_at timestamptz)
    left join public.job_days existing on existing.id = d.id and existing.job_id = p_job_id
    where d.id is not null
    group by d.id, existing.id
    having existing.id is null or count(*) > 1
  ) then
    raise check_violation using message = 'Informe dias distintos do trabalho.';
  end if;

  if exists (
    select 1 from public.job_days d join public.selection_days sd on sd.job_day_id = d.id
    where d.job_id = p_job_id and not exists (
      select 1 from jsonb_to_recordset(p_days) input(id uuid) where input.id = d.id
    )
  ) then
    raise check_violation using message = 'Não é possível remover dia com seleção.';
  end if;

  if exists (
    select 1 from public.selections s where s.job_id = p_job_id and not exists (
      select 1 from jsonb_to_recordset(p_slots) input(equipment text) where input.equipment = s.equipment
    )
  ) then
    raise check_violation using message = 'Não é possível remover equipamento com seleção.';
  end if;

  if p_job_id is null then
    insert into public.jobs (type, title, client_id, location, city, briefing, notes)
    values (job_data.type, job_data.title, job_data.client_id, job_data.location,
      job_data.city, coalesce(job_data.briefing, 'aguardando'), job_data.notes)
    returning id into p_job_id;
  else
    update public.jobs j
    set type = job_data.type, title = job_data.title, client_id = job_data.client_id,
        location = job_data.location, city = job_data.city, notes = job_data.notes,
        briefing = coalesce(job_data.briefing, j.briefing)
    where j.id = p_job_id;
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  select distinct s.promoter_id, 'job_changed', 'Horário do trabalho alterado', job_data.title, '/meus-trabalhos'
  from jsonb_to_recordset(p_days) input(id uuid, starts_at timestamptz, ends_at timestamptz)
  join public.job_days d on d.id = input.id
  join public.selection_days sd on sd.job_day_id = d.id
  join public.selections s on s.id = sd.selection_id
  where (d.starts_at, d.ends_at) is distinct from (input.starts_at, input.ends_at);

  update public.job_days d set starts_at = input.starts_at, ends_at = input.ends_at
  from jsonb_to_recordset(p_days) input(id uuid, starts_at timestamptz, ends_at timestamptz)
  where d.id = input.id
    and (d.starts_at, d.ends_at) is distinct from (input.starts_at, input.ends_at);

  delete from public.job_days d where d.job_id = p_job_id and not exists (
    select 1 from jsonb_to_recordset(p_days) input(id uuid) where input.id = d.id
  );
  insert into public.job_days (job_id, starts_at, ends_at)
  select p_job_id, input.starts_at, input.ends_at
  from jsonb_to_recordset(p_days) input(id uuid, starts_at timestamptz, ends_at timestamptz)
  where input.id is null;

  delete from public.job_slots slot where slot.job_id = p_job_id and not exists (
    select 1 from jsonb_to_recordset(p_slots) input(equipment text) where input.equipment = slot.equipment
  );
  insert into public.job_slots (job_id, equipment, capacity)
  select p_job_id, input.equipment, input.capacity
  from jsonb_to_recordset(p_slots) input(equipment text, capacity integer)
  on conflict (job_id, equipment) do update set capacity = excluded.capacity;
  return p_job_id;
end;
$$;

create function public.publish_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not coalesce(public.current_role() in ('owner', 'manager'), false) then
    raise insufficient_privilege;
  end if;

  update retratus_private.schedule_lock set id = true where id;
  update public.jobs j set status = 'publicado'
  where j.id = p_job_id and j.status = 'rascunho'
    and exists (select 1 from public.job_days d where d.job_id = j.id and d.starts_at > clock_timestamp())
    and exists (select 1 from public.job_slots slot where slot.job_id = j.id);
  if not found then
    raise check_violation using message = 'Publicação exige rascunho, dia futuro e equipamento.';
  end if;
end;
$$;

create function public.cancel_job(p_job_id uuid, p_reason text) returns void
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
  update public.jobs set status = 'cancelado', cancel_reason = p_reason
  where id = p_job_id and status in ('rascunho', 'publicado');
  if not found then
    raise check_violation using message = 'Somente rascunhos e trabalhos publicados podem ser cancelados.';
  end if;
end;
$$;

create function public.remove_selection(p_selection_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  removed public.selections;
begin
  if not coalesce(public.current_role() in ('owner', 'manager'), false) then
    raise insufficient_privilege;
  end if;

  update retratus_private.schedule_lock set id = true where id;
  delete from public.selections s
  where s.id = p_selection_id and (
    select min(d.starts_at) from public.selection_days sd
    join public.job_days d on d.id = sd.job_day_id
    where sd.selection_id = s.id
  ) > clock_timestamp()
  returning s.* into removed;
  if not found then
    raise check_violation using message = 'Seleção só pode ser removida antes do primeiro dia.';
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  select removed.promoter_id, 'selection_removed', 'Seleção removida', j.title, '/meus-trabalhos'
  from public.jobs j where j.id = removed.job_id;
end;
$$;

create function public.set_briefing(p_job_id uuid, p_briefing public.briefing_status) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not coalesce(public.current_role() in ('owner', 'manager'), false) then
    raise insufficient_privilege;
  end if;

  update retratus_private.schedule_lock set id = true where id;
  update public.jobs set briefing = p_briefing where id = p_job_id;
  if not found then
    raise no_data_found using message = 'Trabalho não encontrado.';
  end if;
end;
$$;

create function public.jobs_overview(p_from timestamptz, p_to timestamptz)
returns table (
  job_id uuid, title text, type public.job_type, status public.job_status,
  briefing public.briefing_status, city text, location text, client_name text,
  first_start timestamptz, last_end timestamptz, day_count bigint,
  capacity_total bigint, filled_total bigint, applications_count bigint, staffing text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise insufficient_privilege;
  end if;

  return query
  select j.id, j.title, j.type, j.status, j.briefing, j.city, j.location, c.name,
    days.first_start, days.last_end, days.day_count,
    slots.capacity * days.day_count, filled.total, applicants.total,
    case when slots.capacity * days.day_count = 0 then 'sem_vagas'
         when slots.capacity * days.day_count = filled.total then 'equipe_completa'
         else 'vagas_abertas' end
  from public.jobs j
  left join public.clients c on c.id = j.client_id
  cross join lateral (
    select min(d.starts_at) as first_start, max(d.ends_at) as last_end, count(*) as day_count,
      bool_or(d.starts_at < p_to and d.ends_at > p_from) as in_period
    from public.job_days d where d.job_id = j.id
  ) days
  cross join lateral (
    select coalesce(sum(slot.capacity), 0) as capacity
    from public.job_slots slot where slot.job_id = j.id
  ) slots
  cross join lateral (
    select count(*) as total from public.selections s
    join public.selection_days sd on sd.selection_id = s.id where s.job_id = j.id
  ) filled
  cross join lateral (
    select count(*) as total from public.applications a where a.job_id = j.id
  ) applicants
  where days.in_period or (j.status = 'rascunho' and days.day_count = 0)
  order by days.first_start, j.id;
end;
$$;

create function public.job_board()
returns table (
  job_id uuid, title text, type public.job_type, city text, location text, notes text,
  application_deadline timestamptz, days jsonb, slots jsonb, my_application text[], i_am_selected boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.current_role() is distinct from 'promoter' then
    raise insufficient_privilege;
  end if;

  return query
  select j.id, j.title, j.type, j.city, j.location, j.notes, schedule.deadline, schedule.days,
    coalesce(equipment.slots, '[]'::jsonb), a.equipment,
    exists (select 1 from public.selections s where s.job_id = j.id and s.promoter_id = auth.uid())
  from public.jobs j
  cross join lateral (
    select min(d.starts_at) - interval '24 hours' as deadline,
      jsonb_agg(jsonb_build_object('id', d.id, 'starts_at', d.starts_at, 'ends_at', d.ends_at)
        order by d.starts_at, d.id) as days
    from public.job_days d where d.job_id = j.id
  ) schedule
  cross join lateral (
    select jsonb_agg(jsonb_build_object('equipment', slot.equipment, 'capacity', slot.capacity,
      'open_days', (
        select count(*) from public.job_days d where d.job_id = j.id and slot.capacity > (
          select count(*) from public.selection_days sd
          join public.selections s on s.id = sd.selection_id
          where sd.job_day_id = d.id and s.equipment = slot.equipment
        )
      )) order by slot.equipment) as slots
    from public.job_slots slot where slot.job_id = j.id
  ) equipment
  left join public.applications a on a.job_id = j.id and a.promoter_id = auth.uid()
  where j.status = 'publicado' and schedule.deadline >= statement_timestamp()
  order by schedule.deadline, j.id;
end;
$$;

create function public.job_candidates(p_job_id uuid)
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

create function public.my_jobs(p_from timestamptz, p_to timestamptz)
returns table (
  job_id uuid, title text, type public.job_type, city text, location text,
  equipment text, starts_at timestamptz, ends_at timestamptz, status public.job_status
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.current_role() is distinct from 'promoter' then
    raise insufficient_privilege;
  end if;

  return query
  select j.id, j.title, j.type, j.city, j.location, s.equipment, d.starts_at, d.ends_at, j.status
  from public.selections s
  join public.jobs j on j.id = s.job_id
  join public.selection_days sd on sd.selection_id = s.id
  join public.job_days d on d.id = sd.job_day_id
  where s.promoter_id = auth.uid() and d.starts_at < p_to and d.ends_at > p_from
  order by d.starts_at, d.id, s.id;
end;
$$;

revoke execute on function
  public.save_job(uuid, jsonb, jsonb, jsonb), public.publish_job(uuid),
  public.cancel_job(uuid, text), public.remove_selection(uuid),
  public.set_briefing(uuid, public.briefing_status), public.jobs_overview(timestamptz, timestamptz),
  public.job_board(), public.job_candidates(uuid), public.my_jobs(timestamptz, timestamptz)
from public, anon, service_role;

grant execute on function
  public.save_job(uuid, jsonb, jsonb, jsonb), public.publish_job(uuid),
  public.cancel_job(uuid, text), public.remove_selection(uuid),
  public.set_briefing(uuid, public.briefing_status), public.jobs_overview(timestamptz, timestamptz),
  public.job_board(), public.job_candidates(uuid), public.my_jobs(timestamptz, timestamptz)
to authenticated;
