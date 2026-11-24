begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(55);

insert into jobs (id, type, title, status) values
  ('f5000000-0000-0000-0000-000000000001', 'acao', 'Ação fictícia', 'publicado'),
  ('f5000000-0000-0000-0000-000000000002', 'acao', 'Trabalho realizado', 'realizado'),
  ('f5000000-0000-0000-0000-000000000003', 'acao', 'Rascunho', 'rascunho'),
  ('f5000000-0000-0000-0000-000000000004', 'acao', 'A cancelar', 'publicado'),
  ('f5000000-0000-0000-0000-000000000005', 'acao', 'Fora do período', 'publicado');

insert into job_days (job_id, starts_at, ends_at) values
  ('f5000000-0000-0000-0000-000000000001', '2099-05-31 22:00+00', '2099-06-01 02:00+00'),
  ('f5000000-0000-0000-0000-000000000001', '2099-07-01 12:00+00', '2099-07-01 15:00+00'),
  ('f5000000-0000-0000-0000-000000000002', '2099-06-02 12:00+00', '2099-06-02 15:00+00'),
  ('f5000000-0000-0000-0000-000000000003', '2099-06-03 12:00+00', '2099-06-03 15:00+00'),
  ('f5000000-0000-0000-0000-000000000004', '2099-06-04 12:00+00', '2099-06-04 15:00+00'),
  ('f5000000-0000-0000-0000-000000000005', '2099-07-01 00:00+00', '2099-07-01 03:00+00');

insert into job_slots (job_id, equipment, capacity) values
  ('f5000000-0000-0000-0000-000000000001', 'Totem', 2),
  ('f5000000-0000-0000-0000-000000000001', 'Self print', 1);
insert into selections (job_id, promoter_id, equipment) values
  ('f5000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'Totem'),
  ('f5000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'Self print'),
  ('f5000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'Totem');

-- Perfil pendente com papel de gestão para exercitar o filtro de aprovação.
update profiles set role = 'manager' where id = '10000000-0000-0000-0000-000000000010';

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000001', 'http://drive.google.com/foto', 'foto', 'Link')$$, '23514', 'Use um link do Google Drive.', 'Recusa HTTP');
select throws_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000001', 'https://drive.google.com.example.test/foto', 'foto', 'Link')$$, '23514', 'Use um link do Google Drive.', 'Recusa domínio semelhante');
select throws_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000001', E'https://docs.google.com/a\tb', 'foto', 'Link')$$, '23514', 'Use um link do Google Drive.', 'Recusa espaço em branco na URL');
select throws_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000001', 'https://drive.google.com/' || repeat('a', 2000), 'foto', 'Link')$$, '23514', 'Use um link do Google Drive.', 'Recusa URL maior que 2000 caracteres');
select throws_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000001', 'https://drive.google.com/foto', 'foto', ' Link ')$$, '23514', 'Use um título de 1 a 120 caracteres, sem espaços nas pontas.', 'Recusa espaços nas pontas do título');
select throws_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000001', 'https://drive.google.com/foto', 'foto', '')$$, '23514', 'Use um título de 1 a 120 caracteres, sem espaços nas pontas.', 'Recusa título vazio');
select throws_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000001', 'https://drive.google.com/foto', 'foto', repeat('a', 121))$$, '23514', 'Use um título de 1 a 120 caracteres, sem espaços nas pontas.', 'Recusa título maior que 120 caracteres');
select throws_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000003', 'https://drive.google.com/foto', 'foto', 'Link')$$, '23514', 'Mídias só entram em trabalhos publicados ou realizados.', 'Recusa mídia no rascunho');

insert into media_items (job_id, url, kind, title, added_by, created_at) values
  ('f5000000-0000-0000-0000-000000000001', 'https://drive.google.com/foto', 'foto', 'Fotos', '10000000-0000-0000-0000-000000000003', '2099-06-03 12:00+00'),
  ('f5000000-0000-0000-0000-000000000001', 'https://docs.google.com/video', 'video', 'Vídeo', '10000000-0000-0000-0000-000000000002', '2099-06-04 12:00+00'),
  ('f5000000-0000-0000-0000-000000000004', 'https://drive.google.com/cancelado', 'foto', 'Histórico', null, '2099-06-04 12:00+00');
select results_eq($$select added_by from media_items where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos'$$, $$values ('10000000-0000-0000-0000-000000000001'::uuid)$$, 'A proprietária lê a mídia gravada com o próprio ID');
select throws_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000001', 'https://drive.google.com/foto', 'foto', 'Link')$$, '23505', 'Este link já está neste trabalho.', 'Recusa link duplicado no insert');
select throws_ok($$update media_items set url = 'https://docs.google.com/video' where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos'$$, '23505', 'Este link já está neste trabalho.', 'Recusa link duplicado no update');
select throws_ok($$update media_items set url = 'https://example.test/foto' where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos'$$, '23514', 'Use um link do Google Drive.', 'Valida URL também no update');
select throws_ok($$update media_items set title = ' Fotos' where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos'$$, '23514', 'Use um título de 1 a 120 caracteres, sem espaços nas pontas.', 'Valida título também no update');
select lives_ok($$update media_items set title = 'Fotos' where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos'$$, 'Update aceita manter a URL da própria mídia');
select lives_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000002', 'https://drive.google.com/foto', 'foto', 'Link')$$, 'Trabalho realizado aceita a mesma URL de outro trabalho');
select is((select count(*) from job_media('f5000000-0000-0000-0000-000000000001') where added_by_name = 'Conta fictícia de proprietária'), 2::bigint, 'Proprietária acessa job_media e vê o próprio nome');
select is((select count(*) from media_overview('2099-06-01 00:00+00', '2099-07-01 00:00+00')), 3::bigint, 'Proprietária acessa media_overview');
select is((select count(*) from notifications where kind = 'midia' and link = '/midias/f5000000-0000-0000-0000-000000000001'), 0::bigint, 'Proprietária que adicionou fica sem aviso');
with changed as (
  delete from media_items where job_id = 'f5000000-0000-0000-0000-000000000002' returning title
)
select is((select array_agg(title) from changed), array['Link'::text], 'Proprietária apaga mídia');

reset role;
select throws_ok($$update media_items set job_id = 'f5000000-0000-0000-0000-000000000002' where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos'$$, '23514', 'O trabalho e o autor da mídia não podem ser alterados.', 'Trigger recusa mudança de trabalho');
select throws_ok($$update media_items set added_by = '10000000-0000-0000-0000-000000000003' where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos'$$, '23514', 'O trabalho e o autor da mídia não podem ser alterados.', 'Trigger recusa mudança de autor');
update jobs set status = 'rascunho' where id = 'f5000000-0000-0000-0000-000000000004';

set local role authenticated;
select throws_ok(
  $$update media_items set title = 'Nova' where job_id = 'f5000000-0000-0000-0000-000000000004'$$,
  '23514', 'Mídias só entram em trabalhos publicados ou realizados.', 'Recusa alterar mídia em rascunho');

reset role;
update jobs set status = 'cancelado' where id = 'f5000000-0000-0000-0000-000000000004';

set local role authenticated;
select throws_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000004', 'https://drive.google.com/nova', 'foto', 'Link')$$, '23514', 'Mídias só entram em trabalhos publicados ou realizados.', 'Recusa inserir em trabalho cancelado');
select throws_ok($$update media_items set title = 'Nova' where job_id = 'f5000000-0000-0000-0000-000000000004'$$, '23514', 'Mídias só entram em trabalhos publicados ou realizados.', 'Recusa alterar mídia em trabalho cancelado');
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*) from media_items where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos'), 1::bigint, 'Gestão lê mídia');
with changed as (
  insert into media_items (job_id, url, kind, title, created_at)
  values ('f5000000-0000-0000-0000-000000000001', 'https://drive.google.com/pasta', 'pasta', 'Pasta', '2099-06-05 12:00+00') returning added_by
)
select is((select array_agg(added_by) from changed), array['10000000-0000-0000-0000-000000000002'::uuid], 'Gestão insere mídia');
with changed as (
  update media_items set title = 'Pasta editada' where job_id = 'f5000000-0000-0000-0000-000000000001' and kind = 'pasta' returning title
)
select is((select array_agg(title) from changed), array['Pasta editada'::text], 'Gestão altera mídia');
select results_eq($$select title, added_by_name from job_media('f5000000-0000-0000-0000-000000000001')$$, $$values ('Pasta editada'::text, 'Conta fictícia de gestão'::text),
          ('Vídeo', 'Conta fictícia de proprietária'), ('Fotos', 'Conta fictícia de proprietária')$$, 'job_media lista da mais nova para a mais antiga com o nome do autor');
select results_eq($$select job_id, day_count, team_count, media_count, fotos, videos, pastas, last_added_at from media_overview('2099-06-01 00:00+00', '2099-07-01 00:00+00')$$, $$values ('f5000000-0000-0000-0000-000000000001'::uuid, 2::bigint, 2::bigint, 3::bigint, 1::bigint, 1::bigint, 1::bigint, '2099-06-05 12:00+00'::timestamptz),
          ('f5000000-0000-0000-0000-000000000002'::uuid, 1::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, null::timestamptz)$$, 'Resumo inclui dias cruzados, equipe distinta, totais por tipo e trabalho realizado sem mídia');
select results_eq($$select first_start, last_end from media_overview('2099-06-01 00:00+00', '2099-07-01 00:00+00') where job_id = 'f5000000-0000-0000-0000-000000000001'$$, $$values ('2099-05-31 22:00+00'::timestamptz, '2099-07-01 15:00+00'::timestamptz)$$, 'Resumo usa todas as datas do trabalho, mesmo quando só um dia cruza o período');
with changed as (
  delete from media_items where job_id = 'f5000000-0000-0000-0000-000000000004' returning title
)
select is((select array_agg(title) from changed), array['Histórico'::text], 'Gestão pode apagar mídia de trabalho cancelado');
select results_eq($$select kind, title, body, link from notifications where kind = 'midia' and link = '/midias/f5000000-0000-0000-0000-000000000001'$$, $$values ('midia'::text, 'Mídias adicionadas'::text, 'Ação fictícia: Conta fictícia de proprietária adicionou o primeiro link.'::text, '/midias/f5000000-0000-0000-0000-000000000001'::text)$$, 'Lote e inserção posterior geram um único aviso com o conteúdo do contrato');

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*) from media_items where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos'), 1::bigint, 'Perfil de mídia lê links');
select is((select count(*) from media_overview('2099-06-01 00:00+00', '2099-07-01 00:00+00')), 2::bigint, 'Perfil de mídia acessa media_overview');
select is((select count(*) from job_media('f5000000-0000-0000-0000-000000000001')), 3::bigint, 'Perfil de mídia acessa job_media');
with changed as (
  insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000002', 'https://drive.google.com/refeito', 'foto', 'Link') returning added_by
)
select is((select array_agg(added_by) from changed), array['10000000-0000-0000-0000-000000000003'::uuid], 'Perfil de mídia insere link após exclusão do primeiro');
with changed as (
  update media_items set kind = 'video', title = 'Outro', url = 'https://docs.google.com/refeito' where job_id = 'f5000000-0000-0000-0000-000000000002' returning title
)
select is((select array_agg(title) from changed), array['Outro'::text], 'Perfil de mídia altera tipo, título e URL');
with changed as (
  delete from media_items where job_id = 'f5000000-0000-0000-0000-000000000002' returning title
)
select is((select array_agg(title) from changed), array['Outro'::text], 'Perfil de mídia apaga link');

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*) from media_items where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos'), 0::bigint, 'Promotor aprovado não lê mídia');
select throws_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000001', 'https://drive.google.com/bloqueado', 'foto', 'Link')$$, '42501', null, 'Promotor aprovado não insere mídia');
with changed as (
  update media_items set title = 'Bloqueado' where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos' returning id
)
select is((select count(*) from changed), 0::bigint, 'Promotor aprovado não altera mídia');
with changed as (
  delete from media_items where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos' returning id
)
select is((select count(*) from changed), 0::bigint, 'Promotor aprovado não apaga mídia');
select throws_ok($$select * from media_overview('2099-06-01 00:00+00', '2099-07-01 00:00+00')$$, '42501', null, 'Promotor aprovado não acessa media_overview');
select throws_ok($$select * from job_media('f5000000-0000-0000-0000-000000000001')$$, '42501', null, 'Promotor aprovado não acessa job_media');

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000010","role":"authenticated"}';
select is((select count(*) from media_items where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos'), 0::bigint, 'Gestor pendente não lê mídia');
select throws_ok($$insert into media_items (job_id, url, kind, title) values ('f5000000-0000-0000-0000-000000000001', 'https://drive.google.com/bloqueado', 'foto', 'Link')$$, '42501', null, 'Gestor pendente não insere mídia');
with changed as (
  update media_items set title = 'Bloqueado' where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos' returning id
)
select is((select count(*) from changed), 0::bigint, 'Gestor pendente não altera mídia');
with changed as (
  delete from media_items where job_id = 'f5000000-0000-0000-0000-000000000001' and title = 'Fotos' returning id
)
select is((select count(*) from changed), 0::bigint, 'Gestor pendente não apaga mídia');
select throws_ok($$select * from media_overview('2099-06-01 00:00+00', '2099-07-01 00:00+00')$$, '42501', null, 'Gestor pendente não acessa media_overview');
select throws_ok($$select * from job_media('f5000000-0000-0000-0000-000000000001')$$, '42501', null, 'Gestor pendente não acessa job_media');

reset role;
select is((select count(*) from notifications where kind = 'midia' and link = '/midias/f5000000-0000-0000-0000-000000000001'), 1::bigint, 'Apenas a gestora aprovada recebeu o aviso');
select is((select count(*) from notifications where kind = 'midia' and link = '/midias/f5000000-0000-0000-0000-000000000002'), 1::bigint, 'Apagar e reinserir mídia não gera outro aviso');
select ok(not has_table_privilege('anon', 'public.media_items', 'SELECT')
    and not has_table_privilege('anon', 'public.media_items', 'INSERT')
    and not has_table_privilege('anon', 'public.media_items', 'DELETE')
    and not has_any_column_privilege('anon', 'public.media_items', 'UPDATE'), 'Anônimo não tem privilégios na tabela');
select ok(not has_function_privilege('anon', 'public.job_media(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.media_overview(timestamptz,timestamptz)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.job_media(uuid)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.media_overview(timestamptz,timestamptz)', 'EXECUTE'), 'Anônimo e service_role não executam as RPCs');

delete from profiles where id = '10000000-0000-0000-0000-000000000002';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq($$select added_by, added_by_name from job_media('f5000000-0000-0000-0000-000000000001') where title = 'Pasta editada'$$, $$values (null::uuid, null::text)$$, 'Apagar o perfil preserva a mídia e retorna autor nulo');

select * from finish();
rollback;
