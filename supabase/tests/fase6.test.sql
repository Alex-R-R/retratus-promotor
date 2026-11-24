begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(37);

insert into auth.users (id, email, raw_user_meta_data) values
  ('f6000000-0000-0000-0000-000000000001', 'um-fase6@retratus.test',
   '{"full_name":"Pessoa Um","phone":"555-0101","email":"outro@retratus.test","role":"owner","approved":true,"link":"employee"}'),
  ('f6000000-0000-0000-0000-000000000002', 'dois-fase6@retratus.test',
   '{"full_name":"Pessoa Dois","phone":"555-0102"}'),
  ('f6000000-0000-0000-0000-000000000003', 'pendente-fase6@retratus.test', '{}');

select results_eq(
  $$select role::text, approved, link::text, email, full_name, phone from profiles
    where id = 'f6000000-0000-0000-0000-000000000001'$$,
  $$values ('promoter', false, 'unclassified', 'um-fase6@retratus.test', 'Pessoa Um', '555-0101')$$,
  'Cadastro ignora privilégios e e-mail fornecidos nos metadados');

update profiles set approved = true where id in (
  'f6000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000002'
);

insert into jobs (id, type, title, status) values
  ('f6000000-0000-0000-0001-000000000001', 'acao', 'Ação A', 'publicado'),
  ('f6000000-0000-0000-0001-000000000002', 'acao', 'Ação B', 'publicado'),
  ('f6000000-0000-0000-0001-000000000003', 'acao', 'Ação C', 'cancelado');

insert into job_days (id, job_id, starts_at, ends_at) values
  ('f6000000-0000-0000-0002-000000000001', 'f6000000-0000-0000-0001-000000000001', '2099-07-01 10:00+00', '2099-07-01 12:00+00'),
  ('f6000000-0000-0000-0002-000000000002', 'f6000000-0000-0000-0001-000000000001', '2099-07-01 12:00+00', '2099-07-01 14:00+00'),
  ('f6000000-0000-0000-0002-000000000003', 'f6000000-0000-0000-0001-000000000002', '2099-07-01 10:00+00', '2099-07-01 12:00+00'),
  ('f6000000-0000-0000-0002-000000000004', 'f6000000-0000-0000-0001-000000000003', '2099-07-01 10:00+00', '2099-07-01 12:00+00');

insert into job_slots (job_id, equipment, capacity) values
  ('f6000000-0000-0000-0001-000000000001', 'Totem', 2),
  ('f6000000-0000-0000-0001-000000000001', 'Self print', 1),
  ('f6000000-0000-0000-0001-000000000002', 'Totem', 2),
  ('f6000000-0000-0000-0001-000000000003', 'Totem', 1);

insert into selections (id, job_id, promoter_id, equipment) values
  ('f6000000-0000-0000-0003-000000000001', 'f6000000-0000-0000-0001-000000000001', 'f6000000-0000-0000-0000-000000000001', 'Totem'),
  ('f6000000-0000-0000-0003-000000000002', 'f6000000-0000-0000-0001-000000000001', 'f6000000-0000-0000-0000-000000000002', 'Totem'),
  ('f6000000-0000-0000-0003-000000000003', 'f6000000-0000-0000-0001-000000000002', 'f6000000-0000-0000-0000-000000000001', 'Totem'),
  ('f6000000-0000-0000-0003-000000000004', 'f6000000-0000-0000-0001-000000000001', 'f6000000-0000-0000-0000-000000000001', 'Self print'),
  ('f6000000-0000-0000-0003-000000000005', 'f6000000-0000-0000-0001-000000000003', 'f6000000-0000-0000-0000-000000000001', 'Totem'),
  ('f6000000-0000-0000-0003-000000000006', 'f6000000-0000-0000-0001-000000000003', 'f6000000-0000-0000-0000-000000000002', 'Totem');

select throws_ok($$
  insert into selection_days values
    ('f6000000-0000-0000-0003-000000000001', 'f6000000-0000-0000-0002-000000000001'),
    ('f6000000-0000-0000-0003-000000000003', 'f6000000-0000-0000-0002-000000000003')
$$, '23514', 'Promotor já selecionado em horário sobreposto.', 'Detecta conflito entre duas linhas do mesmo INSERT');

select throws_ok($$
  insert into selection_days values
    ('f6000000-0000-0000-0003-000000000001', 'f6000000-0000-0000-0002-000000000003')
$$, '23514', 'Dia de seleção pertence a outro trabalho.', 'INSERT de vínculo valida o trabalho do dia');

select lives_ok($$
  insert into selection_days values
    ('f6000000-0000-0000-0003-000000000001', 'f6000000-0000-0000-0002-000000000001'),
    ('f6000000-0000-0000-0003-000000000002', 'f6000000-0000-0000-0002-000000000001'),
    ('f6000000-0000-0000-0003-000000000004', 'f6000000-0000-0000-0002-000000000002'),
    ('f6000000-0000-0000-0003-000000000005', 'f6000000-0000-0000-0002-000000000004'),
    ('f6000000-0000-0000-0003-000000000006', 'f6000000-0000-0000-0002-000000000004')
$$, 'Horários adjacentes e histórico cancelado são permitidos');

select throws_ok($$
  update selection_days set job_day_id = 'f6000000-0000-0000-0002-000000000003'
  where selection_id = 'f6000000-0000-0000-0003-000000000001'
$$, '23514', 'Dia de seleção pertence a outro trabalho.', 'UPDATE de vínculo valida o trabalho do dia');

select throws_ok($$
  update selection_days set job_day_id = 'f6000000-0000-0000-0002-000000000001'
  where selection_id = 'f6000000-0000-0000-0003-000000000004'
$$, '23514', 'Promotor já selecionado em horário sobreposto.', 'Detecta conflito mesmo quando a linha alterada tem a chave maior');

select throws_ok($$
  update selections set job_id = 'f6000000-0000-0000-0001-000000000002'
  where id = 'f6000000-0000-0000-0003-000000000001'
$$, '23514', 'Dia de seleção pertence a outro trabalho.', 'Mover a seleção valida os dias vinculados');

select throws_ok($$
  update selections set promoter_id = 'f6000000-0000-0000-0000-000000000001'
  where id = 'f6000000-0000-0000-0003-000000000002'
$$, '23514', 'Promotor já selecionado em horário sobreposto.', 'Trocar a pessoa verifica a nova escala');

update selections set equipment = 'Self print' where id = 'f6000000-0000-0000-0003-000000000001';
select throws_ok($$
  update selections set equipment = 'Self print'
  where id = 'f6000000-0000-0000-0003-000000000002'
$$, '23514', 'Capacidade do equipamento excedida neste dia.', 'Trocar o equipamento verifica a capacidade de destino');
update selections set equipment = 'Totem' where id = 'f6000000-0000-0000-0003-000000000001';

select throws_ok($$
  update job_days set starts_at = starts_at - interval '1 hour'
  where id = 'f6000000-0000-0000-0002-000000000002'
$$, '23514', 'Promotor já selecionado em horário sobreposto.', 'Mudar o horário do dia verifica os promotores escalados');
select throws_ok($$
  update job_days set job_id = 'f6000000-0000-0000-0001-000000000002'
  where id = 'f6000000-0000-0000-0002-000000000002'
$$, '23514', 'Dia de seleção pertence a outro trabalho.', 'Mover o dia valida as seleções vinculadas');

select throws_ok($$
  update job_slots set capacity = 1
  where job_id = 'f6000000-0000-0000-0001-000000000001' and equipment = 'Totem'
$$, '23514', 'Capacidade do equipamento excedida neste dia.', 'Reduzir a capacidade valida o equipamento alterado');
select throws_ok($$
  insert into job_slots (job_id, equipment, capacity)
  values ('f6000000-0000-0000-0001-000000000001', 'Totem', 1)
  on conflict (job_id, equipment) do update set capacity = excluded.capacity
$$, '23514', 'Capacidade do equipamento excedida neste dia.', 'O UPSERT também verifica a capacidade');

-- A FK de seleções para equipamentos é diferida e permite recriar a vaga.
delete from job_slots
where job_id = 'f6000000-0000-0000-0001-000000000001' and equipment = 'Totem';
select throws_ok($$
  insert into job_slots (job_id, equipment, capacity)
  values ('f6000000-0000-0000-0001-000000000001', 'Totem', 1)
$$, '23514', 'Capacidade do equipamento excedida neste dia.', 'Inserir vaga verifica a capacidade de seleções existentes');
insert into job_slots (job_id, equipment, capacity)
values ('f6000000-0000-0000-0001-000000000001', 'Totem', 2);

select throws_ok($$
  update jobs set status = 'publicado' where id = 'f6000000-0000-0000-0001-000000000003'
$$, '23514', 'Promotor já selecionado em horário sobreposto.', 'Reativar trabalho verifica conflito antes da capacidade');
update job_days set starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day'
where id = 'f6000000-0000-0000-0002-000000000004';
select throws_ok($$
  update jobs set status = 'publicado' where id = 'f6000000-0000-0000-0001-000000000003'
$$, '23514', 'Capacidade do equipamento excedida neste dia.', 'Reativar trabalho verifica a capacidade');
update job_slots set capacity = 2 where job_id = 'f6000000-0000-0000-0001-000000000003';
select lives_ok($$
  update jobs set status = 'publicado' where id = 'f6000000-0000-0000-0001-000000000003'
$$, 'Reativa o trabalho depois de resolver os conflitos');

insert into payments (selection_id, amount) values ('f6000000-0000-0000-0003-000000000001', 123);

select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
$$, 'Todas as tabelas públicas têm RLS');
select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))
$$, 'Anônimo não tem privilégios nas tabelas públicas');
select is_empty($$
  select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'retratus_private') and p.prosecdef
    and (not coalesce('search_path=""' = any(p.proconfig), false)
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
$$, 'Funções SECURITY DEFINER têm search_path vazio e EXECUTE restrito');
select ok(not has_function_privilege('authenticated', 'retratus_private.check_selection_promoter()', 'EXECUTE'),
  'Cliente autenticado não executa função de trigger');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"f6000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is_empty($$
  select email, phone from profiles where id = 'f6000000-0000-0000-0000-000000000002'
$$, 'Promotor não lê telefone ou e-mail de outro promotor');
select throws_ok($$select * from job_candidates('f6000000-0000-0000-0001-000000000001')$$,
  '42501', null, 'RPC de candidatos não expõe telefones a promotores');
select throws_ok($$update profiles set role = 'owner', approved = false$$,
  '42501', 'Somente nome e telefone podem ser editados.', 'Promotor não altera papel ou aprovação');
select throws_ok($$update profiles set email = 'adulterado@retratus.test'$$,
  '42501', 'Somente nome e telefone podem ser editados.', 'Promotor não altera o e-mail do perfil');
select throws_ok($$
  insert into applications (job_id, equipment, created_at)
  values ('f6000000-0000-0000-0001-000000000001', array['Totem'], '2000-01-01')
$$, '42501', null, 'Promotor não forja a data da candidatura');
select lives_ok($$
  select apply_to_job('f6000000-0000-0000-0001-000000000001', array['Totem'])
$$, 'A RPC de candidatura mantém o fluxo normal');

select is_empty($$
  select id from notifications where user_id = 'f6000000-0000-0000-0000-000000000002'
$$, 'Promotor não lê avisos alheios');
with marked as (
  update notifications set read_at = now()
  where user_id = 'f6000000-0000-0000-0000-000000000002' returning id
)
select is((select count(*) from marked), 0::bigint, 'Promotor não marca avisos alheios como lidos');
with marked as (
  update notifications set read_at = now()
  where kind = 'profile_approved' returning id
)
select is((select count(*) from marked), 1::bigint, 'Promotor marca o próprio aviso como lido');
select is_empty($$select amount from payments$$, 'Promotor não lê pagamentos');

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is_empty($$select amount from payments$$, 'Gestão não lê pagamentos');
select is_empty($$
  select valor_total, valor_pago, sem_valor from promoter_job_counts('2099-07-01', '2099-08-01')
  where valor_total is not null or valor_pago is not null or sem_valor is not null
$$, 'Ranking de gestão omite os campos financeiros');
select throws_ok($$
  insert into selections (job_id, promoter_id, equipment)
  values ('f6000000-0000-0000-0001-000000000001', 'f6000000-0000-0000-0000-000000000003', 'Totem')
$$, '23514', 'Seleção exige promotor aprovado.', 'Gestão não escala perfil pendente por escrita direta');
select throws_ok($$
  update selections set promoter_id = 'f6000000-0000-0000-0000-000000000003'
  where id = 'f6000000-0000-0000-0003-000000000001'
$$, '23514', 'Seleção exige promotor aprovado.', 'Gestão não troca a seleção para perfil pendente');

reset role;
insert into payments (selection_id, amount, source, paid_at)
values ('f6000000-0000-0000-0003-000000000001', 200, 'manual', now())
on conflict (selection_id) do update set paid_at = now();
select throws_ok($$delete from selections where id = 'f6000000-0000-0000-0003-000000000001'$$,
  '23514', null, 'Seleção já paga não sai da escala');
update payments set paid_at = null where selection_id = 'f6000000-0000-0000-0003-000000000001';
select lives_ok($$delete from selections where id = 'f6000000-0000-0000-0003-000000000001'$$,
  'Seleção sem pagamento feito pode sair da escala');
select * from finish();
rollback;
