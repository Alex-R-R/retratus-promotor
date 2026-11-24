-- Os triggers BEFORE STATEMENT de lock_schedule continuam adquirindo o lock
-- antes de qualquer escrita ou validação de linhas da escala.
create or replace function retratus_private.check_schedule() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  affected public.selection_days[];
  violation text;
begin
  if tg_table_name = 'job_slots' then
    if exists (
      select 1
      from schedule_new slot
      join public.jobs j on j.id = slot.job_id and j.status <> 'cancelado'
      join public.selections s on (s.job_id, s.equipment) = (slot.job_id, slot.equipment)
      join public.selection_days sd on sd.selection_id = s.id
      group by slot.id, slot.capacity, sd.job_day_id
      having count(*) > slot.capacity
    ) then
      raise check_violation using message = 'Capacidade do equipamento excedida neste dia.';
    end if;
    return null;
  elsif tg_table_name = 'selection_days' then
    select array_agg(row(n.selection_id, n.job_day_id)::public.selection_days)
    into affected from schedule_new n;
  elsif tg_table_name = 'selections' then
    select array_agg(sd) into affected
    from schedule_new n
    left join schedule_old o on o.id = n.id
    join public.selection_days sd on sd.selection_id = n.id
    where (n.job_id, n.promoter_id, n.equipment)
      is distinct from (o.job_id, o.promoter_id, o.equipment);
  elsif tg_table_name = 'job_days' then
    select array_agg(sd) into affected
    from schedule_new n
    left join schedule_old o on o.id = n.id
    join public.selection_days sd on sd.job_day_id = n.id
    where (n.job_id, n.starts_at, n.ends_at)
      is distinct from (o.job_id, o.starts_at, o.ends_at);
  elsif tg_table_name = 'jobs' then
    select array_agg(sd) into affected
    from schedule_new n
    join schedule_old o on o.id = n.id and o.status = 'cancelado'
    join public.selections s on s.job_id = n.id
    join public.selection_days sd on sd.selection_id = s.id
    where n.status <> 'cancelado';
  end if;

  if affected is null then
    return null;
  end if;

  -- Os dois lados de um conflito podem vir do mesmo statement. Compara cada
  -- linha afetada com as demais do promotor e exclui apenas a própria linha.
  with changed as materialized (
    select sd.selection_id, sd.job_day_id, s.job_id, s.promoter_id, s.equipment,
      d.job_id as day_job_id, d.starts_at, d.ends_at, j.status
    from unnest(affected) sd
    join public.selections s on s.id = sd.selection_id
    join public.job_days d on d.id = sd.job_day_id
    join public.jobs j on j.id = s.job_id
  )
  select case
    when exists (select 1 from changed a where a.job_id <> a.day_job_id)
      then 'Dia de seleção pertence a outro trabalho.'
    when exists (
      select 1 from changed a
      join public.selections s on s.promoter_id = a.promoter_id
      join public.jobs j on j.id = s.job_id and j.status <> 'cancelado'
      join public.selection_days sd on sd.selection_id = s.id
      join public.job_days d on d.id = sd.job_day_id
      where a.status <> 'cancelado'
        and (a.selection_id, a.job_day_id) <> (sd.selection_id, sd.job_day_id)
        and a.starts_at < d.ends_at and d.starts_at < a.ends_at
    ) then 'Promotor já selecionado em horário sobreposto.'
    when exists (
      select 1
      from (select distinct job_day_id, job_id, equipment from changed where status <> 'cancelado') a
      join public.job_slots slot on (slot.job_id, slot.equipment) = (a.job_id, a.equipment)
      where (
        select count(*) from public.selection_days sd
        join public.selections s on s.id = sd.selection_id
        where sd.job_day_id = a.job_day_id
          and (s.job_id, s.equipment) = (a.job_id, a.equipment)
      ) > slot.capacity
    ) then 'Capacidade do equipamento excedida neste dia.'
  end into violation;

  if violation is not null then
    raise check_violation using message = violation;
  end if;
  return null;
end;
$$;

drop trigger check_selection_days on public.selection_days;
drop trigger check_selection_changes on public.selections;
drop trigger check_job_day_changes on public.job_days;
drop trigger check_capacity_changes on public.job_slots;

create trigger check_selection_days_insert after insert on public.selection_days
referencing new table as schedule_new
for each statement execute function retratus_private.check_schedule();
create trigger check_selection_days_update after update on public.selection_days
referencing new table as schedule_new
for each statement execute function retratus_private.check_schedule();
create trigger check_selection_changes after update on public.selections
referencing old table as schedule_old new table as schedule_new
for each statement execute function retratus_private.check_schedule();
create trigger check_job_day_changes after update on public.job_days
referencing old table as schedule_old new table as schedule_new
for each statement execute function retratus_private.check_schedule();
create trigger check_job_reactivation after update on public.jobs
referencing old table as schedule_old new table as schedule_new
for each statement execute function retratus_private.check_schedule();
create trigger check_capacity_insert after insert on public.job_slots
referencing new table as schedule_new
for each statement execute function retratus_private.check_schedule();
create trigger check_capacity_update after update on public.job_slots
referencing new table as schedule_new
for each statement execute function retratus_private.check_schedule();

-- A escrita direta pela gestão precisa da mesma validação que select_promoter.
create function retratus_private.check_selection_promoter() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.promoter_id is not distinct from old.promoter_id then
    return new;
  end if;
  if not exists (
    select 1 from public.profiles
    where id = new.promoter_id and role = 'promoter' and approved
    for share
  ) then
    raise check_violation using message = 'Seleção exige promotor aprovado.';
  end if;
  return new;
end;
$$;

create trigger check_selection_promoter before insert or update of promoter_id on public.selections
for each row execute function retratus_private.check_selection_promoter();

-- O banco controla a identidade e a data de criação da candidatura.
revoke insert on public.applications from authenticated;
grant insert (job_id, promoter_id, equipment) on public.applications to authenticated;

-- Os triggers executam como antes. Apenas o helper de RLS é invocável pelo cliente.
revoke all on schema retratus_private from public, anon;
revoke execute on all functions in schema retratus_private from public, anon, authenticated;
grant execute on function retratus_private.promoter_can_read_job(uuid) to authenticated;

-- Remover alguém da escala apagaria o pagamento em cascata. Pagamento já feito precisa ficar registrado.
create function retratus_private.guard_paid_selection() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.payments pay where pay.selection_id = old.id and pay.paid_at is not null) then
    raise check_violation using message = 'Este promotor já foi pago por este trabalho. Os donos precisam desmarcar o pagamento antes de removê-lo da escala.';
  end if;
  return old;
end;
$$;

create trigger guard_paid_selection before delete on public.selections
for each row execute function retratus_private.guard_paid_selection();

revoke execute on function retratus_private.guard_paid_selection() from public, anon, authenticated;
