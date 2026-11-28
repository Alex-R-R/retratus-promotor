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

Equipamentos padrão: `Totem`, `Self print`, `Totem slim`, `Plataforma 360`, `Túnel de LED`, `Máquina de garra`. Evento só usa estes (constraint trigger adiada `event_standard_equipment`). Ação aceita também serviço digitado (2 a 60 caracteres, sem espaço nas pontas).

## Tabelas (schema `public`)

- `profiles` (id = `auth.users.id`, full_name, phone, email, role default `promoter`, link default `unclassified`, approved default false, created_at). Criado por trigger no cadastro, lendo `full_name` e `phone` de `raw_user_meta_data`.
- `clients` (id, name, contact_name, phone, notes, kind `client_kind` default `ambos`, listed default true, created_at). `kind` (`evento`, `acao`, `ambos`) filtra a escolha no formulário. `listed = false` é contratante avulso, criado na hora para um só trabalho.
- `action_services` (name pk, created_at): serviços de ação guardados para as próximas ações. Só owner/manager leem e escrevem.
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

## Fase 2 · fluxo de vagas (ramo `fase-2`)

Tudo em uma nova migration `2026112400000x_fase2_*.sql`. Não reescrever migrations da fase 1.

### Escrita (owner/manager, `security definer`, uma transação cada)

- `save_job(p_job_id uuid, p_job jsonb, p_days jsonb, p_slots jsonb) returns uuid`
  - `p_job_id` nulo cria; preenchido edita.
  - `p_job`: `{type, title, client_id, location, city, briefing, notes}`.
  - `p_days`: `[{id?, starts_at, ends_at}]`. Dia com `id` é atualizado, sem `id` é criado, e o dia que ficar de fora é removido.
  - `p_slots`: `[{equipment, capacity}]`. O equipamento que ficar de fora é removido.
  - Recusa remover um dia ou equipamento que já tenha seleção, recusa reduzir capacidade abaixo dos selecionados e recusa editar trabalho `cancelado` ou `realizado`. O tipo `evento` continua com exatamente 1 dia.
  - Se um dia com selecionados mudar de horário, os promotores afetados recebem aviso `job_changed`, e as travas de conflito continuam valendo.
- `publish_job(p_job_id uuid)`: só sai de `rascunho`; exige ≥1 dia futuro e ≥1 equipamento. Mantém o aviso `job_published`.
- `cancel_job(p_job_id uuid, p_reason text)`: motivo obrigatório; vale para `rascunho` e `publicado`; avisa os selecionados (`job_cancelled`). As seleções ficam como histórico.
- `remove_selection(p_selection_id uuid)`: só antes do início do primeiro dia da seleção; avisa o promotor (`selection_removed`).
- `set_briefing(p_job_id uuid, p_briefing briefing_status)`: atalho para a gestão marcar o briefing.

### Candidatura (promotor aprovado)

- `apply_to_job(p_job_id uuid, p_equipment text[]) returns void` cria a candidatura do promotor autenticado ou atualiza seus equipamentos na mesma operação.
  - Exige trabalho `publicado`, equipamentos cadastrados para o trabalho e prazo aberto até 24 horas antes do primeiro dia. Após o prazo, a candidatura existente é preservada.
  - Envia `application_created` somente na criação. Para retirar a candidatura, use `DELETE` em `applications`.

### Leitura

- `jobs_overview(p_from timestamptz, p_to timestamptz)` (owner/manager/media) → uma linha por trabalho com dias no período (rascunhos sem dia também entram):
  `job_id, title, type, status, briefing, city, location, client_name, first_start, last_end, day_count, capacity_total, filled_total, applications_count, staffing ('sem_vagas'|'vagas_abertas'|'equipe_completa')`.
  - `capacity_total` = soma de capacidade × dias.
  - `filled_total` = soma dos `selection_days`.
  - `equipe_completa` quando cada equipamento está cheio em todos os dias.
- `job_board()` (promotor aprovado) → trabalhos `publicado` com prazo de candidatura aberto:
  `job_id, title, type, city, location, notes, application_deadline, days jsonb [{id, starts_at, ends_at}], slots jsonb [{equipment, capacity, open_days}], my_application text[] | null, i_am_selected bool`.
  - `open_days` = quantos dias ainda têm vaga nesse equipamento.
  - Não expõe nomes de outros promotores.
- `job_candidates(p_job_id uuid)` (owner/manager) → candidatos e selecionados:
  `promoter_id, full_name, phone, link, applied_equipment text[] | null, applied_at, selections jsonb [{selection_id, equipment, day_ids}], conflict_day_ids uuid[]`.
  - `conflict_day_ids` = dias deste trabalho em que a pessoa já está escalada em outro trabalho no mesmo horário, exceto se o outro trabalho estiver cancelado.
  - Inclui quem foi selecionado sem candidatura.
- `my_jobs(p_from, p_to)` (promotor) → os dias em que foi selecionado: `job_id, title, type, city, location, equipment, starts_at, ends_at, status`.

### Links dos avisos

Rotas do app: gestão `/trabalhos/<id>`, promotor `/vagas/<id>`, agenda do promotor `/meus-trabalhos`.

| Aviso | Link |
| --- | --- |
| `job_published` | `/vagas/<id>` |
| `selection_created`, `job_changed`, `job_cancelled`, `selection_removed` | `/meus-trabalhos` |
| candidatura nova (novo: `application_created`, para owner e manager) | `/trabalhos/<id>` |

## Fase 3 · calendário (ramo `fase-3`)

Nova migration `2026112500000x_fase3_*.sql`. A `agenda` da fase 1 continua como está.

- `calendar(p_from timestamptz, p_to timestamptz)` (qualquer perfil aprovado) → uma linha por `job_day` que cruza o período:
  - `day_id, job_id, title, type, status, briefing, location, city, client_name, starts_at, ends_at`
  - `slots jsonb`: `[{equipment, capacity, filled}]`. `filled` = seleções desse equipamento neste dia.
  - `promoters jsonb`: `[{promoter_id, full_name, equipment}]`.
  - **Promotor:** só os dias em que foi selecionado, inclusive de trabalho cancelado (aparece riscado). `slots` vem nulo, `client_name` nulo, e `promoters` só com ele mesmo.
  - **owner/manager/media:** todos os dias, exceto de `rascunho`, que só owner/manager recebem.
  - Ordenado por `starts_at`.

O link do aviso de seleção e de cancelamento passa a ser `/agenda?d=<data local do 1º dia>`. A rota `/meus-trabalhos` redireciona para `/agenda`.

## Fase 4 · painel e valores (ramo `fase-4`)

Nova migration `2026112600000x_fase4_*.sql`. Não reescrever migrations anteriores. Valores continuam só para owner (RLS e RPC).

### Pagamentos

- `payments` ganha `paid_at timestamptz null`. Pago = `paid_at` preenchido.
- A sugestão de valor de evento vira uma função única `retratus_private.event_suggestion(hours numeric) returns numeric`. Valor exato da tabela para a duração; acima da maior faixa, maior faixa + horas excedentes × `extra_hour_amount`. Retorna nulo quando não há regra.
- Recalcular `payments` com `source = 'tabela'` e `paid_at` nulo sempre que mudar `event_pay_rates`, `pay_settings` ou o horário de um `job_day` de evento:
  - cria a linha que faltava;
  - atualiza o valor;
  - remove a linha quando a sugestão fica nula.
  - Pagamento `manual` ou já pago nunca é tocado. Trabalho cancelado fica fora.
- Trabalho cancelado não entra em nenhum total.

### Leitura

- `dashboard_counts(p_from, p_to)` continua igual.
- `promoter_job_counts(p_from, p_to)` (owner/manager) passa a devolver:
  - `promoter_id, full_name, eventos, dias_acao, valor_total, valor_pago, sem_valor`.
  - Só promotores aprovados ou que tenham trabalho no período.
  - Os valores ficam nulos para manager. `sem_valor` é a quantidade de seleções sem pagamento.
  - Valores e `sem_valor` contam a seleção no período em que cai o **primeiro dia dela**, para uma ação que atravessa o mês não ser somada duas vezes.
- `payments_overview(p_from, p_to)` (owner) → uma linha por seleção cujo primeiro dia começa no período, sem trabalho cancelado:
  - `selection_id, job_id, title, type, promoter_id, full_name, equipment, day_count, hours numeric, first_start, amount numeric | null, source pay_source | null, suggested numeric | null, paid_at`.
  - `hours` é a soma das durações dos dias da seleção.
  - `suggested` é o valor da tabela (só evento).
  - Ordenado por `first_start` e depois por nome.

### Escrita (owner)

- `set_payment(p_selection_id uuid, p_amount numeric) returns void`.
  - Grava valor `manual`.
  - Com `p_amount` nulo, apaga o manual e volta para a sugestão da tabela, quando houver.
  - Recusa: valor negativo, seleção de trabalho cancelado e pagamento já pago (é preciso desmarcar antes).
- `set_paid(p_selection_ids uuid[], p_paid boolean) returns integer`.
  - Marca `paid_at = now()` ou o limpa e devolve quantas linhas mudaram.
  - Recusa seleção sem valor.
- Tabela de eventos: escrita direta em `event_pay_rates` (`hours`, `amount`) e `pay_settings.extra_hour_amount`. A RLS já limita ao owner, e o recálculo acima dispara sozinho.

## Fase 5 · mídias (ramo `fase-5`)

Nova migration `2026112700000x_fase5_*.sql`. Não reescrever migrations anteriores. Os arquivos ficam no Google Drive da empresa; o banco guarda só o link.

### `media_items`

- `url`: só link `https://drive.google.com/...` ou `https://docs.google.com/...`, sem espaços, até 2000 caracteres. Mensagem: "Use um link do Google Drive."
- `title`: sem espaços nas pontas, de 1 a 120 caracteres.
- Link repetido no mesmo trabalho é recusado (`unique (job_id, url)`). Mensagem: "Este link já está neste trabalho."
- Só entra mídia em trabalho `publicado` ou `realizado`. Rascunho e cancelado recusam inserir e alterar. Mensagem: "Mídias só entram em trabalhos publicados ou realizados."
- `job_id` e `added_by` não mudam depois de criados. No insert, `added_by` é sempre `auth.uid()`, mesmo que o app mande outro valor.
- Quem pode:
  - `owner`, `manager` e `media` aprovados leem, inserem, alteram e apagam.
  - `promoter` e anônimo não fazem nada.
  - O plano previa só leitura para donos e gestão. Eles mantêm a escrita para corrigir um link sem depender da conta de mídia.
- Escrita direta na tabela, pela RLS: insert, update de `title`, `kind` e `url`, e delete.

### Leitura

- `media_overview(p_from, p_to)` (owner, manager, media) devolve uma linha por trabalho `publicado` ou `realizado` com algum dia que cruza o período, como em `jobs_overview`. Colunas:
  - `job_id, title, type, status, city, location, client_name, first_start, last_end, day_count bigint`;
  - `team_count bigint`: promotores distintos escalados;
  - `media_count, fotos, videos, pastas` (bigint): contagem por tipo;
  - `last_added_at timestamptz | null`.
  - Ordem: `first_start`, depois `job_id`.
- `job_media(p_job_id)` (owner, manager, media) devolve `id, url, kind, title, added_by, added_by_name, created_at`, da mais nova para a mais antiga. `added_by_name` é nulo se o perfil foi apagado.

### Aviso

A primeira mídia de um trabalho gera um aviso para os donos e a gestão aprovados, exceto quem adicionou:

| Campo | Valor |
| --- | --- |
| `kind` | `midia` |
| `title` | "Mídias adicionadas" |
| `body` | "<título do trabalho>: <nome> adicionou o primeiro link." |
| `link` | `/midias/<job_id>` |

Mídias seguintes no mesmo trabalho não geram aviso.

## Fase 6 · produção (ramo `fase-6`)

Migration `20261128000001_fase6_producao.sql`:

- **Trava de horário e capacidade.** Mesmas regras e mensagens de antes, mas a checagem agora olha só as linhas que o comando mudou. Também passa a rodar quando um trabalho sai de `cancelado`.
- **`selections`.** Só aceita promotor aprovado (`role = promoter`), também na escrita direta. Mensagem: "Seleção exige promotor aprovado."
- **Remoção de seleção paga.** O banco recusa apagar uma seleção com pagamento marcado como pago. Os donos precisam desmarcar antes. Isso vale também para `remove_selection`.
- **`applications`.** O cliente só insere `job_id`, `promoter_id` e `equipment`. `id` e `created_at` vêm do banco.
- **Schema privado.** `retratus_private` fica sem execução para o cliente, exceto `promoter_can_read_job`, usada pela RLS.

Publicação, e-mails, domínio e backup estão em `docs/PUBLICACAO.md`.

## Revisão geral (ramo `revisao-geral`)

Migration `20261129000001_revisao_cancelamento_agenda.sql`, testes em `supabase/tests/fase7.test.sql`:

- **Cancelamento** (trigger em `jobs`, vale para `cancel_job` e para escrita direta) passa a recusar:
  - trabalho publicado com algum dia já começado. Mensagem: "Trabalho que já começou não pode ser cancelado." Rascunho com data passada ainda pode ser cancelado.
  - trabalho com pagamento marcado como pago. Mensagem: "Este trabalho tem pagamento feito. Os donos precisam desmarcar o pagamento antes de cancelar."
- **Pagamento** (trigger em `payments`, vale para `set_paid` e para escrita direta): não marca como pago seleção de trabalho cancelado. Mensagem: "Trabalho cancelado não recebe pagamento." Escritas em `payments` passam pelo mesmo `schedule_lock`.
- **`calendar`**: o promotor também recebe os dias de `rascunho` em que foi escalado. Mídia continua sem rascunhos.

## Usuários locais de teste (só `supabase/seed.sql`, senha `demo123`)

`dona@retratus.test` (owner), `gestao@retratus.test` (manager), `midia@retratus.test` (media), `promotor01@retratus.test` … `promotor06@retratus.test` (promoter aprovados), `novo@retratus.test` (promoter não aprovado). Dados fictícios.
