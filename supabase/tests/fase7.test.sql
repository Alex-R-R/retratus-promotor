begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

-- Usuários do seed: 0002 gestão, 0003 mídia, 0004 promotor aprovado.
insert into jobs (id, type, title, status) values
  ('f7000000-0000-0000-0001-000000000001', 'acao', 'Ação já começada', 'publicado'),
  ('f7000000-0000-0000-0001-000000000002', 'evento', 'Evento pago', 'publicado'),
  ('f7000000-0000-0000-0001-000000000003', 'evento', 'Evento futuro', 'publicado'),
  ('f7000000-0000-0000-0001-000000000004', 'evento', 'Rascunho escalado', 'rascunho');
insert into job_days (id, job_id, starts_at, ends_at) values
  ('f7000000-0000-0000-0002-000000000001', 'f7000000-0000-0000-0001-000000000001', now() - interval '1 day', now() - interval '20 hours'),
  ('f7000000-0000-0000-0002-000000000002', 'f7000000-0000-0000-0001-000000000001', now() + interval '1 day', now() + interval '28 hours'),
  ('f7000000-0000-0000-0002-000000000003', 'f7000000-0000-0000-0001-000000000002', '2099-08-01 18:00-03', '2099-08-01 22:00-03'),
  ('f7000000-0000-0000-0002-000000000004', 'f7000000-0000-0000-0001-000000000003', '2099-08-02 18:00-03', '2099-08-02 22:00-03'),
  ('f7000000-0000-0000-0002-000000000005', 'f7000000-0000-0000-0001-000000000004', '2099-08-03 18:00-03', '2099-08-03 22:00-03');
insert into job_slots (job_id, equipment, capacity) values
  ('f7000000-0000-0000-0001-000000000002', 'Totem', 1),
  ('f7000000-0000-0000-0001-000000000004', 'Totem', 1);
insert into selections (id, job_id, promoter_id, equipment) values
  ('f7000000-0000-0000-0003-000000000001', 'f7000000-0000-0000-0001-000000000002', '10000000-0000-0000-0000-000000000004', 'Totem'),
  ('f7000000-0000-0000-0003-000000000002', 'f7000000-0000-0000-0001-000000000004', '10000000-0000-0000-0000-000000000004', 'Totem');
insert into selection_days values
  ('f7000000-0000-0000-0003-000000000001', 'f7000000-0000-0000-0002-000000000003'),
  ('f7000000-0000-0000-0003-000000000002', 'f7000000-0000-0000-0002-000000000005');
insert into payments (selection_id, amount, source, paid_at)
values ('f7000000-0000-0000-0003-000000000001', 130, 'manual', now())
on conflict (selection_id) do update set paid_at = now();

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- Cancelar não pode esconder o que já foi trabalhado ou pago.
select throws_ok($$select cancel_job('f7000000-0000-0000-0001-000000000001', 'Teste')$$,
  '23514', 'Trabalho que já começou não pode ser cancelado.', 'Não cancela trabalho já começado');
select throws_ok($$select cancel_job('f7000000-0000-0000-0001-000000000002', 'Teste')$$,
  '23514', 'Este trabalho tem pagamento feito. Os donos precisam desmarcar o pagamento antes de cancelar.',
  'Não cancela trabalho com pagamento feito');
select lives_ok($$select cancel_job('f7000000-0000-0000-0001-000000000003', 'Teste')$$,
  'Cancela trabalho futuro sem pagamento');

-- Promotor escalado num rascunho vê o dia na própria agenda; mídia continua sem ver rascunhos.
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';
select results_eq(
  $$select day_id, status::text from calendar('2099-08-03 00:00-03', '2099-08-04 00:00-03')$$,
  $$values ('f7000000-0000-0000-0002-000000000005'::uuid, 'rascunho')$$,
  'Promotor vê o dia de rascunho em que foi escalado');

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is_empty($$select day_id from calendar('2099-08-03 00:00-03', '2099-08-04 00:00-03')$$,
  'Promotor não escalado não vê o rascunho');

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is_empty($$select day_id from calendar('2099-08-03 00:00-03', '2099-08-04 00:00-03')$$,
  'Mídia não vê rascunhos');

select * from finish();
rollback;
