begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(77);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';

create temporary table fixture (name text primary key, id uuid not null);
create temporary view input as
select '{"type":"acao","title":"Ação fase 2"}'::jsonb as job,
  jsonb_build_array(
    jsonb_build_object('starts_at', now() + interval '40 days', 'ends_at', now() + interval '40 days 4 hours'),
    jsonb_build_object('starts_at', now() + interval '41 days', 'ends_at', now() + interval '41 days 4 hours')
  ) as days,
  '[{"equipment":"Totem","capacity":2},{"equipment":"Self print","capacity":1}]'::jsonb as slots;

insert into fixture select 'main', save_job(null, job, days, slots) from input;
insert into fixture select 'first', id from job_days where job_id = (select id from fixture where name = 'main') order by starts_at limit 1;
insert into fixture select 'second', id from job_days where job_id = (select id from fixture where name = 'main') order by starts_at desc limit 1;
insert into fixture select 'empty', save_job(null, '{"type":"acao","title":"Sem dias"}', '[]', slots) from input;
insert into fixture select 'no_slot', save_job(null, '{"type":"acao","title":"Sem equipamento"}', days, '[]') from input;
insert into fixture values ('past', save_job(null, '{"type":"acao","title":"Passado"}',
  jsonb_build_array(jsonb_build_object('starts_at', now() - interval '2 hours', 'ends_at', now() - interval '1 hour')),
  '[{"equipment":"Totem","capacity":1}]'));

create temporary view main_days as
select jsonb_agg(jsonb_build_object('id', id, 'starts_at', starts_at, 'ends_at', ends_at) order by starts_at) as days
from job_days where job_id = (select id from fixture where name = 'main');

select is((select status::text from jobs where id = (select id from fixture where name = 'main')), 'rascunho', 'Cria trabalho como rascunho');
select is((select jsonb_array_length(days) from main_days), 2, 'Cria os dois dias');
select throws_ok($sql$select save_job(null, '{"type":"evento","title":"Sem dias"}', '[]', slots) from input$sql$,
  '23514', 'Evento deve ter exatamente um dia.', 'Evento exige um dia');
select throws_ok($sql$select save_job(null, '{"type":"evento","title":"Dois dias"}', days, slots) from input$sql$,
  '23514', 'Evento deve ter exatamente um dia.', 'Evento recusa mais de um dia');
select lives_ok($sql$select save_job(null, '{"type":"evento","title":"Um dia"}', jsonb_build_array(days->0), slots) from input$sql$,
  'Evento aceita um dia');
select lives_ok($sql$select save_job((select id from fixture where name = 'main'),
  job || '{"title":"Ação atualizada"}', jsonb_build_array((select days->0 from main_days)), slots) from input$sql$,
  'Edita título e remove dia omitido sem seleção');
select is((select title from jobs where id = (select id from fixture where name = 'main')), 'Ação atualizada', 'Grava o novo título');
select is((select count(*) from job_days where id = (select id from fixture where name = 'second')), 0::bigint, 'Remove o dia omitido');
select lives_ok($sql$select save_job((select id from fixture where name = 'main'),
  job || '{"title":"Ação atualizada"}', (select days from main_days) || jsonb_build_array(days->1), slots) from input$sql$,
  'Adiciona dia durante a edição');
update fixture set id = (select d.id from job_days d where d.job_id = (select id from fixture where name = 'main') order by starts_at desc limit 1)
where name = 'second';

select throws_ok($sql$select publish_job((select id from fixture where name = 'empty'))$sql$, '23514', null, 'Publicação exige dia');
select throws_ok($sql$select publish_job((select id from fixture where name = 'no_slot'))$sql$, '23514', null, 'Publicação exige equipamento');
select throws_ok($sql$select publish_job((select id from fixture where name = 'past'))$sql$, '23514', null, 'Publicação exige dia futuro');
select lives_ok($sql$select publish_job((select id from fixture where name = 'main'))$sql$, 'Publica rascunho válido');
select throws_ok($sql$select publish_job((select id from fixture where name = 'main'))$sql$, '23514', null, 'Recusa republicação');
select lives_ok($sql$select set_briefing((select id from fixture where name = 'main'), 'fechado')$sql$, 'Gestão pode fechar briefing');

insert into fixture
select 'sel8', select_promoter((select id from fixture where name = 'main'), '10000000-0000-0000-0000-000000000008',
  'Totem', array[(select id from fixture where name = 'first')])
union all
select 'sel9', select_promoter((select id from fixture where name = 'main'), '10000000-0000-0000-0000-000000000009',
  'Totem', array[(select id from fixture where name = 'first')])
union all
select 'sel_past', select_promoter((select id from fixture where name = 'past'), '10000000-0000-0000-0000-000000000008',
  'Totem', array(select id from job_days where job_id = (select id from fixture where name = 'past')));

select throws_ok($sql$select save_job((select id from fixture where name = 'main'), job, '[]', slots) from input$sql$,
  '23514', 'Não é possível remover dia com seleção.', 'Protege dia selecionado');
select throws_ok($sql$select save_job((select id from fixture where name = 'main'), job, (select days from main_days), '[]') from input$sql$,
  '23514', 'Não é possível remover equipamento com seleção.', 'Protege equipamento selecionado');
select throws_ok($sql$select save_job((select id from fixture where name = 'main'), job,
  (select days from main_days), '[{"equipment":"Totem","capacity":1}]') from input$sql$,
  '23514', 'Capacidade do equipamento excedida neste dia.', 'Protege capacidade já preenchida');
select throws_ok($sql$select remove_selection((select id from fixture where name = 'sel_past'))$sql$,
  '23514', null, 'Recusa remoção após início');

insert into fixture
select 'other', save_job(null, '{"type":"acao","title":"Horário concorrente"}',
  jsonb_build_array(jsonb_build_object('starts_at', now() + interval '41 days', 'ends_at', now() + interval '41 days 4 hours')), slots)
from input;
insert into fixture select 'sel_other',
  select_promoter((select id from fixture where name = 'other'), '10000000-0000-0000-0000-000000000008', 'Totem',
  array(select id from job_days where job_id = (select id from fixture where name = 'other')));

select throws_ok($sql$select save_job((select id from fixture where name = 'main'), job,
  (select jsonb_build_array((days->1) || jsonb_build_object('id', days->0->'id'), days->1) from main_days), slots) from input$sql$,
  '23514', 'Promotor já selecionado em horário sobreposto.', 'Edição respeita conflito de horário');
select lives_ok($sql$select save_job((select id from fixture where name = 'main'), job,
  (select jsonb_build_array((days->0) || jsonb_build_object('ends_at', now() + interval '40 days 5 hours'), days->1) from main_days), slots) from input$sql$,
  'Pode reagendar dia selecionado sem conflito');

select is((select conflict_day_ids from job_candidates((select id from fixture where name = 'main'))
  where promoter_id = '10000000-0000-0000-0000-000000000008'),
  array[(select id from fixture where name = 'second')], 'Candidato escalado em outro trabalho recebe o ID do dia conflitante');
select is((select count(*) from job_candidates((select id from fixture where name = 'main')) where applied_equipment is null),
  2::bigint, 'Inclui selecionados sem candidatura');
select is((select count(*) from payments), 0::bigint, 'Gestão continua sem acesso a pagamentos');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000008';
select is((select open_days from job_board() b cross join lateral jsonb_to_recordset(b.slots) s(equipment text, open_days int)
  where b.job_id = (select id from fixture where name = 'main') and s.equipment = 'Totem'), 1, 'Mostra somente um dia com vaga no Totem');
select is((select open_days from job_board() b cross join lateral jsonb_to_recordset(b.slots) s(equipment text, open_days int)
  where b.job_id = (select id from fixture where name = 'main') and s.equipment = 'Self print'), 2, 'Mostra dois dias com vaga no Self print');
select ok((select row_to_json(b)::text not like '%Promotor fictício 06%' from job_board() b
  where b.job_id = (select id from fixture where name = 'main')), 'Quadro de vagas não expõe o nome do outro selecionado');
select ok((select i_am_selected from job_board() where job_id = (select id from fixture where name = 'main')), 'Quadro indica seleção própria');
select is((select count(*) from my_jobs(now() + interval '39 days', now() + interval '42 days')
  where job_id = (select id from fixture where name = 'main')), 1::bigint, 'Agenda retorna somente os dias da seleção própria');
select is((select count(*) from notifications where kind = 'job_changed' and link = '/meus-trabalhos'),
  1::bigint, 'Reagendamento avisa o selecionado uma vez');
select lives_ok($sql$select apply_to_job((select id from fixture where name = 'main'), array['Totem'])$sql$,
  'RPC cria candidatura do promotor autenticado');
select is((select my_application from job_board() where job_id = (select id from fixture where name = 'main')),
  array['Totem'], 'Quadro mostra candidatura própria');
select lives_ok($sql$select apply_to_job((select id from fixture where name = 'main'), array['Self print'])$sql$,
  'RPC atualiza os equipamentos da candidatura existente');
select is((select my_application from job_board() where job_id = (select id from fixture where name = 'main')),
  array['Self print'], 'Quadro mostra equipamentos atualizados');
select throws_ok($sql$select apply_to_job((select id from fixture where name = 'main'), array['Indisponível'])$sql$,
  '23514', 'Equipamento indisponível neste trabalho.', 'RPC valida o equipamento no trabalho');
select throws_ok($sql$select save_job(null, null, null, null)$sql$, '42501', null, 'Promotor sem acesso a save_job');
select throws_ok($sql$select publish_job(null)$sql$, '42501', null, 'Promotor sem acesso a publish_job');
select throws_ok($sql$select cancel_job(null, null)$sql$, '42501', null, 'Promotor sem acesso a cancel_job');
select throws_ok($sql$select remove_selection(null)$sql$, '42501', null, 'Promotor sem acesso a remove_selection');
select throws_ok($sql$select set_briefing(null, null)$sql$, '42501', null, 'Promotor sem acesso a set_briefing');
select throws_ok($sql$select job_candidates(null)$sql$, '42501', null, 'Promotor não acessa candidatos');
select throws_ok($sql$select jobs_overview(null, null)$sql$, '42501', null, 'Promotor não acessa gestão');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
select is((select count(*) from notifications where kind = 'application_created'
  and link = '/trabalhos/' || (select id from fixture where name = 'main')), 1::bigint, 'Gestão recebe um aviso mesmo após atualização');
select throws_ok($sql$select apply_to_job((select id from fixture where name = 'main'), array['Totem'])$sql$,
  '42501', null, 'Gestão não pode se candidatar');

reset role;
update job_days set starts_at = now() + interval '12 hours'
where id = (select id from fixture where name = 'first');
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000008';
select throws_ok($sql$select apply_to_job((select id from fixture where name = 'main'), array['Totem'])$sql$,
  '23514', 'Trabalho indisponível ou prazo de candidatura encerrado.', 'RPC recusa atualização de candidatura após o prazo');
select is((select equipment from applications where job_id = (select id from fixture where name = 'main')),
  array['Self print'], 'Preserva a candidatura após tentativa fora do prazo');
reset role;
update job_days set starts_at = now() + interval '40 days'
where id = (select id from fixture where name = 'first');
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
select lives_ok($sql$select remove_selection((select id from fixture where name = 'sel9'))$sql$, 'Remove seleção antes do início');
select throws_ok($sql$select cancel_job((select id from fixture where name = 'main'), E' \t ')$sql$,
  '23514', 'Informe o motivo do cancelamento.', 'Cancelamento exige motivo');
select lives_ok($sql$select cancel_job((select id from fixture where name = 'main'), 'Motivo fictício')$sql$, 'Cancela publicado');
select is((select count(*) from selections where id = (select id from fixture where name = 'sel8')), 1::bigint, 'Cancelamento preserva histórico');
select throws_ok($sql$select save_job((select id from fixture where name = 'main'), job, days, slots) from input$sql$,
  '23514', 'Trabalho cancelado ou realizado não pode ser editado.', 'Trabalho cancelado não pode ser editado');
select lives_ok($sql$select cancel_job((select id from fixture where name = 'no_slot'), 'Motivo fictício')$sql$, 'Cancela rascunho');

insert into fixture select 'replacement', save_job(null, job || '{"title":"Substituição"}',
  jsonb_build_array(days->0), slots) from input;
select publish_job((select id from fixture where name = 'replacement'));
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000008';
select apply_to_job((select id from fixture where name = 'replacement'), array['Totem']);
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
select is((select conflict_day_ids from job_candidates((select id from fixture where name = 'replacement'))
  where promoter_id = '10000000-0000-0000-0000-000000000008'), array[]::uuid[],
  'Trabalho cancelado não aparece nos conflitos do candidato');
select lives_ok($sql$select select_promoter((select id from fixture where name = 'replacement'),
  '10000000-0000-0000-0000-000000000008', 'Totem',
  array(select id from job_days where job_id = (select id from fixture where name = 'replacement')))$sql$,
  'Trabalho cancelado não bloqueia seleção no mesmo horário');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000008';
select is((select count(*) from notifications where kind = 'job_cancelled' and link = '/meus-trabalhos'),
  1::bigint, 'Selecionado recebe aviso de cancelamento');
select is((select status::text from my_jobs(now() + interval '39 days', now() + interval '41 days')
  where job_id = (select id from fixture where name = 'main')), 'cancelado', 'Agenda preserva trabalho cancelado');
select is((select count(*) from job_board() where job_id = (select id from fixture where name = 'main')), 0::bigint, 'Quadro oculta cancelado');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000009';
select is((select count(*) from notifications where kind = 'selection_removed' and link = '/meus-trabalhos'),
  1::bigint, 'Promotor removido recebe aviso');
select is((select count(*) from notifications where kind = 'job_cancelled'), 0::bigint, 'Cancelamento não avisa seleção já removida');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
select is((select count(*) from notifications where kind = 'application_created'
  and link = '/trabalhos/' || (select id from fixture where name = 'main')), 1::bigint, 'Dono recebe aviso de candidatura');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';
select throws_ok($sql$select save_job(null, null, null, null)$sql$, '42501', null, 'Mídia sem acesso a save_job');
select throws_ok($sql$select publish_job(null)$sql$, '42501', null, 'Mídia sem acesso a publish_job');
select throws_ok($sql$select cancel_job(null, null)$sql$, '42501', null, 'Mídia sem acesso a cancel_job');
select throws_ok($sql$select remove_selection(null)$sql$, '42501', null, 'Mídia sem acesso a remove_selection');
select throws_ok($sql$select set_briefing(null, null)$sql$, '42501', null, 'Mídia sem acesso a set_briefing');
select throws_ok($sql$select job_board()$sql$, '42501', null, 'Mídia não acessa quadro de vagas');
select throws_ok($sql$select job_candidates(null)$sql$, '42501', null, 'Mídia não acessa candidatos');
select throws_ok($sql$select my_jobs(null, null)$sql$, '42501', null, 'Mídia não acessa agenda do promotor');
select is((select staffing from jobs_overview(now() + interval '40 days', now() + interval '40 days 1 hour')
  where job_id = (select id from fixture where name = 'empty')), 'sem_vagas', 'Visão de mídia inclui rascunho sem dias');
select results_eq(
  $sql$select day_count, capacity_total, filled_total, applications_count, staffing
    from jobs_overview(now() + interval '40 days', now() + interval '40 days 1 hour')
    where job_id = (select id from fixture where name = 'main')$sql$,
  $sql$values (2::bigint, 6::bigint, 1::bigint, 1::bigint, 'vagas_abertas')$sql$,
  'Visão no período agrega todos os dias do trabalho');

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000010';
select throws_ok($sql$select job_board()$sql$, '42501', null, 'Cadastro pendente não acessa vagas');
select throws_ok($sql$select my_jobs(null, null)$sql$, '42501', null, 'Cadastro pendente não acessa agenda');

reset role;
select ok(not has_function_privilege('anon', 'public.job_board()', 'EXECUTE'), 'Anônimo não tem EXECUTE');
select ok(not has_function_privilege('service_role', 'public.job_board()', 'EXECUTE'), 'Service role não tem EXECUTE');

select ok(has_function_privilege('authenticated', 'public.apply_to_job(uuid, text[])', 'EXECUTE'), 'Autenticado tem EXECUTE na RPC de candidatura');
select ok(not has_function_privilege('anon', 'public.apply_to_job(uuid, text[])', 'EXECUTE'), 'Anônimo não tem EXECUTE na RPC de candidatura');
select ok(not has_function_privilege('service_role', 'public.apply_to_job(uuid, text[])', 'EXECUTE'), 'Service role não tem EXECUTE na RPC de candidatura');

select * from finish();
rollback;
