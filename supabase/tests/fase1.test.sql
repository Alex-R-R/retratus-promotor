begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(60);

-- Trabalhos com prazos relativos ao relógio e horários conflitantes com o seed.
insert into public.jobs (id, type, title, status) values
  ('30000000-0000-0000-0000-000000000091', 'acao', 'Prazo encerrado', 'publicado'),
  ('30000000-0000-0000-0000-000000000092', 'acao', 'Prazo aberto', 'publicado'),
  ('30000000-0000-0000-0000-000000000093', 'evento', 'Evento sobreposto', 'publicado'),
  ('30000000-0000-0000-0000-000000000094', 'acao', 'Rascunho', 'rascunho'),
  ('30000000-0000-0000-0000-000000000095', 'evento', 'Evento contíguo', 'publicado');
insert into public.job_days (id, job_id, starts_at, ends_at) values
  ('40000000-0000-0000-0000-000000000091', '30000000-0000-0000-0000-000000000091', now() + interval '12 hours', now() + interval '13 hours'),
  ('40000000-0000-0000-0000-000000000096', '30000000-0000-0000-0000-000000000091', now() + interval '72 hours', now() + interval '73 hours'),
  ('40000000-0000-0000-0000-000000000092', '30000000-0000-0000-0000-000000000092', now() + interval '48 hours', now() + interval '49 hours'),
  ('40000000-0000-0000-0000-000000000093', '30000000-0000-0000-0000-000000000093', '2026-11-28 19:00-03', '2026-11-28 23:00-03'),
  ('40000000-0000-0000-0000-000000000094', '30000000-0000-0000-0000-000000000094', now() + interval '48 hours', now() + interval '49 hours'),
  ('40000000-0000-0000-0000-000000000095', '30000000-0000-0000-0000-000000000095', '2026-11-28 22:00-03', '2026-11-29 02:00-03');
insert into public.job_slots (job_id, equipment, capacity)
select id, 'Totem', 1 from public.jobs where id in ('30000000-0000-0000-0000-000000000091', '30000000-0000-0000-0000-000000000092', '30000000-0000-0000-0000-000000000093', '30000000-0000-0000-0000-000000000094', '30000000-0000-0000-0000-000000000095');
set constraints all immediate;

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000004';

select is((select count(*) from public.clients), 0::bigint, 'Promotor não lê clientes');

select is((select count(*) from public.payments), 0::bigint, 'Promotor não lê pagamentos');

select is((select count(*) from public.event_pay_rates), 0::bigint, 'Promotor não lê tabela de valores');

select is((select array_agg(promoter_id) from public.selections), array['10000000-0000-0000-0000-000000000004']::uuid[], 'Promotor lê somente seleções próprias');

select is((select count(*) from public.selection_days), 1::bigint, 'Promotor lê somente dias das próprias seleções');

select is((select array_agg(id) from public.jobs where id in ('30000000-0000-0000-0000-000000000092', '30000000-0000-0000-0000-000000000094')), array['30000000-0000-0000-0000-000000000092']::uuid[], 'Promotor vê publicado futuro e não vê rascunho');

select is((select array_agg(id) from public.agenda('2026-11-01 00:00-03', '2027-01-01 00:00-03')), array['40000000-0000-0000-0000-000000000001']::uuid[], 'Agenda do promotor contém somente seus dias');

select is((select count(*) from public.applications), 1::bigint, 'Promotor vê apenas suas candidaturas');

select lives_ok($sql$update public.profiles set full_name = 'Cadastro fictício editado', phone = null$sql$, 'Promotor pode editar nome e telefone');

select throws_ok($sql$update public.profiles set role = 'owner'$sql$, '42501', 'Somente nome e telefone podem ser editados.', 'Promotor não pode se promover');

select throws_ok($sql$update public.profiles set approved = false$sql$, '42501', 'Somente nome e telefone podem ser editados.', 'Promotor não pode alterar aprovação');

select throws_ok($sql$update public.profiles set link = 'employee'$sql$, '42501', 'Somente nome e telefone podem ser editados.', 'Promotor não pode alterar vínculo');

select throws_ok($sql$update public.notifications set title = 'alterado'$sql$, '42501', null, 'Promotor não altera conteúdo de notificação');

select lives_ok($sql$update public.notifications set read_at = now()$sql$, 'Promotor pode marcar notificações próprias como lidas');

select throws_ok($sql$insert into public.applications (job_id, promoter_id, equipment)
  values ('30000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-000000000004', array['Totem'])$sql$, '23514', 'Trabalho indisponível ou prazo de candidatura encerrado.', 'Prazo usa o primeiro dia da ação');

select throws_ok($sql$insert into public.applications (job_id, promoter_id, equipment)
  values ('30000000-0000-0000-0000-000000000094', '10000000-0000-0000-0000-000000000004', array['Totem'])$sql$, '23514', 'Trabalho indisponível ou prazo de candidatura encerrado.', 'Rascunho não aceita candidatura');

select lives_ok($sql$insert into public.applications (job_id, promoter_id, equipment)
  values ('30000000-0000-0000-0000-000000000092', '10000000-0000-0000-0000-000000000004', array['Totem'])$sql$, 'Promotor pode se candidatar dentro do prazo');

select lives_ok($sql$delete from public.applications where job_id = '30000000-0000-0000-0000-000000000092'$sql$, 'Promotor pode remover candidatura própria');

select throws_ok($sql$select * from public.dashboard_counts('2026-11-01 00:00-03', '2027-01-01 00:00-03')$sql$, '42501', null, 'Promotor não acessa o painel');

select throws_ok($sql$select public.select_promoter('30000000-0000-0000-0000-000000000095', '10000000-0000-0000-0000-000000000004', 'Totem', array['40000000-0000-0000-0000-000000000095']::uuid[])$sql$, '42501', null, 'Promotor não confirma a própria seleção');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';

select is((select count(*) from public.profiles), 10::bigint, 'Gestão lê todos os perfis');

select is((select count(*) from public.payments), 0::bigint, 'Gestão não lê pagamentos');

select is((select count(*) from public.pay_settings), 0::bigint, 'Gestão não lê parâmetros de pagamento');

select is((select count(valor_total) from public.promoter_job_counts('2026-11-01 00:00-03', '2027-01-01 00:00-03')), 0::bigint, 'Ranking da gestão não expõe valores');

select is((select dias_acao from public.promoter_job_counts('2026-11-01 00:00-03', '2027-01-01 00:00-03') where promoter_id = '10000000-0000-0000-0000-000000000005'), 2::bigint, 'Ranking conta dias de ação separados');

select throws_ok($sql$select public.select_promoter('30000000-0000-0000-0000-000000000093', '10000000-0000-0000-0000-000000000004', 'Totem', array['40000000-0000-0000-0000-000000000093']::uuid[])$sql$, '23514', 'Promotor já selecionado em horário sobreposto.', 'Sobreposição entre trabalhos é bloqueada');

select throws_ok($sql$select public.select_promoter('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'Totem', array['40000000-0000-0000-0000-000000000001']::uuid[])$sql$, '23514', 'Capacidade do equipamento excedida neste dia.', 'Capacidade por equipamento e dia é respeitada');

select lives_ok($sql$select public.select_promoter('30000000-0000-0000-0000-000000000095', '10000000-0000-0000-0000-000000000004', 'Totem', array['40000000-0000-0000-0000-000000000095']::uuid[])$sql$, 'Horários contíguos são permitidos');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';

select is((select count(*) from public.profiles), 1::bigint, 'Mídia lê somente seu perfil');

select is((select count(*) from public.clients), 2::bigint, 'Mídia lê clientes');

select is((select count(*) from public.applications), 0::bigint, 'Mídia não lê candidaturas');

select lives_ok($sql$insert into public.media_items (job_id, url, kind, title) values
('30000000-0000-0000-0000-000000000001', 'https://example.invalid/pasta', 'pasta', 'Pasta fictícia')$sql$, 'Mídia pode cadastrar links');

select lives_ok($sql$update public.media_items set title = 'Pasta de teste'$sql$, 'Mídia pode editar links');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000010';

select is((select array_agg(id) from public.profiles), array['10000000-0000-0000-0000-000000000010']::uuid[], 'Cadastro pendente lê somente o próprio perfil');

select is((select count(*) from public.jobs), 0::bigint, 'Cadastro pendente não lê jobs');

select is((select count(*) from public.job_days), 0::bigint, 'Cadastro pendente não lê job_days');

select is((select count(*) from public.job_slots), 0::bigint, 'Cadastro pendente não lê job_slots');

select is((select count(*) from public.clients), 0::bigint, 'Cadastro pendente não lê clients');

select is((select count(*) from public.applications), 0::bigint, 'Cadastro pendente não lê applications');

select is((select count(*) from public.selections), 0::bigint, 'Cadastro pendente não lê selections');

select is((select count(*) from public.selection_days), 0::bigint, 'Cadastro pendente não lê selection_days');

select is((select count(*) from public.notifications), 0::bigint, 'Cadastro pendente não lê notifications');

select is((select count(*) from public.media_items), 0::bigint, 'Cadastro pendente não lê media_items');

select is((select count(*) from public.payments), 0::bigint, 'Cadastro pendente não lê payments');

select is((select count(*) from public.event_pay_rates), 0::bigint, 'Cadastro pendente não lê event_pay_rates');

select is((select count(*) from public.pay_settings), 0::bigint, 'Cadastro pendente não lê pay_settings');

select throws_ok($sql$select * from public.agenda('2026-11-01 00:00-03', '2027-01-01 00:00-03')$sql$, '42501', null, 'Cadastro pendente não acessa a agenda');

select throws_ok($sql$
  insert into public.applications (job_id, promoter_id, equipment)
  values ('30000000-0000-0000-0000-000000000092', '10000000-0000-0000-0000-000000000010', array['Totem'])
$sql$, '42501', null, 'Cadastro pendente não pode se candidatar');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';

select is((select amount from public.payments where selection_id = '50000000-0000-0000-0000-000000000001'), 130.00::numeric, 'Evento de 4h gera sugestão de R$ 130');

select is((select count(*) from public.payments where selection_id in ('50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003')), 0::bigint, 'Ação e evento de 3h ficam sem sugestão');

select is((select valor_total from public.promoter_job_counts('2026-11-01 00:00-03', '2027-01-01 00:00-03') where promoter_id = '10000000-0000-0000-0000-000000000004'), 260.00::numeric, 'Proprietária vê valor total de dois eventos');

select lives_ok($sql$update public.profiles set approved = true where id = '10000000-0000-0000-0000-000000000010'$sql$, 'Proprietária pode aprovar cadastro');

reset role;

select is((select count(*) from public.notifications where kind = 'job_published' and link = '/vagas/' || '30000000-0000-0000-0000-000000000092' and user_id in ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000009')), 6::bigint, 'Publicação avisa todos os promotores aprovados');

select is((select count(*) from public.notifications where kind = 'job_published' and link = '/vagas/' || '30000000-0000-0000-0000-000000000092'), 6::bigint, 'Publicação avisa somente os promotores aprovados');

select is((select array_agg(user_id) from public.notifications where kind = 'selection_created' and link = '/meus-trabalhos' and body = 'Evento contíguo'), array['10000000-0000-0000-0000-000000000004']::uuid[], 'Seleção avisa somente o promotor selecionado');

select is((select count(*) from public.notifications where kind = 'profile_approved' and user_id = '10000000-0000-0000-0000-000000000010'), 1::bigint, 'Aprovação avisa a pessoa');

select is((select count(*) from public.audit_log where entity = 'profiles' and entity_id = '10000000-0000-0000-0000-000000000010' and actor_id = '10000000-0000-0000-0000-000000000001'), 1::bigint, 'Aprovação registra autoria na auditoria');

select throws_ok($sql$insert into public.jobs (type, title) values ('evento', 'Evento sem dia')$sql$,
  '23514', 'Evento deve ter exatamente um dia.', 'Evento sem dia é rejeitado');

set constraints all deferred;
insert into public.jobs (id, type, title) values
  ('30000000-0000-0000-0000-000000000097', 'evento', 'Evento de seis horas');
insert into public.job_days (id, job_id, starts_at, ends_at) values
  ('40000000-0000-0000-0000-000000000097', '30000000-0000-0000-0000-000000000097',
   '2026-12-20 16:00-03', '2026-12-20 22:00-03');
insert into public.job_slots (job_id, equipment, capacity) values
  ('30000000-0000-0000-0000-000000000097', 'Totem', 2);
set constraints all immediate;
update public.pay_settings set extra_hour_amount = 20 where id;

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
select lives_ok($sql$
  select public.select_promoter('30000000-0000-0000-0000-000000000097',
    '10000000-0000-0000-0000-000000000006', 'Totem',
    array['40000000-0000-0000-0000-000000000097']::uuid[])
$sql$, 'Proprietária confirma seleção para evento acima da maior faixa');
select is((
  select p.amount from public.payments p join public.selections s on s.id = p.selection_id
  where s.job_id = '30000000-0000-0000-0000-000000000097'
), 170.00::numeric, 'Sugestão soma duas horas adicionais à maior faixa');
reset role;

select * from finish();
rollback;
