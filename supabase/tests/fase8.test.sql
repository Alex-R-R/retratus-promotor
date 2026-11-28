begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

-- Usuários do seed: 0001 dona, 0002 gestão, 0003 mídia, 0004 promotor.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- Contratante: tipo e avulso.
select lives_ok($$insert into clients (id, name, kind, listed)
  values ('f8000000-0000-0000-0000-000000000001', 'Avulso de teste', 'acao', false)$$,
  'Gestão cria contratante avulso de ação');
select is((select kind::text || '/' || listed::text from clients where id = 'f8000000-0000-0000-0000-000000000001'),
  'acao/false', 'Contratante guarda tipo e se está na lista');
with novo as (insert into clients (name) values ('Padrão de teste') returning kind, listed)
select is((select kind::text || '/' || listed::text from novo),
  'ambos/true', 'Sem informar, contratante atende os dois tipos e fica na lista');

-- Serviços de ação guardados.
select lives_ok($$insert into action_services (name) values ('Panfletagem')$$, 'Gestão guarda serviço de ação');
select throws_ok($$insert into action_services (name) values (' Panfletagem ')$$,
  '23514', null, 'Serviço não aceita espaço nas pontas');

-- Ação aceita serviço digitado; evento não.
insert into jobs (id, type, title) values
  ('f8000000-0000-0000-0001-000000000001', 'acao', 'Ação com serviço próprio'),
  ('f8000000-0000-0000-0001-000000000002', 'evento', 'Evento padrão');
select lives_ok($$insert into job_slots (job_id, equipment, capacity)
  values ('f8000000-0000-0000-0001-000000000001', 'Panfletagem', 2), ('f8000000-0000-0000-0001-000000000001', 'Totem', 1);
  set constraints all immediate$$, 'Ação aceita serviço digitado junto com equipamento padrão');
set constraints all deferred;

select throws_ok($$insert into job_slots (job_id, equipment, capacity)
  values ('f8000000-0000-0000-0001-000000000002', 'Panfletagem', 1);
  set constraints all immediate$$,
  '23514', 'Evento usa só os equipamentos padrão. Serviço digitado vale para ação.', 'Evento recusa serviço digitado');
set constraints all deferred;

-- Trocar a ação para evento: só passa se as vagas ficarem nos equipamentos padrão.
select throws_ok($$select save_job('f8000000-0000-0000-0001-000000000001',
  '{"type":"evento","title":"Ação com serviço próprio","briefing":"aguardando"}',
  '[{"starts_at":"2099-09-01 18:00-03","ends_at":"2099-09-01 22:00-03"}]',
  '[{"equipment":"Panfletagem","capacity":2}]');
  set constraints all immediate$$,
  '23514', 'Evento usa só os equipamentos padrão. Serviço digitado vale para ação.', 'Virar evento com serviço digitado é recusado');
set constraints all deferred;

select lives_ok($$select save_job('f8000000-0000-0000-0001-000000000001',
  '{"type":"evento","title":"Ação com serviço próprio","briefing":"aguardando"}',
  '[{"starts_at":"2099-09-01 18:00-03","ends_at":"2099-09-01 22:00-03"}]',
  '[{"equipment":"Totem","capacity":1}]');
  set constraints all immediate$$, 'Virar evento tirando o serviço digitado passa');
set constraints all deferred;

-- Promotor não vê nem mexe nos serviços guardados.
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is_empty($$select name from action_services$$, 'Promotor não lê serviços guardados');
select throws_ok($$insert into action_services (name) values ('Outro serviço')$$,
  '42501', null, 'Promotor não guarda serviço');

select * from finish();
rollback;
