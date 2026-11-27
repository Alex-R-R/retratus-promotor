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

- Plano: `docs/PLANO-PRODUCAO.md`. Contrato banco ↔ app: `docs/CONTRATO-DADOS.md`. Publicação (Supabase nuvem, Cloudflare Pages, domínio, backup): `docs/PUBLICACAO.md`.
- App instalável (PWA) via `vite-plugin-pwa`; ícones gerados de `web/public/icon.svg` com `npx pwa-assets-generator` (na pasta `web`).
- GitHub Actions: `verificacao.yml` (lint, build e testes do banco a cada envio) e `backup.yml` (cópia diária criptografada).
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

## Diretrizes de código (Karpathy)

Diretrizes de comportamento para reduzir erros comuns de LLMs ao programar. Combinar com as instruções do projeto acima.

**Compromisso:** estas diretrizes priorizam cautela em vez de velocidade. Em tarefas triviais, use o bom senso.

### 1. Pensar antes de programar

**Não presuma. Não esconda dúvidas. Mostre os prós e contras.**

Antes de implementar:
- Declare suas suposições. Se estiver em dúvida, pergunte.
- Se houver mais de uma interpretação, apresente todas; não escolha em silêncio.
- Se existir um caminho mais simples, diga. Discorde quando fizer sentido.
- Se algo estiver confuso, pare. Diga o que está confuso. Pergunte.

### 2. Simplicidade primeiro

**O mínimo de código que resolve o problema. Nada especulativo.**

- Nenhuma funcionalidade além do que foi pedido.
- Nenhuma abstração para código usado uma única vez.
- Nenhuma "flexibilidade" ou "configurabilidade" que não foi pedida.
- Nenhum tratamento de erro para cenários impossíveis.
- Se escreveu 200 linhas e dava para fazer em 50, reescreva.

Pergunte-se: "Um engenheiro sênior diria que isso está complicado demais?" Se sim, simplifique.

### 3. Mudanças cirúrgicas

**Mexa só no necessário. Limpe só a sua própria bagunça.**

Ao editar código existente:
- Não "melhore" código, comentários ou formatação ao redor.
- Não refatore o que não está quebrado.
- Siga o estilo existente, mesmo que você faria diferente.
- Se notar código morto sem relação com a tarefa, avise; não apague.

Quando suas mudanças deixarem sobras:
- Remova imports, variáveis e funções que as SUAS mudanças deixaram sem uso.
- Não remova código morto que já existia, a não ser que peçam.

O teste: cada linha alterada deve ter ligação direta com o pedido do usuário.

### 4. Execução guiada por objetivos

**Defina critérios de sucesso. Repita até confirmar.**

Transforme tarefas em objetivos verificáveis:
- "Adicionar validação" → "Escrever testes para entradas inválidas e fazê-los passar"
- "Corrigir o bug" → "Escrever um teste que reproduz o bug e fazê-lo passar"
- "Refatorar X" → "Garantir que os testes passam antes e depois"

Em tarefas com várias etapas, apresente um plano curto:
```
1. [Etapa] → verificar: [checagem]
2. [Etapa] → verificar: [checagem]
3. [Etapa] → verificar: [checagem]
```

Critérios fortes permitem trabalhar com autonomia. Critérios fracos ("faça funcionar") exigem pedir esclarecimento o tempo todo.

---

**Sinais de que estas diretrizes funcionam:** menos mudanças desnecessárias nos diffs, menos reescritas por excesso de complexidade, e perguntas de esclarecimento antes da implementação, não depois dos erros.
