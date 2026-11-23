create schema retratus_private;
revoke all on schema retratus_private from public;

create type public.user_role as enum ('owner', 'manager', 'media', 'promoter');
create type public.person_link as enum ('freelancer', 'employee', 'provider', 'unclassified');
create type public.job_type as enum ('evento', 'acao');
create type public.briefing_status as enum ('aguardando', 'fechado');
create type public.job_status as enum ('rascunho', 'publicado', 'realizado', 'cancelado');
create type public.media_kind as enum ('foto', 'video', 'pasta');
create type public.pay_source as enum ('tabela', 'manual');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  phone text,
  email text,
  role public.user_role not null default 'promoter',
  link public.person_link not null default 'unclassified',
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  type public.job_type not null,
  title text not null,
  client_id uuid references public.clients on delete set null,
  location text,
  city text,
  briefing public.briefing_status not null default 'aguardando',
  status public.job_status not null default 'rascunho',
  notes text,
  cancel_reason text,
  created_by uuid references public.profiles on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_days (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at)
);

create table public.job_slots (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  equipment text not null check (equipment in (
    'Totem', 'Self print', 'Totem slim', 'Plataforma 360', 'Túnel de LED', 'Máquina de garra'
  )),
  capacity integer not null check (capacity between 1 and 30),
  unique (job_id, equipment)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  promoter_id uuid not null references public.profiles on delete cascade default auth.uid(),
  equipment text[] not null check (cardinality(equipment) > 0),
  created_at timestamptz not null default now(),
  unique (job_id, promoter_id)
);

create table public.selections (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  promoter_id uuid not null references public.profiles on delete cascade,
  equipment text not null,
  created_by uuid references public.profiles on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (job_id, equipment) references public.job_slots (job_id, equipment)
    deferrable initially deferred
);

create table public.selection_days (
  selection_id uuid references public.selections on delete cascade,
  job_day_id uuid references public.job_days on delete cascade,
  primary key (selection_id, job_day_id)
);

create table public.event_pay_rates (
  hours integer primary key check (hours > 0),
  amount numeric not null check (amount >= 0)
);

create table public.pay_settings (
  id boolean primary key default true check (id),
  extra_hour_amount numeric check (extra_hour_amount >= 0)
);

insert into public.pay_settings default values;

create table public.payments (
  selection_id uuid primary key references public.selections on delete cascade,
  amount numeric not null check (amount >= 0),
  source public.pay_source not null default 'manual',
  updated_by uuid references public.profiles on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  url text not null,
  kind public.media_kind not null,
  title text not null,
  added_by uuid references public.profiles on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index jobs_client_idx on public.jobs (client_id);
create index jobs_status_idx on public.jobs (status);
create index job_days_job_start_idx on public.job_days (job_id, starts_at);
create index job_days_start_idx on public.job_days (starts_at);
create index applications_promoter_idx on public.applications (promoter_id);
create index selections_promoter_job_idx on public.selections (promoter_id, job_id);
create index selections_job_equipment_idx on public.selections (job_id, equipment);
create index selection_days_day_idx on public.selection_days (job_day_id);
create index media_items_job_idx on public.media_items (job_id);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

create function public.current_role() returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and approved
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_role() in ('owner', 'manager', 'media'), false)
$$;

revoke execute on function public.current_role(), public.is_staff() from public, anon;
grant execute on function public.current_role(), public.is_staff() to authenticated;

create function retratus_private.create_profile() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          new.raw_user_meta_data ->> 'phone', new.email);
  return new;
end;
$$;

create trigger create_profile after insert on auth.users
for each row execute function retratus_private.create_profile();

create function retratus_private.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger jobs_updated_at before update on public.jobs
for each row execute function retratus_private.touch_updated_at();
create trigger payments_updated_at before update on public.payments
for each row execute function retratus_private.touch_updated_at();

-- A atualização serializa escritas concorrentes da escala inclusive em
-- transações com snapshot fixo, que recebem erro de serialização em uma corrida.
create table retratus_private.schedule_lock (id boolean primary key check (id));
insert into retratus_private.schedule_lock values (true);

create function retratus_private.lock_schedule() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update retratus_private.schedule_lock set id = true where id;
  return null;
end;
$$;

create trigger lock_jobs before insert or update or delete on public.jobs
for each statement execute function retratus_private.lock_schedule();
create trigger lock_job_days before insert or update or delete on public.job_days
for each statement execute function retratus_private.lock_schedule();
create trigger lock_job_slots before insert or update or delete on public.job_slots
for each statement execute function retratus_private.lock_schedule();
create trigger lock_selections before insert or update or delete on public.selections
for each statement execute function retratus_private.lock_schedule();
create trigger lock_selection_days before insert or update or delete on public.selection_days
for each statement execute function retratus_private.lock_schedule();
create trigger lock_applications before insert or update or delete on public.applications
for each statement execute function retratus_private.lock_schedule();

create function retratus_private.check_event_day_count() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  affected_ids uuid[];
begin
  if tg_table_name = 'jobs' then
    affected_ids := array[new.id];
  elsif tg_op = 'INSERT' then
    affected_ids := array[new.job_id];
  elsif tg_op = 'DELETE' then
    affected_ids := array[old.job_id];
  else
    affected_ids := array[old.job_id, new.job_id];
  end if;

  if exists (
    select 1 from public.jobs j
    where j.id = any(affected_ids) and j.type = 'evento'
      and (select count(*) from public.job_days d where d.job_id = j.id) <> 1
  ) then
    raise check_violation using message = 'Evento deve ter exatamente um dia.';
  end if;
  return null;
end;
$$;

create constraint trigger event_job_day_count after insert or update on public.jobs
deferrable initially deferred for each row execute function retratus_private.check_event_day_count();
create constraint trigger event_days_count after insert or update or delete on public.job_days
deferrable initially deferred for each row execute function retratus_private.check_event_day_count();

create function retratus_private.check_schedule() returns trigger
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
    join public.job_days da on da.id = a.job_day_id
    join public.selections sb on sb.promoter_id = sa.promoter_id
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
    join public.job_slots slot on (slot.job_id, slot.equipment) = (s.job_id, s.equipment)
    group by sd.job_day_id, slot.id, slot.capacity
    having count(*) > slot.capacity
  ) then
    raise check_violation using message = 'Capacidade do equipamento excedida neste dia.';
  end if;
  return null;
end;
$$;

create trigger check_selection_days after insert or update on public.selection_days
for each statement execute function retratus_private.check_schedule();
create trigger check_selection_changes after update on public.selections
for each statement execute function retratus_private.check_schedule();
create trigger check_job_day_changes after update on public.job_days
for each statement execute function retratus_private.check_schedule();
create trigger check_capacity_changes after insert or update on public.job_slots
for each statement execute function retratus_private.check_schedule();

create function retratus_private.check_application() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  deadline timestamptz;
begin
  if auth.uid() is not null and (
    auth.uid() is distinct from new.promoter_id or public.current_role() is distinct from 'promoter'
  ) then
    raise insufficient_privilege;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = new.promoter_id and role = 'promoter' and approved
    for share
  ) then
    raise check_violation using message = 'Candidatura exige promotor aprovado.';
  end if;

  select min(d.starts_at) - interval '24 hours' into deadline
  from public.jobs j join public.job_days d on d.job_id = j.id
  where j.id = new.job_id and j.status = 'publicado';

  if deadline is null or clock_timestamp() > deadline then
    raise check_violation using message = 'Trabalho indisponível ou prazo de candidatura encerrado.';
  end if;

  if exists (
    select 1 from unnest(new.equipment) as requested(equipment)
    where not exists (
      select 1 from public.job_slots slot
      where slot.job_id = new.job_id and slot.equipment = requested.equipment
    )
  ) then
    raise check_violation using message = 'Equipamento indisponível neste trabalho.';
  end if;
  return new;
end;
$$;

create trigger check_application before insert or update on public.applications
for each row execute function retratus_private.check_application();

create function retratus_private.notify() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'jobs' then
    if new.status = 'publicado' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
      insert into public.notifications (user_id, kind, title, body, link)
      select id, 'job_published', 'Novo trabalho publicado', new.title, '/jobs/' || new.id
      from public.profiles where approved and role = 'promoter';
    end if;
  elsif tg_table_name = 'selections' then
    insert into public.notifications (user_id, kind, title, body, link)
    select new.promoter_id, 'selection_created', 'Seleção confirmada', title, '/jobs/' || id
    from public.jobs where id = new.job_id;
  elsif new.approved and (tg_op = 'INSERT' or not old.approved) then
    insert into public.notifications (user_id, kind, title, body)
    values (new.id, 'profile_approved', 'Cadastro aprovado', 'Seu cadastro foi aprovado.');
  end if;
  return new;
end;
$$;

create trigger notify_job after insert or update of status on public.jobs
for each row execute function retratus_private.notify();
create trigger notify_selection after insert on public.selections
for each row execute function retratus_private.notify();
create trigger notify_profile after insert or update of approved on public.profiles
for each row execute function retratus_private.notify();

create function retratus_private.audit_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  before_row jsonb;
  after_row jsonb;
  entity_key uuid;
begin
  if tg_op <> 'INSERT' then before_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_row := to_jsonb(new); end if;
  entity_key := coalesce(after_row ->> 'id', before_row ->> 'id',
                         after_row ->> 'selection_id', before_row ->> 'selection_id')::uuid;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values ((select id from public.profiles where id = auth.uid()),
          lower(tg_op), tg_table_name, entity_key,
          jsonb_build_object('before', before_row, 'after', after_row));
  return null;
end;
$$;

create trigger audit_profiles after update of role, link, approved on public.profiles
for each row when ((old.role, old.link, old.approved) is distinct from (new.role, new.link, new.approved))
execute function retratus_private.audit_change();
create trigger audit_jobs after insert or update or delete on public.jobs
for each row execute function retratus_private.audit_change();
create trigger audit_selections after insert or update or delete on public.selections
for each row execute function retratus_private.audit_change();
create trigger audit_selection_days after insert or update or delete on public.selection_days
for each row execute function retratus_private.audit_change();
create trigger audit_payments after insert or update or delete on public.payments
for each row execute function retratus_private.audit_change();

revoke execute on all functions in schema retratus_private from public;
