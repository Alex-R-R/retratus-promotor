create function public.calendar(p_from timestamptz, p_to timestamptz)
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
    and (j.status <> 'rascunho' or caller_role in ('owner', 'manager'))
    and (caller_role <> 'promoter' or assigned.promoters is not null)
  order by d.starts_at, d.id;
end;
$$;

revoke execute on function public.calendar(timestamptz, timestamptz) from public, anon, service_role;
grant execute on function public.calendar(timestamptz, timestamptz) to authenticated;

create function retratus_private.calendar_link(p_start timestamptz) returns text
language sql stable set search_path = ''
as $$
  select coalesce('/agenda?d=' || to_char(p_start at time zone 'America/Belem', 'YYYY-MM-DD'), '/agenda')
$$;

revoke execute on function retratus_private.calendar_link(timestamptz) from public, anon, authenticated, service_role;


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
      select distinct promoter_id, 'job_cancelled', 'Trabalho cancelado', new.title,
        retratus_private.calendar_link((select min(d.starts_at) from public.job_days d where d.job_id = new.id))
      from public.selections where job_id = new.id;
    end if;
  elsif tg_table_name = 'selections' then
    -- O trigger roda antes de os dias da seleção serem gravados.
    insert into public.notifications (user_id, kind, title, body, link)
    select new.promoter_id, 'selection_created', 'Seleção confirmada', j.title,
      retratus_private.calendar_link((select min(d.starts_at) from public.job_days d where d.job_id = j.id))
    from public.jobs j where j.id = new.job_id;
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

create or replace function public.save_job(p_job_id uuid, p_job jsonb, p_days jsonb, p_slots jsonb)
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
  select distinct s.promoter_id, 'job_changed', 'Horário do trabalho alterado', job_data.title,
    retratus_private.calendar_link((select min(input.starts_at)
      from jsonb_to_recordset(p_days) input(starts_at timestamptz)))
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

create or replace function public.remove_selection(p_selection_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  removed public.selections;
  first_start timestamptz;
begin
  if not coalesce(public.current_role() in ('owner', 'manager'), false) then
    raise insufficient_privilege;
  end if;

  update retratus_private.schedule_lock set id = true where id;
  select min(d.starts_at) into first_start
  from public.selection_days sd
  join public.job_days d on d.id = sd.job_day_id
  where sd.selection_id = p_selection_id;

  delete from public.selections s
  where s.id = p_selection_id and first_start > clock_timestamp()
  returning s.* into removed;
  if not found then
    raise check_violation using message = 'Seleção só pode ser removida antes do primeiro dia.';
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  select removed.promoter_id, 'selection_removed', 'Seleção removida', j.title, retratus_private.calendar_link(first_start)
  from public.jobs j where j.id = removed.job_id;
end;
$$;
