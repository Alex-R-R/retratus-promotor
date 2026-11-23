# Contrato de dados · fase 1

Acordo entre o banco (Codex, `supabase/`) e o app (Claude, `web/`). Mudou algo aqui? Atualize este arquivo no mesmo commit.

Fuso da operação: `America/Belem`. Horários gravados como `timestamptz`.

## Enums

| Enum | Valores |
| --- | --- |
| `user_role` | `owner`, `manager`, `media`, `promoter` |
| `person_link` | `freelancer`, `employee`, `provider`, `unclassified` |
| `job_type` | `evento`, `acao` |
| `briefing_status` | `aguardando`, `fechado` |
| `job_status` | `rascunho`, `publicado`, `realizado`, `cancelado` |
| `media_kind` | `foto`, `video`, `pasta` |
| `pay_source` | `tabela`, `manual` |

Equipamentos (texto com check): `Totem`, `Self print`, `Totem slim`, `Plataforma 360`, `Túnel de LED`, `Máquina de garra`.

## Tabelas (schema `public`)

- `profiles` (id = `auth.users.id`, full_name, phone, email, role default `promoter`, link default `unclassified`, approved default false, created_at). Criado por trigger no cadastro, lendo `full_name` e `phone` de `raw_user_meta_data`.
- `clients` (id, name, contact_name, phone, notes, created_at)
- `jobs` (id, type, title, client_id null, location, city, briefing default `aguardando`, status default `rascunho`, notes, cancel_reason, created_by, created_at, updated_at)
- `job_days` (id, job_id, starts_at, ends_at; ends_at > starts_at; evento tem exatamente 1 dia)
- `job_slots` (id, job_id, equipment, capacity 1–30; único por job+equipment)
- `applications` (id, job_id, promoter_id, equipment text[], created_at; único por job+promoter)
- `selections` (id, job_id, promoter_id, equipment, created_by, created_at) + `selection_days` (selection_id, job_day_id)
- `event_pay_rates` (hours int pk, amount numeric) + `pay_settings` (singleton: extra_hour_amount numeric null)
- `payments` (selection_id pk, amount numeric, source, updated_by, updated_at)
- `media_items` (id, job_id, url, kind, title, added_by, created_at)
- `notifications` (id, user_id, kind, title, body, link, read_at, created_at)
- `audit_log` (id, actor_id, action, entity, entity_id, details jsonb, created_at)

## Regras no banco

- Selecionar = confirmado. Trava: o promotor não pode ter dois `selection_days` com horários sobrepostos (inclusive em trabalhos diferentes). Capacidade por equipamento e dia respeitada.
- Candidatura só em trabalho `publicado`, até 24h antes do primeiro `starts_at`, e só por promotor aprovado.
- Notificações automáticas (trigger): trabalho publicado → todos os promotores aprovados; seleção criada → o promotor selecionado; cadastro aprovado → a pessoa.
- Valor: para `evento`, sugerido pela tabela de horas (+ hora adicional, se configurada). Para `acao`, manual. Donos podem sobrescrever.

## Acesso (RLS)

| Recurso | owner | manager | media | promoter aprovado |
| --- | --- | --- | --- | --- |
| profiles | tudo; aprova; muda perfil | lê todos | lê o próprio | lê/edita nome e telefone próprios |
| jobs, job_days, job_slots, clients | tudo | tudo | lê | lê publicados futuros e os em que foi selecionado (clients: não) |
| applications | lê | lê | não | cria/lê/remove as próprias |
| selections, selection_days | tudo | tudo | lê | lê as próprias |
| event_pay_rates, pay_settings, payments | tudo | não | não | não |
| media_items | tudo | tudo | cria/lê/edita | não |
| notifications | só as próprias (ler, marcar como lida) | idem | idem | idem |

Não aprovado: só lê o próprio profile.

Ajuste 23/11 (migration `..._0004`): qualquer pessoa aprovada edita o próprio nome e telefone, não só promotores. `notifications` está na publicação `supabase_realtime`.

Ponto aberto do Codex: evento e seu único dia precisam ser gravados na mesma transação. Na fase 2, a criação de trabalho será uma RPC.

## Funções RPC (para o app)

- `dashboard_counts(p_from timestamptz, p_to timestamptz)` → `aguardando_briefing`, `briefing_fechado`, `vagas_abertas`, `equipe_completa` (owner/manager).
- `promoter_job_counts(p_from, p_to)` → por promotor: `promoter_id`, `full_name`, `eventos`, `dias_acao`, `valor_total` (valor só preenchido para owner).
- `agenda(p_from, p_to)` → linhas de `job_days` com trabalho, local, horários e promotores selecionados. Promotor recebe só os dias em que foi selecionado.
- `select_promoter(p_job_id, p_promoter_id, p_equipment, p_day_ids uuid[])` → cria seleção com as travas acima.

## Usuários locais de teste (só `supabase/seed.sql`, senha `demo123`)

`dona@retratus.test` (owner), `gestao@retratus.test` (manager), `midia@retratus.test` (media), `promotor01@retratus.test` … `promotor06@retratus.test` (promoter aprovados), `novo@retratus.test` (promoter não aprovado). Dados fictícios.
