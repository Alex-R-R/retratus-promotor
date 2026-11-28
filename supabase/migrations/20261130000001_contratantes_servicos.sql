-- Contratantes e serviços de ação (Claude). Revisão: Codex.

-- 1. Contratante: tipo de trabalho que atende e se está na lista fixa.
--    Avulso (listed = false) é criado na hora no formulário do trabalho: fica
--    ligado àquele trabalho e não aparece na escolha dos próximos.
create type public.client_kind as enum ('evento', 'acao', 'ambos');

alter table public.clients
  add column kind public.client_kind not null default 'ambos',
  add column listed boolean not null default true;

-- 2. Ação aceita serviço digitado à mão. Evento continua só com os equipamentos padrão.
alter table public.job_slots drop constraint job_slots_equipment_check;
alter table public.job_slots add constraint job_slots_equipment_check
  check (equipment = btrim(equipment) and char_length(equipment) between 2 and 60);

-- Checado no fim da transação: save_job troca o tipo antes de trocar as vagas.
create function retratus_private.check_event_equipment() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  target_job uuid;
begin
  if tg_table_name = 'jobs' then
    target_job := new.id;
  else
    target_job := new.job_id;
  end if;
  if exists (
    select 1 from public.job_slots s join public.jobs j on j.id = s.job_id
    where s.job_id = target_job and j.type = 'evento'
      and s.equipment not in ('Totem', 'Self print', 'Totem slim', 'Plataforma 360', 'Túnel de LED', 'Máquina de garra')
  ) then
    raise check_violation using message = 'Evento usa só os equipamentos padrão. Serviço digitado vale para ação.';
  end if;
  return null;
end;
$$;

create constraint trigger event_standard_equipment after insert or update on public.job_slots
deferrable initially deferred
for each row execute function retratus_private.check_event_equipment();

create constraint trigger event_standard_equipment after update of type on public.jobs
deferrable initially deferred
for each row execute function retratus_private.check_event_equipment();

revoke execute on function retratus_private.check_event_equipment()
from public, anon, authenticated, service_role;

-- 3. Serviços de ação guardados para aparecer nas próximas ações.
create table public.action_services (
  name text primary key check (name = btrim(name) and char_length(name) between 2 and 60),
  created_at timestamptz not null default now()
);

alter table public.action_services enable row level security;
revoke all on public.action_services from public, anon, authenticated;
grant select, insert, delete on public.action_services to authenticated;

create policy action_services_manage on public.action_services for all to authenticated
using ((select public.current_role()) in ('owner', 'manager'))
with check ((select public.current_role()) in ('owner', 'manager'));
