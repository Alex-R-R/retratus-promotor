begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(48);

insert into jobs (id, type, title, status) values
  ('f4000000-0000-0000-0000-100000000001', 'evento', 'Evento de quatro horas', 'publicado'),
  ('f4000000-0000-0000-0000-100000000002', 'evento', 'Evento de três horas', 'publicado'),
  ('f4000000-0000-0000-0000-100000000003', 'evento', 'Evento de cinco horas', 'publicado'),
  ('f4000000-0000-0000-0000-100000000004', 'evento', 'Evento a cancelar', 'publicado'),
  ('f4000000-0000-0000-0000-100000000005', 'acao', 'Ação na virada do mês', 'publicado');
insert into job_days (id, job_id, starts_at, ends_at) values
  ('f4000000-0000-0000-0000-200000000001', 'f4000000-0000-0000-0000-100000000001', '2099-06-01 10:00-03', '2099-06-01 14:00-03'),
  ('f4000000-0000-0000-0000-200000000002', 'f4000000-0000-0000-0000-100000000002', '2099-06-02 10:00-03', '2099-06-02 13:00-03'),
  ('f4000000-0000-0000-0000-200000000003', 'f4000000-0000-0000-0000-100000000003', '2099-06-03 10:00-03', '2099-06-03 15:00-03'),
  ('f4000000-0000-0000-0000-200000000004', 'f4000000-0000-0000-0000-100000000004', '2099-06-04 10:00-03', '2099-06-04 14:00-03'),
  ('f4000000-0000-0000-0000-200000000005', 'f4000000-0000-0000-0000-100000000005', '2099-07-31 10:00-03', '2099-07-31 13:00-03'),
  ('f4000000-0000-0000-0000-200000000006', 'f4000000-0000-0000-0000-100000000005', '2099-08-01 10:00-03', '2099-08-01 14:00-03');
insert into job_slots (job_id, equipment, capacity)
select id, 'Totem', 1 from jobs where id in ('f4000000-0000-0000-0000-100000000001', 'f4000000-0000-0000-0000-100000000002', 'f4000000-0000-0000-0000-100000000003', 'f4000000-0000-0000-0000-100000000004', 'f4000000-0000-0000-0000-100000000005');
insert into selections (id, job_id, promoter_id, equipment) values
  ('f4000000-0000-0000-0000-300000000001', 'f4000000-0000-0000-0000-100000000001', '10000000-0000-0000-0000-000000000004', 'Totem'),
  ('f4000000-0000-0000-0000-300000000002', 'f4000000-0000-0000-0000-100000000002', '10000000-0000-0000-0000-000000000004', 'Totem'),
  ('f4000000-0000-0000-0000-300000000003', 'f4000000-0000-0000-0000-100000000003', '10000000-0000-0000-0000-000000000004', 'Totem'),
  ('f4000000-0000-0000-0000-300000000004', 'f4000000-0000-0000-0000-100000000004', '10000000-0000-0000-0000-000000000004', 'Totem'),
  ('f4000000-0000-0000-0000-300000000005', 'f4000000-0000-0000-0000-100000000005', '10000000-0000-0000-0000-000000000004', 'Totem');
insert into selection_days (selection_id, job_day_id) values
  ('f4000000-0000-0000-0000-300000000001', 'f4000000-0000-0000-0000-200000000001'),
  ('f4000000-0000-0000-0000-300000000002', 'f4000000-0000-0000-0000-200000000002'),
  ('f4000000-0000-0000-0000-300000000003', 'f4000000-0000-0000-0000-200000000003'),
  ('f4000000-0000-0000-0000-300000000004', 'f4000000-0000-0000-0000-200000000004'),
  ('f4000000-0000-0000-0000-300000000005', 'f4000000-0000-0000-0000-200000000005'),
  ('f4000000-0000-0000-0000-300000000005', 'f4000000-0000-0000-0000-200000000006');

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
select results_eq(
  $$select amount, source, suggested from payments_overview('2099-06-01 00:00-03', '2099-07-01 00:00-03') where selection_id = 'f4000000-0000-0000-0000-300000000001'$$,
  $$values (130::numeric, 'tabela'::pay_source, 130::numeric)$$, 'Evento de 4h recebe a sugestão de 130');
select is((select count(*) from payments where selection_id = 'f4000000-0000-0000-0000-300000000002'), 0::bigint,
  'Evento de 3h sem faixa não tem pagamento');
select throws_ok($$select set_paid(array['f4000000-0000-0000-0000-300000000001', 'f4000000-0000-0000-0000-300000000002']::uuid[], true)$$,
  '23514', null, 'Marcação em lote recusa seleção sem valor');
select is((select paid_at from payments where selection_id = 'f4000000-0000-0000-0000-300000000001'), null::timestamptz,
  'Lote recusado não marca outro pagamento');
select is((select sem_valor from promoter_job_counts('2099-06-01 00:00-03', '2099-07-01 00:00-03') where promoter_id = '10000000-0000-0000-0000-000000000004'), 2::bigint,
  'Dona vê o número de seleções sem valor');
select is((select count(*) from promoter_job_counts('2099-06-01 00:00-03', '2099-07-01 00:00-03')
    where promoter_id = '10000000-0000-0000-0000-000000000010'), 0::bigint, 'Omite promotor pendente sem trabalho');

insert into event_pay_rates (hours, amount) values (3, 100);
select is((select amount from payments where selection_id = 'f4000000-0000-0000-0000-300000000002'), 100::numeric,
  'Nova faixa cria pagamento para seleção existente');
delete from event_pay_rates where hours = 3;
select is((select count(*) from payments where selection_id = 'f4000000-0000-0000-0000-300000000002'), 0::bigint,
  'Remover a faixa apaga a sugestão sem regra');
insert into event_pay_rates (hours, amount) values (3, 100);
update pay_settings set extra_hour_amount = 35 where id;
select is((select amount from payments where selection_id = 'f4000000-0000-0000-0000-300000000003'), 165::numeric,
  'Evento de 5h usa a faixa de 4h e uma hora extra');

select lives_ok($$select set_payment('f4000000-0000-0000-0000-300000000001', 200)$$, 'Dona grava valor manual');
select is(set_paid(array['f4000000-0000-0000-0000-300000000003']::uuid[], true), 1, 'Dona marca o pagamento de tabela');
select is(set_paid(array['f4000000-0000-0000-0000-300000000003']::uuid[], true), 0, 'Repetir a marcação não altera a linha');
update event_pay_rates set amount = 150 where hours = 4;
select results_eq(
  $$select amount, source, suggested from payments_overview('2099-06-01 00:00-03', '2099-07-01 00:00-03') where selection_id = 'f4000000-0000-0000-0000-300000000001'$$,
  $$values (200::numeric, 'manual'::pay_source, 150::numeric)$$, 'Alterar faixa preserva o valor manual');
select results_eq(
  $$select amount, suggested, paid_at is not null from payments_overview('2099-06-01 00:00-03', '2099-07-01 00:00-03') where selection_id = 'f4000000-0000-0000-0000-300000000003'$$,
  $$values (165::numeric, 185::numeric, true)$$, 'Alterar faixa preserva o valor pago');
select throws_ok($$select set_payment('f4000000-0000-0000-0000-300000000003', 210)$$, '23514', null, 'Recusa alteração de valor pago');
select throws_ok($$select set_payment('f4000000-0000-0000-0000-300000000003', null)$$, '23514', null, 'Recusa restaurar sugestão de valor pago');
select throws_ok($$select set_payment('f4000000-0000-0000-0000-300000000001', -1)$$, '23514', null, 'Recusa valor negativo');
select lives_ok($$select set_payment('f4000000-0000-0000-0000-300000000001', null)$$, 'Valor nulo restaura a sugestão');
select results_eq(
  $$select amount, source from payments where selection_id = 'f4000000-0000-0000-0000-300000000001'$$,
  $$values (150::numeric, 'tabela'::pay_source)$$, 'Restaura a faixa atual como valor de tabela');

select save_job('f4000000-0000-0000-0000-100000000001',
  '{"type":"evento","title":"Evento de quatro horas"}',
  '[{"id":"f4000000-0000-0000-0000-200000000001","starts_at":"2099-06-01 10:00-03","ends_at":"2099-06-01 13:00-03"}]',
  '[{"equipment":"Totem","capacity":1}]');
select is((select amount from payments where selection_id = 'f4000000-0000-0000-0000-300000000001'), 100::numeric,
  'Mudar duração com save_job recalcula o valor de tabela');
select cancel_job('f4000000-0000-0000-0000-100000000004', 'Cancelamento fictício');
select throws_ok($$select set_payment('f4000000-0000-0000-0000-300000000004', 80)$$, '23514', null, 'Recusa valor para trabalho cancelado');
select is((select count(*) from payments_overview('2099-06-01 00:00-03', '2099-07-01 00:00-03') where selection_id = 'f4000000-0000-0000-0000-300000000004'),
  0::bigint, 'Cancelado fica fora do extrato');
select results_eq(
  $$select eventos, valor_total, valor_pago, sem_valor from promoter_job_counts('2099-06-01 00:00-03', '2099-07-01 00:00-03') where promoter_id = '10000000-0000-0000-0000-000000000004'$$,
  $$values (3::bigint, 365::numeric, 165::numeric, 0::bigint)$$, 'Totais excluem o evento cancelado');
select is(set_paid(array['f4000000-0000-0000-0000-300000000003']::uuid[], false), 1, 'Dona desmarca o pagamento');
select is((select paid_at from payments where selection_id = 'f4000000-0000-0000-0000-300000000003'), null::timestamptz,
  'Desmarcar limpa a data de pagamento');

select is((select sem_valor from promoter_job_counts('2099-07-01 00:00-03', '2099-08-01 00:00-03') where promoter_id = '10000000-0000-0000-0000-000000000004'),
  1::bigint, 'Seleção sem valor conta no mês do primeiro dia');
select is((select sem_valor from promoter_job_counts('2099-08-01 00:00-03', '2099-09-01 00:00-03') where promoter_id = '10000000-0000-0000-0000-000000000004'),
  0::bigint, 'Seleção sem valor não conta de novo no segundo mês');
select set_payment('f4000000-0000-0000-0000-300000000005', 250);
select results_eq(
  $$select day_count, hours, amount, suggested from payments_overview('2099-07-01 00:00-03', '2099-08-01 00:00-03') where selection_id = 'f4000000-0000-0000-0000-300000000005'$$,
  $$values (2::bigint, 7::numeric, 250::numeric, null::numeric)$$, 'Extrato soma todos os dias da ação no primeiro mês');
select is((select count(*) from payments_overview('2099-08-01 00:00-03', '2099-09-01 00:00-03')), 0::bigint,
  'Ação não aparece no extrato do segundo mês');
select results_eq(
  $$select dias_acao, valor_total from promoter_job_counts('2099-07-01 00:00-03', '2099-08-01 00:00-03') where promoter_id = '10000000-0000-0000-0000-000000000004'$$,
  $$values (1::bigint, 250::numeric)$$, 'Primeiro mês recebe o valor inteiro da ação');
select results_eq(
  $$select dias_acao, valor_total from promoter_job_counts('2099-08-01 00:00-03', '2099-09-01 00:00-03') where promoter_id = '10000000-0000-0000-0000-000000000004'$$,
  $$values (1::bigint, 0::numeric)$$, 'Segundo mês conta o dia de ação sem repetir o valor');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
select results_eq(
  $$select eventos, valor_total, valor_pago, sem_valor from promoter_job_counts('2099-06-01 00:00-03', '2099-07-01 00:00-03') where promoter_id = '10000000-0000-0000-0000-000000000004'$$,
  $$values (3::bigint, null::numeric, null::numeric, null::bigint)$$, 'Gestão vê contagem sem valores');
select throws_ok($$select * from payments_overview('2099-06-01 00:00-03', '2099-07-01 00:00-03')$$, '42501', null, 'Gestão sem acesso ao extrato');
select throws_ok($$select set_payment('f4000000-0000-0000-0000-300000000001', 1)$$, '42501', null, 'Gestão sem acesso à edição');
select throws_ok($$select set_paid(array['f4000000-0000-0000-0000-300000000001']::uuid[], true)$$, '42501', null, 'Gestão sem acesso à marcação');
select is((select count(*) from payments where selection_id = 'f4000000-0000-0000-0000-300000000001'), 0::bigint,
  'Gestão sem acesso direto a valores');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';
select throws_ok($$select * from promoter_job_counts('2099-06-01 00:00-03', '2099-07-01 00:00-03')$$, '42501', null, 'Mídia sem acesso ao ranking');
select throws_ok($$select * from payments_overview('2099-06-01 00:00-03', '2099-07-01 00:00-03')$$, '42501', null, 'Mídia sem acesso ao extrato');
select throws_ok($$select set_payment('f4000000-0000-0000-0000-300000000001', 1)$$, '42501', null, 'Mídia sem acesso à edição');
select throws_ok($$select set_paid(array['f4000000-0000-0000-0000-300000000001']::uuid[], true)$$, '42501', null, 'Mídia sem acesso à marcação');
select is((select count(*) from payments where selection_id = 'f4000000-0000-0000-0000-300000000001'), 0::bigint,
  'Mídia sem acesso direto a valores');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000004';
select throws_ok($$select * from promoter_job_counts('2099-06-01 00:00-03', '2099-07-01 00:00-03')$$, '42501', null, 'Promotor sem acesso ao ranking');
select throws_ok($$select * from payments_overview('2099-06-01 00:00-03', '2099-07-01 00:00-03')$$, '42501', null, 'Promotor sem acesso ao extrato');
select throws_ok($$select set_payment('f4000000-0000-0000-0000-300000000001', 1)$$, '42501', null, 'Promotor sem acesso à edição');
select throws_ok($$select set_paid(array['f4000000-0000-0000-0000-300000000001']::uuid[], true)$$, '42501', null, 'Promotor sem acesso à marcação');
select is((select count(*) from payments where selection_id = 'f4000000-0000-0000-0000-300000000001'), 0::bigint,
  'Promotor sem acesso direto a valores');

reset role;
select ok(not has_function_privilege('anon', 'public.payments_overview(timestamptz,timestamptz)', 'execute'),
  'Anônimo sem permissão de execução no extrato');
select ok(not has_function_privilege('service_role', 'public.set_paid(uuid[],boolean)', 'execute'),
  'Service role sem permissão de execução na marcação');

select * from finish();
rollback;
