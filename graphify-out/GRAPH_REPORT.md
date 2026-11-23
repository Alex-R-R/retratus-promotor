# Graph Report - Retratus  (2026-11-23)

## Corpus Check
- Corpus is ~11,932 words - fits in a single context window. You may not need a graph.

## Summary
- 168 nodes · 493 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.84)
- Token cost: 78,345 input · 0 output

## Community Hubs (Navigation)
- Regras de negócio (domain.js)
- Interface e formulários (app.js)
- Agenda, convocação e listas
- Persistência e base fictícia
- Arquitetura e regras do projeto
- Configuração npm
- Scripts de build e servidor
- Prazos, fotos e retenção
- Opções de hospedagem
- Substituição de dias

## God Nodes (most connected - your core abstractions)
1. `esc()` - 21 edges
2. `getEvent()` - 20 edges
3. `agenda()` - 16 edges
4. `interval()` - 16 edges
5. `invite()` - 16 edges
6. `log()` - 15 edges
7. `saveEvent()` - 15 edges
8. `metricView()` - 14 edges
9. `eventDetail()` - 13 edges
10. `assignmentCard()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Activity Types: Evento and Acao` --conceptually_related_to--> `publish()`  [INFERRED]
  README.md → src/domain.js
- `Convocation Expiry and 30-day Photo Deletion` --implements--> `expire()`  [INFERRED]
  README.md → src/domain.js
- `Application per Job (closes 24h before start)` --implements--> `apply()`  [INFERRED]
  README.md → src/domain.js
- `Manual Convocation (no automatic ranking)` --rationale_for--> `invite()`  [INFERRED]
  README.md → src/domain.js
- `Overlapping Convocation Conflict Check` --implements--> `respond()`  [INFERRED]
  README.md → src/domain.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Job Lifecycle: apply, convoke, confirm, photo, review, amount** — readme_application_flow, readme_manual_convocation, readme_schedule_conflicts, readme_photo_records, readme_record_review, readme_owner_amount [EXTRACTED 1.00]
- **Evaluated Hosting/Backend Options** — readme_cloudflare_workers_static_assets, readme_supabase_free, readme_supabase_cron, readme_cloudflare_d1, readme_cloudflare_r2 [EXTRACTED 1.00]

## Communities (10 total, 1 thin omitted)

### Community 0 - "Regras de negócio (domain.js)"
Cohesion: 0.15
Nodes (34): Application per Job (closes 24h before start), Hours Indicators (only reviewed records), Owner-only Amount (empty differs from zero), Management Review of Validated Hours, metricRange(), ACTIVITY_TYPES, apply(), cancelEvent() (+26 more)

### Community 1 - "Interface e formulários (app.js)"
Cohesion: 0.16
Nodes (35): accounts(), actions(), applyForm(), clockForm(), dayFields(), empty(), esc(), eventForm() (+27 more)

### Community 2 - "Agenda, convocação e listas"
Cohesion: 0.25
Nodes (22): Overlapping Convocation Conflict Check, agenda(), assignmentCard(), badge(), dateLabel(), eventCard(), eventDetail(), eventList() (+14 more)

### Community 3 - "Persistência e base fictícia"
Cohesion: 0.20
Nodes (11): Restaurar Demonstracao (reset base), Reproducible Fictitious Seed Base (src/seed.js), DAY, load(), reset(), save(), transact(), createSeed() (+3 more)

### Community 4 - "Arquitetura e regras do projeto"
Cohesion: 0.13
Nodes (15): Domain Rules Layer (src/domain.js), Local Persistence Layer (src/repository.js), Project Skills (.claude/skills), Retratus App (vagas de eventos e acoes), retratus-ui Skill (visual identity, anti AI-look), UI Layer (src/app.js + src/styles.css), #app Mount Point, index.html App Shell (+7 more)

### Community 5 - "Configuração npm"
Cohesion: 0.15
Nodes (12): engines, node, name, private, scripts, build, dev, lint (+4 more)

### Community 6 - "Scripts de build e servidor"
Cohesion: 0.22
Nodes (3): root, server, types

### Community 7 - "Prazos, fotos e retenção"
Cohesion: 0.33
Nodes (6): Cloudflare R2 Standard (alternative photo storage), Demo Clock (18/11/2026 10h Belem, manual advance), Convocation Expiry and 30-day Photo Deletion, Start/End Photo Records (JPG/PNG/WebP up to 1 MB), POLICY (timezone, Monday week, civil month, deadlines), Supabase Cron

### Community 8 - "Opções de hospedagem"
Cohesion: 0.50
Nodes (3): Cloudflare D1 Free (alternative DB), Cloudflare Workers Static Assets, Supabase Free (DB, auth, storage)

## Knowledge Gaps
- **14 isolated node(s):** `Project Skills (.claude/skills)`, `User Profiles (dono, gestor, midia, promotor, funcionario, prestador)`, `Application per Job (closes 24h before start)`, `Overlapping Convocation Conflict Check`, `Owner-only Amount (empty differs from zero)` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 48 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `publish()` connect `Regras de negócio (domain.js)` to `Interface e formulários (app.js)`, `Agenda, convocação e listas`, `Arquitetura e regras do projeto`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `agenda()` (e.g. with `eventCard()` and `pageContent()`) actually correct?**
  _`agenda()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Project Skills (.claude/skills)`, `User Profiles (dono, gestor, midia, promotor, funcionario, prestador)`, `Application per Job (closes 24h before start)` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Regras de negócio (domain.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.14509246088193456 - nodes in this community are weakly interconnected._
- **Why does `load()` connect `Persistência e base fictícia` to `Regras de negócio (domain.js)`, `Interface e formulários (app.js)`, `Arquitetura e regras do projeto`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Should `Arquitetura e regras do projeto` be split into smaller, more focused modules?**
  _Cohesion score 0.1323529411764706 - nodes in this community are weakly interconnected._