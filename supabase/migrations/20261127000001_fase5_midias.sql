alter table public.media_items
  add constraint media_items_url_check
    check (char_length(url) <= 2000 and url ~ '^https://(drive|docs)\.google\.com/[^[:space:]]+$'),
  add constraint media_items_title_check
    check (btrim(title) = title and char_length(title) between 1 and 120),
  add constraint media_items_job_url_key unique (job_id, url);

drop policy media_items_manage on public.media_items;
drop policy media_items_media_read on public.media_items;
drop policy media_items_media_insert on public.media_items;
drop policy media_items_media_update on public.media_items;

revoke all on public.media_items from public, anon, authenticated;
grant select, insert, delete on public.media_items to authenticated;
grant update (title, kind, url) on public.media_items to authenticated;

create policy media_items_staff on public.media_items for all to authenticated
using ((select public.current_role()) in ('owner', 'manager', 'media'))
with check ((select public.current_role()) in ('owner', 'manager', 'media'));

create function retratus_private.guard_media_item() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  job_status public.job_status;
  previous_id uuid;
begin
  if tg_op = 'UPDATE' then
    previous_id := old.id;
    -- Preserva o ON DELETE SET NULL da referência ao perfil.
    if pg_trigger_depth() > 1 and old.added_by is not null and new.added_by is null
       and new.job_id = old.job_id and new.id = old.id
       and new.title = old.title and new.kind = old.kind and new.url = old.url
       and new.created_at = old.created_at
       and not exists (select 1 from public.profiles p where p.id = old.added_by) then
      return new;
    end if;

    if new.job_id is distinct from old.job_id or new.added_by is distinct from old.added_by then
      raise check_violation using message = 'O trabalho e o autor da mídia não podem ser alterados.';
    end if;
  else
    new.added_by := auth.uid();
  end if;

  if current_setting('role') = 'authenticated' and not public.is_staff() then
    raise insufficient_privilege;
  end if;

  if new.url is null or char_length(new.url) > 2000
     or new.url !~ '^https://(drive|docs)\.google\.com/[^[:space:]]+$' then
    raise check_violation using message = 'Use um link do Google Drive.';
  end if;
  if new.title is null or btrim(new.title) <> new.title
     or char_length(new.title) not between 1 and 120 then
    raise check_violation using message = 'Use um título de 1 a 120 caracteres, sem espaços nas pontas.';
  end if;

  -- Serializa as escritas de mídia do mesmo trabalho antes da consulta de duplicidade.
  perform pg_advisory_xact_lock(hashtextextended('retratus.media_items:' || new.job_id::text, 0));
  select j.status into job_status from public.jobs j where j.id = new.job_id for share;
  if job_status is null or job_status not in ('publicado', 'realizado') then
    raise check_violation using message = 'Mídias só entram em trabalhos publicados ou realizados.';
  end if;

  if exists (
    select 1 from public.media_items m
    where m.job_id = new.job_id and m.url = new.url
      and m.id is distinct from previous_id
  ) then
    raise unique_violation using message = 'Este link já está neste trabalho.';
  end if;
  return new;
end;
$$;

create trigger media_items_guard before insert or update on public.media_items
for each row execute function retratus_private.guard_media_item();

-- A marca permanece se as mídias ou os avisos forem apagados.
create table retratus_private.jobs_with_media (
  job_id uuid primary key references public.jobs on delete cascade
);

revoke all on retratus_private.jobs_with_media from public, anon, authenticated, service_role;

insert into retratus_private.jobs_with_media (job_id)
select distinct job_id from public.media_items;

create function retratus_private.notify_first_job_media() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into retratus_private.jobs_with_media (job_id) values (new.job_id)
  on conflict (job_id) do nothing;
  if not found then
    return new;
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  select recipient.id, 'midia', 'Mídias adicionadas',
    j.title || ': ' || author.full_name || ' adicionou o primeiro link.',
    '/midias/' || j.id::text
  from public.jobs j
  join public.profiles author on author.id = new.added_by
  cross join public.profiles recipient
  where j.id = new.job_id
    and recipient.approved and recipient.role in ('owner', 'manager')
    and recipient.id <> new.added_by;
  return new;
end;
$$;

create trigger media_items_notify_first after insert on public.media_items
for each row execute function retratus_private.notify_first_job_media();

revoke execute on function retratus_private.guard_media_item(),
  retratus_private.notify_first_job_media() from public, anon, authenticated, service_role;

create function public.media_overview(p_from timestamptz, p_to timestamptz)
returns table (
  job_id uuid, title text, type public.job_type, status public.job_status,
  city text, location text, client_name text,
  first_start timestamptz, last_end timestamptz, day_count bigint,
  team_count bigint, media_count bigint, fotos bigint, videos bigint, pastas bigint,
  last_added_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise insufficient_privilege;
  end if;

  return query
  select j.id, j.title, j.type, j.status, j.city, j.location, c.name,
    days.first_start, days.last_end, days.day_count, team.team_count,
    media.media_count, media.fotos, media.videos, media.pastas, media.last_added_at
  from public.jobs j
  left join public.clients c on c.id = j.client_id
  cross join lateral (
    select min(d.starts_at) as first_start, max(d.ends_at) as last_end, count(*) as day_count,
      bool_or(d.starts_at < p_to and d.ends_at > p_from) as in_period
    from public.job_days d where d.job_id = j.id
  ) days
  cross join lateral (
    select count(distinct s.promoter_id) as team_count
    from public.selections s where s.job_id = j.id
  ) team
  cross join lateral (
    select count(*) as media_count,
      count(*) filter (where m.kind = 'foto') as fotos,
      count(*) filter (where m.kind = 'video') as videos,
      count(*) filter (where m.kind = 'pasta') as pastas,
      max(m.created_at) as last_added_at
    from public.media_items m where m.job_id = j.id
  ) media
  where j.status in ('publicado', 'realizado') and days.in_period
  order by days.first_start, j.id;
end;
$$;

create function public.job_media(p_job_id uuid)
returns table (
  id uuid, url text, kind public.media_kind, title text,
  added_by uuid, added_by_name text, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise insufficient_privilege;
  end if;

  return query
  select m.id, m.url, m.kind, m.title, m.added_by, p.full_name, m.created_at
  from public.media_items m
  left join public.profiles p on p.id = m.added_by
  where m.job_id = p_job_id
  order by m.created_at desc, m.id;
end;
$$;

revoke execute on function public.media_overview(timestamptz, timestamptz),
  public.job_media(uuid) from public, anon, service_role;
grant execute on function public.media_overview(timestamptz, timestamptz),
  public.job_media(uuid) to authenticated;
