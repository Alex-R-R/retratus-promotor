# Retratus · vagas de eventos e ações

App onde a Retratus publica eventos/ações com vagas por equipamento, promotores se candidatam e a gestão seleciona quem trabalha. Inclui dashboard de valores e calendário de escalas (quando, onde e horário de cada promotor).

## Estado atual

Demonstração criada pelo Codex: JavaScript puro (ES modules), sem dependências, Node 22+, dados fictícios em `localStorage`. Detalhes e limites no `README.md`.

- `src/domain.js` regras (candidatura, convocação, conflitos, prazos, fotos, métricas)
- `src/repository.js` persistência local (trocar por API no futuro)
- `src/app.js` + `src/styles.css` interface
- `tests/` testes com `node --test`

Comandos: `npm run dev` (http://localhost:4173), `npm test`, `npm run lint`, `npm run build`.

## App de produção (em construção)

- Plano: `docs/PLANO-PRODUCAO.md`. Contrato banco ↔ app: `docs/CONTRATO-DADOS.md`.
- `supabase/`: migrations, RLS, RPCs, seed e testes pgTAP (frente do Codex).
- `web/`: React + TypeScript + Vite (frente do Claude). `npm --prefix web run dev`, `npm --prefix web run build`, `npm --prefix web run lint`.
- Local: Docker Desktop ligado, `npx supabase start`, `npx supabase db reset`, `npx supabase test db`. Copiar URL e anon key para `web/.env.local`.

## Skills do projeto (`.claude/skills/`)

- `retratus-ui` identidade visual e regras anti "cara de IA". Ler antes de mexer em tela.
- `frontend-design` direção visual geral.
- `webapp-testing` testar o app no navegador com Playwright.
- `graphify` grafo de conhecimento do código (`/graphify`).

## Trabalho em conjunto com o Codex

- Codex criou a base; Claude Code e Codex editam o mesmo repositório. Antes de alterar, leia o arquivo atual (o outro pode ter mudado).
- Regras de negócio ficam em `src/domain.js` com teste em `tests/`. Toda regra nova ganha teste.
- Para segunda opinião ou tarefa delegada ao Codex use `/codex:rescue`.
- Dados sempre fictícios; nunca inserir telefones ou nomes reais.
