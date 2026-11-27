begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

-- Usuários do seed: 0001 dona, 0002 gestão, 0003 mídia, 0004 a 0009 promotores aprovados.
insert into clients (id, name) values ('f7000000-0000-0000-0000-000000000001', 'Cliente do rascunho');
insert into jobs (id, type, title, client_id, status) values
  ('f7000000-0000-0000-0001-000000000001', 'acao', 'Ação já começada', null, 'publicado'),
  ('f7000000-0000-0000-0001-000000000002', 'evento', 'Evento pago', null, 'publicado'),
  ('f7000000-0000-0000-0001-000000000003', 'evento', 'Evento futuro', null, 'publicado'),
  ('f7000000-0000-0000-0001-000000000004', 'acao', 'Rascunho escalado', 'f7000000-0000-0000-0000-000000000001', 'rascunho'),
  ('f7000000-0000-0000-0001-000000000005', 'evento', 'Rascunho esquecido', null, 'rascunho');
insert into job_days (id, job_id, starts_at, ends_at) values
  ('f7000000-0000-0000-0002-000000000001', 'f7000000-0000-0000-0001-000000000001', now() - interval '1 day', now() - interval '20 hours'),
  ('f7000000-0000-0000-0002-000000000002', 'f7000000-0000-0000-0001-000000000001', now() + interval '1 day', now() + interval '28 hours'),
  ('f7000000-0000-0000-0002-000000000003', 'f7000000-0000-0000-0001-000000000002', '2099-08-01 18:00-03', '2099-08-01 22:00-03'),
  ('f7000000-0000-0000-0002-000000000004', 'f7000000-0000-0000-0001-000000000003', '2099-08-02 18:00-03', '2099-08-02 22:00-03'),
  ('f7000000-0000-0000-0002-000000000005', 'f7000000-0000-0000-0001-000000000004', '2099-08-03 18:00-03', '2099-08-03 22:00-03'),
  ('f7000000-0000-0000-0002-000000000006', 'f7000000-0000-0000-0001-000000000004', '2099-08-03 12:00-03', '2099-08-03 14:00-03'),
  ('f7000000-0000-0000-0002-000000000007', 'f7000000-0000-0000-0001-000000000005', now() - interval '2 days', now() - interval '44 hours');
insert into job_slots (job_id, equipment, capacity) values
  ('f7000000-0000-0000-0001-000000000002', 'Totem', 1),
  ('f7000000-0000-0000-0001-000000000003', 'Totem', 1),
  ('f7000000-0000-0000-0001-000000000004', 'Totem', 2);
insert into selections (id, job_id, promoter_id, equipment) values
  ('f7000000-0000-0000-0003-000000000001', 'f7000000-0000-0000-0001-000000000002', '10000000-0000-0000-0000-000000000004', 'Totem'),
  ('f7000000-0000-0000-0003-000000000002', 'f7000000-0000-0000-0001-000000000004', '10000000-0000-0000-0000-000000000004', 'Totem'),
  ('f7000000-0000-0000-0003-000000000003', 'f7000000-0000-0000-0001-000000000004', '10000000-0000-0000-0000-000000000005', 'Totem'),
  ('f7000000-0000-0000-0003-000000000004', 'f7000000-0000-0000-0001-000000000003', '10000000-0000-0000-0000-000000000006', 'Totem');
insert into selection_days values
  ('f7000000-0000-0000-0003-000000000001', 'f7000000-0000-0000-0002-000000000003'),
  ('f7000000-0000-0000-0003-000000000002', 'f7000000-0000-0000-0002-000000000005'),
  ('f7000000-0000-0000-0003-000000000003', 'f7000000-0000-0000-0002-000000000006'),
  ('f7000000-0000-0000-0003-000000000004', 'f7000000-0000-0000-0002-000000000004');
insert into payments (selection_id, amount, source, paid_at) values
  ('f7000000-0000-0000-0003-000000000001', 130, 'manual', now()),
  ('f7000000-0000-0000-0003-000000000004', 130, 'manual', null)
on conflict (selection_id) do update set amount = excluded.amount, source = excluded.source, paid_at = excluded.paid_at;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- Cancelar não pode esconder o que já foi trabalhado ou pago, nem pela RPC nem por escrita direta.
select throws_ok($$select cancel_job('f7000000-0000-0000-0001-000000000001', 'Teste')$$,
  '23514', 'Trabalho que já começou não pode ser cancelado.', 'Não cancela trabalho já começado');
select throws_ok($$update jobs set status = 'cancelado' where id = 'f7000000-0000-0000-0001-000000000001'$$,
  '23514', 'Trabalho que já começou não pode ser cancelado.', 'Escrita direta também não cancela trabalho já começado');
select throws_ok($$select cancel_job('f7000000-0000-0000-0001-000000000002', 'Teste')$$,
  '23514', 'Este trabalho tem pagamento feito. Os donos precisam desmarcar o pagamento antes de cancelar.',
  'Não cancela trabalho com pagamento feito');
select lives_ok($$select cancel_job('f7000000-0000-0000-0001-000000000003', 'Teste')$$,
  'Cancela trabalho futuro sem pagamento');
select lives_ok($$select cancel_job('f7000000-0000-0000-0001-000000000005', 'Teste')$$,
  'Rascunho com data passada ainda pode ser cancelado');

-- Na ordem inversa, trabalho já cancelado não recebe pagamento.
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select set_paid(array['f7000000-0000-0000-0003-000000000004']::uuid[], true)$$,
  '23514', 'Trabalho cancelado não recebe pagamento.', 'Não marca pagamento de trabalho cancelado');

-- Promotor escalado num rascunho vê só o próprio dia, sem vagas nem contratante.
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';
select results_eq(
  $$select day_id, status::text, promoters, slots, client_name
    from calendar('2099-08-03 00:00-03', '2099-08-04 00:00-03')$$,
  $$values ('f7000000-0000-0000-0002-000000000005'::uuid, 'rascunho',
    '[{"promoter_id":"10000000-0000-0000-0000-000000000004","full_name":"Promotor fictício 01","equipment":"Totem"}]'::jsonb,
    null::jsonb, null::text)$$,
  'Promotor vê só o próprio dia de rascunho');

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}';
select is_empty($$select day_id from calendar('2099-08-03 00:00-03', '2099-08-04 00:00-03')$$,
  'Promotor não escalado não vê o rascunho');

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is_empty($$select day_id from calendar('2099-08-03 00:00-03', '2099-08-04 00:00-03')$$,
  'Mídia não vê rascunhos');

select * from finish();
rollback;
