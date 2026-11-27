# Retratus · plano de produção

Versão 1 · 23/11/2026 · documento de trabalho entre cliente, Claude Code e Codex.

A demonstração atual (`src/`) continua como referência de regras e visual. O app de produção será construído ao lado dela e substitui a demo quando a fase 2 estiver pronta.

## 1. Decisões do cliente

| Tema | Decisão |
| --- | --- |
| Ambiente | App real, com login e banco compartilhado |
| Seleção | Selecionar já confirma. Só o promotor selecionado é avisado |
| Pagamento | Por trabalho. Varia com a quantidade de horas e com o tipo (Evento ou Ação), não com o equipamento |
| Calendário | Filtro por dia, semana e mês. Promotor vê só a própria agenda; gestão e donos veem tudo |
| Comprovação | Sai a foto de início e fim. Entra a área **Mídias**, onde a equipe de comunicação sobe fotos e vídeos |
| Perfil mídia | Social media da empresa |
| Notificações | Dentro do app |

## 2. Ciclo de um trabalho

Dois andamentos independentes, mostrados juntos em cada trabalho:

**Briefing (contratante)**

1. `Aguardando briefing`: o contratante ainda não enviou local, horário ou detalhes finais.
2. `Briefing fechado`: o contratante confirmou os detalhes.

**Equipe (Retratus)**

1. `Rascunho`: só a gestão vê.
2. `Vagas abertas`: publicado, promotores podem se candidatar.
3. `Equipe completa`: todas as vagas têm promotor selecionado.
4. `Realizado` / `Cancelado`.

O passo a passo:

1. A gestão cria o trabalho (Evento = um dia; Ação = vários dias), com equipamentos e número de vagas por equipamento.
2. A gestão publica. Os promotores aprovados recebem aviso de vaga nova.
3. O promotor abre a vaga e se candidata a um ou mais equipamentos.
4. A gestão vê os candidatos por equipamento e seleciona. O sistema impede selecionar quem já está em outro trabalho no mesmo horário.
5. O selecionado recebe aviso e o trabalho entra na agenda dele. Quem não foi selecionado não recebe aviso.
6. Depois do trabalho, a equipe de mídia sobe fotos e vídeos. Os donos conferem e registram o valor pago.

## 3. Nomes no dashboard

Proposta de nomes para apresentar ao cliente (contagens por período: semana, mês ou intervalo):

| Pedido original | Nome no painel |
| --- | --- |
| Eventos/ações pendentes (aguardando contratante) | **Aguardando briefing** |
| Eventos/ações confirmados pelo contratante | **Briefing fechado** |
| Eventos/ações aguardando promotor | **Vagas em aberto** |
| Eventos/ações com promotor confirmado | **Equipe completa** |
| Quantidade de eventos/ações por promotor | **Trabalhos por promotor** (ranking com eventos e dias de ação separados) |

Se os donos quiserem, o painel também soma o **valor a pagar por promotor** no período, visível só para eles.

## 4. Arquitetura proposta

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite, instalável no celular (PWA) | Promotor usa no celular sem loja de apps; tipagem evita erro entre front e banco |
| Banco e login | Supabase (Postgres, Auth, Storage, Realtime) | Já avaliado pelo Codex; regras de acesso no próprio banco (RLS); Realtime entrega as notificações no app |
| Arquivos de mídia | Google Drive da empresa (o app guarda links) | Sem custo extra; vídeo não ocupa o Supabase |
| Hospedagem | Cloudflare Pages ou Vercel (plano grátis) | Site estático, deploy a cada push |
| Código | Repositório Git no GitHub | Necessário para Claude e Codex trabalharem em ramos separados e para o deploy |

Segurança: toda regra de "quem vê o quê" fica no banco (RLS), não só na tela. Valores só para donos.

## 5. Modelo de dados (rascunho para o Codex)

- `profiles`: nome, telefone, perfil (`owner`, `manager`, `media`, `promoter`), vínculo (`freelancer`, `employee`, `provider`), aprovado.
- `clients`: contratantes.
- `jobs`: tipo (`evento`/`acao`), título, contratante, local, município, briefing (`aguardando`/`fechado`), status, observações.
- `job_days`: data, início, fim (pode virar a madrugada).
- `job_slots`: equipamento e quantidade de vagas.
- `applications`: candidatura do promotor a um trabalho e equipamentos.
- `selections`: promotor selecionado, equipamento, dias. Com trava de conflito de horário.
- `pay_rules` e `payments`: regra por tipo e faixa de horas; valor final por promotor e trabalho.
- `media_items`: arquivo, tipo (foto/vídeo), trabalho, quem enviou.
- `notifications`: destinatário, tipo, link, lida em.
- `audit_log`: quem fez o quê.

## 6. Telas

| Tela | Donos | Gestão | Mídia | Promotor |
| --- | --- | --- | --- | --- |
| Painel (dashboard) | tudo + valores | tudo, sem valores | não | não |
| Calendário dia/semana/mês | tudo | tudo | trabalhos (para cobertura) | só a própria agenda |
| Trabalhos: criar, publicar, selecionar | sim | sim | ver | não |
| Vagas abertas e candidatura | não | não | não | sim |
| Mídias | ver | ver | subir e organizar | não |
| Equipe: aprovar cadastro, perfis | sim | ver | não | não |
| Notificações | sim | sim | sim | sim |

## 7. Divisão Claude Code × Codex

| Frente | Responsável | Revisor |
| --- | --- | --- |
| Arquitetura, estrutura do projeto, contrato de tipos | Claude | Codex |
| Schema SQL, migrations, RLS, funções e triggers (conflito, notificações, contagens do painel) | Codex | Claude |
| Testes de regras e de permissões no banco | Codex | Claude |
| Design system, telas, calendário, dashboard, mobile | Claude | Codex |
| Integração frontend ↔ Supabase, notificações em tempo real | Claude | Codex |
| Revisão de segurança antes de cada entrega | Codex | Claude |

Combinação: cada frente em um ramo próprio, revisão cruzada antes de juntar. Os tipos TypeScript são gerados a partir do schema, para que o front e o banco não se desencontrem.

## 8. Fases

0. **Preparação** (cliente): criar conta Supabase e repositório GitHub; responder às decisões pendentes.
1. **Fundação**: projeto React, login, perfis, aprovação de cadastro, schema com RLS.
2. **Fluxo de vagas**: criar, publicar, candidatar, selecionar, avisar.
3. **Calendário** dia/semana/mês por perfil.
4. **Painel** com as contagens e valores dos donos.
5. **Mídias**: links do Google Drive com fotos e vídeos por trabalho.
6. **Publicação**: PWA, domínio, backup, teste com dados reais.

## 9. Decisões complementares (23/11/2026)

| Tema | Decisão | Impacto |
| --- | --- | --- |
| Briefing | A gestão preenche e marca "Briefing fechado". O contratante não entra no app | Sem perfil de contratante; `clients` é só cadastro |
| Valor do promotor | **Eventos**: tabela por faixa de horas (4h = R$ 130; provisórios: 3h = R$ 97,50 e hora adicional = R$ 32,50). **Ações**: valor digitado por trabalho, porque varia muito. Donos podem ajustar qualquer valor | `pay_rules` só para eventos, editável na tela dos donos; `payments` guarda o valor final e se veio da tabela ou foi ajustado |
| Login | E-mail e senha. Telefone fica no cadastro para contato. Cadastro precisa de aprovação dos donos | Recuperação de senha por e-mail, sem custo de SMS |
| Mídias | Google Drive da empresa. O app guarda o link da pasta ou arquivo por trabalho | `media_items` guarda link, tipo e quem adicionou; nada de arquivo no Supabase. O plano grátis basta |

### Ainda a confirmar com os donos

- Valor do evento de 3h e da hora adicional. Provisório: proporcional aos R$ 130 de 4h (R$ 32,50 por hora), ajustável na tela **Valores**.
- A hora adicional vale para eventos acima de 4h (ex.: 6h = 130 + 2 × 32,50 = R$ 195). É assim que o app já calcula.
