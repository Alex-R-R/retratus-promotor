-- Somente para a instância local.
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  account record;
  local_user_id uuid;
  owner_id constant uuid := '10000000-0000-0000-0000-000000000001';
begin
  for account in
    select * from (values
      (1, 'dona', 'Conta fictícia de proprietária', 'owner', true),
      (2, 'gestao', 'Conta fictícia de gestão', 'manager', true),
      (3, 'midia', 'Conta fictícia de mídia', 'media', true),
      (4, 'promotor01', 'Promotor fictício 01', 'promoter', true),
      (5, 'promotor02', 'Promotor fictício 02', 'promoter', true),
      (6, 'promotor03', 'Promotor fictício 03', 'promoter', true),
      (7, 'promotor04', 'Promotor fictício 04', 'promoter', true),
      (8, 'promotor05', 'Promotor fictício 05', 'promoter', true),
      (9, 'promotor06', 'Promotor fictício 06', 'promoter', true),
      (10, 'novo', 'Cadastro fictício pendente', 'promoter', false)
    ) as users(n, login, full_name, role_name, approved)
  loop
    local_user_id := ('10000000-0000-0000-0000-' || lpad(account.n::text, 12, '0'))::uuid;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
    ) values (
      '00000000-0000-0000-0000-000000000000', local_user_id, 'authenticated', 'authenticated',
      account.login || '@retratus.test', extensions.crypt('demo123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', account.full_name),
      now(), now(), '', '', '', '', ''
    );

    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (local_user_id::text, local_user_id,
      jsonb_build_object('sub', local_user_id, 'email', account.login || '@retratus.test', 'email_verified', true),
      'email', now(), now());

    update public.profiles set role = account.role_name::public.user_role, approved = account.approved
    where id = local_user_id;
  end loop;

  insert into public.event_pay_rates (hours, amount) values (4, 130.00);

  insert into public.clients (id, name) values
    ('20000000-0000-0000-0000-000000000001', 'Contratante fictício do Guajará'),
    ('20000000-0000-0000-0000-000000000002', 'Contratante fictício do Pará');

  insert into public.jobs (id, type, title, client_id, location, city, briefing, status, created_by) values
    ('30000000-0000-0000-0000-000000000001', 'evento', 'Mostra fictícia de fotografia',
     '20000000-0000-0000-0000-000000000001', 'Espaço fictício A', 'Belém', 'fechado', 'publicado', owner_id),
    ('30000000-0000-0000-0000-000000000002', 'acao', 'Circuito fictício de fim de ano',
     '20000000-0000-0000-0000-000000000002', 'Espaço fictício B', 'Ananindeua', 'aguardando', 'publicado', owner_id),
    ('30000000-0000-0000-0000-000000000003', 'evento', 'Encontro fictício de dezembro',
     null, 'Espaço fictício C', 'Marabá', 'aguardando', 'publicado', owner_id),
    ('30000000-0000-0000-0000-000000000004', 'evento', 'Feira fictícia de dezembro',
     null, 'Espaço fictício D', 'Belém', 'aguardando', 'rascunho', owner_id);

  insert into public.job_days (id, job_id, starts_at, ends_at) values
    ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '2026-11-28 18:00-03', '2026-11-28 22:00-03'),
    ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '2026-12-04 16:00-03', '2026-12-04 21:00-03'),
    ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '2026-12-05 16:00-03', '2026-12-05 21:00-03'),
    ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', '2026-12-12 18:00-03', '2026-12-12 21:00-03'),
    ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000004', '2026-12-19 14:00-03', '2026-12-19 18:00-03');

  insert into public.job_slots (job_id, equipment, capacity) values
    ('30000000-0000-0000-0000-000000000001', 'Totem', 1),
    ('30000000-0000-0000-0000-000000000002', 'Self print', 2),
    ('30000000-0000-0000-0000-000000000002', 'Totem slim', 1),
    ('30000000-0000-0000-0000-000000000003', 'Plataforma 360', 1),
    ('30000000-0000-0000-0000-000000000004', 'Máquina de garra', 2);

  -- Candidaturas históricas, registradas antes dos prazos em 2026. O trigger
  -- volta a vigorar nesta mesma transação, inclusive em resets após essas datas.
  alter table public.applications disable trigger check_application;
  insert into public.applications (job_id, promoter_id, equipment, created_at) values
    ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', array['Totem'], '2026-11-24 12:00-03'),
    ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', array['Totem'], '2026-11-24 12:15-03'),
    ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', array['Self print'], '2026-11-25 09:00-03'),
    ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006', array['Self print', 'Totem slim'], '2026-11-25 10:00-03'),
    ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000007', array['Plataforma 360'], '2026-11-26 10:00-03');
  alter table public.applications enable trigger check_application;

  insert into public.selections (id, job_id, promoter_id, equipment, created_by) values
    ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000004', 'Totem', owner_id),
    ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002',
     '10000000-0000-0000-0000-000000000005', 'Self print', owner_id),
    ('50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003',
     '10000000-0000-0000-0000-000000000007', 'Plataforma 360', owner_id);

  insert into public.selection_days (selection_id, job_day_id) values
    ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001'),
    ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002'),
    ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003'),
    ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000004');
end;
$$;
