alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.jobs enable row level security;
alter table public.job_days enable row level security;
alter table public.job_slots enable row level security;
alter table public.applications enable row level security;
alter table public.selections enable row level security;
alter table public.selection_days enable row level security;
alter table public.event_pay_rates enable row level security;
alter table public.pay_settings enable row level security;
alter table public.payments enable row level security;
alter table public.media_items enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- Remover os privilégios padrão do Supabase, inclusive TRUNCATE, que ignora RLS.
revoke all on public.profiles, public.clients, public.jobs, public.job_days, public.job_slots, public.applications, public.selections, public.selection_days, public.event_pay_rates, public.pay_settings, public.payments, public.media_items, public.notifications, public.audit_log
from public, anon, authenticated;

grant select, insert, update, delete on public.profiles,
  public.clients, public.jobs, public.job_days, public.job_slots, public.selections, public.selection_days,
  public.event_pay_rates, public.pay_settings, public.payments, public.media_items
to authenticated;
grant select, insert, delete on public.applications to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create function retratus_private.promoter_can_read_job(p_job_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.current_role() = 'promoter' and (
    exists (
      select 1 from public.jobs j join public.job_days d on d.job_id = j.id
      where j.id = p_job_id and j.status = 'publicado' and d.starts_at > now()
    )
    or exists (
      select 1 from public.selections s
      where s.job_id = p_job_id and s.promoter_id = auth.uid()
    )
  )
$$;

grant usage on schema retratus_private to authenticated;
revoke execute on function retratus_private.promoter_can_read_job(uuid) from public;
grant execute on function retratus_private.promoter_can_read_job(uuid) to authenticated;

create policy profiles_owner on public.profiles for all to authenticated
using ((select public.current_role()) = 'owner')
with check ((select public.current_role()) = 'owner');

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.current_role()) = 'manager');

create policy profiles_promoter_update on public.profiles for update to authenticated
using (id = (select auth.uid()) and (select public.current_role()) = 'promoter')
with check (id = (select auth.uid()) and (select public.current_role()) = 'promoter');

create function retratus_private.guard_profile_update() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and public.current_role() is distinct from 'owner'
     and (new.id, new.email, new.role, new.link, new.approved, new.created_at)
         is distinct from (old.id, old.email, old.role, old.link, old.approved, old.created_at)
  then
    raise insufficient_privilege using message = 'Somente nome e telefone podem ser editados.';
  end if;
  return new;
end;
$$;

revoke execute on function retratus_private.guard_profile_update() from public;
create trigger guard_profile_update before update on public.profiles
for each row execute function retratus_private.guard_profile_update();

create policy clients_manage on public.clients for all to authenticated
using ((select public.current_role()) in ('owner', 'manager'))
with check ((select public.current_role()) in ('owner', 'manager'));
create policy clients_media_read on public.clients for select to authenticated
using ((select public.current_role()) = 'media');

create policy jobs_manage on public.jobs for all to authenticated
using ((select public.current_role()) in ('owner', 'manager'))
with check ((select public.current_role()) in ('owner', 'manager'));
create policy jobs_media_read on public.jobs for select to authenticated
using ((select public.current_role()) = 'media');

create policy job_days_manage on public.job_days for all to authenticated
using ((select public.current_role()) in ('owner', 'manager'))
with check ((select public.current_role()) in ('owner', 'manager'));
create policy job_days_media_read on public.job_days for select to authenticated
using ((select public.current_role()) = 'media');

create policy job_slots_manage on public.job_slots for all to authenticated
using ((select public.current_role()) in ('owner', 'manager'))
with check ((select public.current_role()) in ('owner', 'manager'));
create policy job_slots_media_read on public.job_slots for select to authenticated
using ((select public.current_role()) = 'media');

create policy selections_manage on public.selections for all to authenticated
using ((select public.current_role()) in ('owner', 'manager'))
with check ((select public.current_role()) in ('owner', 'manager'));
create policy selections_media_read on public.selections for select to authenticated
using ((select public.current_role()) = 'media');

create policy selection_days_manage on public.selection_days for all to authenticated
using ((select public.current_role()) in ('owner', 'manager'))
with check ((select public.current_role()) in ('owner', 'manager'));
create policy selection_days_media_read on public.selection_days for select to authenticated
using ((select public.current_role()) = 'media');

create policy jobs_promoter_read on public.jobs for select to authenticated
using (retratus_private.promoter_can_read_job(id));
create policy job_days_promoter_read on public.job_days for select to authenticated
using (retratus_private.promoter_can_read_job(job_id));
create policy job_slots_promoter_read on public.job_slots for select to authenticated
using (retratus_private.promoter_can_read_job(job_id));

create policy applications_management_read on public.applications for select to authenticated
using ((select public.current_role()) in ('owner', 'manager'));
create policy applications_promoter_select on public.applications for select to authenticated
using (promoter_id = (select auth.uid()) and (select public.current_role()) = 'promoter');
create policy applications_promoter_insert on public.applications for insert to authenticated
with check (promoter_id = (select auth.uid()) and (select public.current_role()) = 'promoter');
create policy applications_promoter_delete on public.applications for delete to authenticated
using (promoter_id = (select auth.uid()) and (select public.current_role()) = 'promoter');

create policy selections_promoter_read on public.selections for select to authenticated
using (promoter_id = (select auth.uid()) and (select public.current_role()) = 'promoter');
create policy selection_days_promoter_read on public.selection_days for select to authenticated
using (
  (select public.current_role()) = 'promoter' and exists (
    select 1 from public.selections s
    where s.id = selection_id and s.promoter_id = (select auth.uid())
  )
);

create policy event_pay_rates_owner on public.event_pay_rates for all to authenticated
using ((select public.current_role()) = 'owner')
with check ((select public.current_role()) = 'owner');
create policy pay_settings_owner on public.pay_settings for all to authenticated
using ((select public.current_role()) = 'owner')
with check ((select public.current_role()) = 'owner');
create policy payments_owner on public.payments for all to authenticated
using ((select public.current_role()) = 'owner')
with check ((select public.current_role()) = 'owner');

create policy media_items_manage on public.media_items for all to authenticated
using ((select public.current_role()) in ('owner', 'manager'))
with check ((select public.current_role()) in ('owner', 'manager'));
create policy media_items_media_read on public.media_items for select to authenticated
using ((select public.current_role()) = 'media');
create policy media_items_media_insert on public.media_items for insert to authenticated
with check ((select public.current_role()) = 'media');
create policy media_items_media_update on public.media_items for update to authenticated
using ((select public.current_role()) = 'media')
with check ((select public.current_role()) = 'media');

create policy notifications_read on public.notifications for select to authenticated
using (user_id = (select auth.uid()) and (select public.current_role()) is not null);
create policy notifications_mark_read on public.notifications for update to authenticated
using (user_id = (select auth.uid()) and (select public.current_role()) is not null)
with check (
  user_id = (select auth.uid()) and (select public.current_role()) is not null and read_at is not null
);

