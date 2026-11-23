begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

insert into clients (id, name) values ('f3000000-0000-0000-0000-000000000001', 'Cliente da agenda');
insert into jobs (id, type, title, client_id, status) values
  ('f3000000-0000-0000-0000-000000000011', 'acao', 'Ação noturna', 'f3000000-0000-0000-0000-000000000001', 'publicado'),
  ('f3000000-0000-0000-0000-000000000012', 'acao', 'Rascunho da agenda', null, 'rascunho'),
  ('f3000000-0000-0000-0000-000000000013', 'acao', 'Ação a cancelar', null, 'publicado');
insert into job_days (id, job_id, starts_at, ends_at) values
  ('f3000000-0000-0000-0000-000000000021', 'f3000000-0000-0000-0000-000000000011', '2099-06-01 23:00-03', '2099-06-02 02:00-03'),
  ('f3000000-0000-0000-0000-000000000022', 'f3000000-0000-0000-0000-000000000011', '2099-06-03 18:00-03', '2099-06-03 22:00-03'),
  ('f3000000-0000-0000-0000-000000000023', 'f3000000-0000-0000-0000-000000000012', '2099-06-02 10:00-03', '2099-06-02 12:00-03'),
  ('f3000000-0000-0000-0000-000000000024', 'f3000000-0000-0000-0000-000000000013', '2099-06-02 15:00-03', '2099-06-02 18:00-03');
insert into job_slots (job_id, equipment, capacity) values
  ('f3000000-0000-0000-0000-000000000011', 'Totem', 2),
  ('f3000000-0000-0000-0000-000000000011', 'Self print', 1),
  ('f3000000-0000-0000-0000-000000000013', 'Totem', 1);

create temporary table removal (id uuid);
grant select, insert on removal to authenticated;
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
select select_promoter('f3000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000004',
  'Totem', array['f3000000-0000-0000-0000-000000000021']::uuid[]);
select select_promoter('f3000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000005',
  'Totem', array['f3000000-0000-0000-0000-000000000021', 'f3000000-0000-0000-0000-000000000022']::uuid[]);
insert into removal select select_promoter('f3000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000006', 'Self print', array['f3000000-0000-0000-0000-000000000022']::uuid[]);
select select_promoter('f3000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000004',
  'Totem', array['f3000000-0000-0000-0000-000000000024']::uuid[]);
select remove_selection((select id from removal));
select cancel_job('f3000000-0000-0000-0000-000000000013', 'Motivo de teste');
select save_job('f3000000-0000-0000-0000-000000000011',
  '{"type":"acao","title":"Ação noturna","client_id":"f3000000-0000-0000-0000-000000000001"}',
  '[
    {"id":"f3000000-0000-0000-0000-000000000021","starts_at":"2099-06-01 23:30-03","ends_at":"2099-06-02 02:00-03"},
    {"id":"f3000000-0000-0000-0000-000000000022","starts_at":"2099-06-03 18:00-03","ends_at":"2099-06-03 22:00-03"}
  ]',
  '[{"equipment":"Totem","capacity":2},{"equipment":"Self print","capacity":1}]');

select is((select array_agg(title order by starts_at) from calendar('2099-06-02 00:00-03', '2099-06-04 00:00-03')),
  array['Ação noturna','Rascunho da agenda','Ação a cancelar','Ação noturna'], 'Gestão vê todos os dias, inclusive rascunhos e virada da meia-noite');
select is((select slots from calendar('2099-06-02 00:00-03', '2099-06-02 02:00-03')),
  '[{"equipment":"Self print","capacity":1,"filled":0},{"equipment":"Totem","capacity":2,"filled":2}]'::jsonb,
  'Conta as seleções por equipamento no dia que começou na véspera');
select is((select slots from calendar('2099-06-03 00:00-03', '2099-06-04 00:00-03')),
  '[{"equipment":"Self print","capacity":1,"filled":0},{"equipment":"Totem","capacity":2,"filled":1}]'::jsonb,
  'A contagem do segundo dia é independente do primeiro');
select is((select count(*) from calendar('2099-06-02 02:00-03', '2099-06-02 10:00-03')),
  0::bigint, 'Exclui dias que apenas tocam os limites do intervalo');
select is((select client_name from calendar('2099-06-02 00:00-03', '2099-06-02 02:00-03')),
  'Cliente da agenda', 'Gestão vê o cliente');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
select is((select count(*) from calendar('2099-06-02 00:00-03', '2099-06-04 00:00-03') where status = 'rascunho'),
  1::bigint, 'Dono vê rascunhos');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';
select is((select count(*) from calendar('2099-06-02 00:00-03', '2099-06-04 00:00-03')),
  3::bigint, 'Mídia vê os dias fora do rascunho');
select is((select count(*) from calendar('2099-06-02 00:00-03', '2099-06-04 00:00-03') where status = 'rascunho'),
  0::bigint, 'Mídia não vê rascunhos');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000004';
select is((select array_agg(day_id::text order by starts_at) from calendar('2099-06-02 00:00-03', '2099-06-04 00:00-03')),
  array['f3000000-0000-0000-0000-000000000021','f3000000-0000-0000-0000-000000000024'],
  'Promotor vê somente seus dias, inclusive o cancelado');
select is((select status from calendar('2099-06-02 15:00-03', '2099-06-02 18:00-03')),
  'cancelado'::job_status, 'O dia cancelado mantém o status');
select ok((select bool_and(slots is null and client_name is null and promoters = jsonb_build_array(
    jsonb_build_object('promoter_id', auth.uid(), 'full_name', (select full_name from profiles where id = auth.uid()), 'equipment', 'Totem')))
  from calendar('2099-06-02 00:00-03', '2099-06-04 00:00-03')), 'Promotor recebe apenas o próprio nome e equipamento, sem vagas ou cliente');
select results_eq(
  $$select kind, link from notifications where body in ('Ação noturna', 'Ação a cancelar')
    and kind in ('selection_created', 'job_changed', 'job_cancelled') order by kind, link$$,
  $$values ('job_cancelled', '/agenda?d=2099-06-02'), ('job_changed', '/agenda?d=2099-06-01'),
    ('selection_created', '/agenda?d=2099-06-01'), ('selection_created', '/agenda?d=2099-06-02')$$,
  'Avisos de seleção, reagendamento e cancelamento usam a primeira data em Belém');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000006';
select is((select link from notifications where kind = 'selection_removed' and body = 'Ação noturna'),
  '/agenda?d=2099-06-03', 'Remoção aponta para o primeiro dia da seleção');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000010';
select throws_ok($$select * from calendar('2099-06-02 00:00-03', '2099-06-04 00:00-03')$$, '42501', null, 'Perfil pendente não acessa o calendário');
reset role;
select ok(not has_function_privilege('anon', 'public.calendar(timestamptz,timestamptz)', 'execute'), 'Anônimo não executa a RPC');
select ok(not has_function_privilege('service_role', 'public.calendar(timestamptz,timestamptz)', 'execute'), 'Service role não executa a RPC');

select * from finish();
rollback;
