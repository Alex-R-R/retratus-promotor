---
name: retratus-ui
description: Identidade visual e padrões de interface do app Retratus (vagas de eventos/ações para promotores). Use antes de criar ou alterar qualquer tela, componente, dashboard ou calendário do projeto. Complementa a skill frontend-design.
---

# Retratus · interface

Leia também `.claude/skills/frontend-design/SKILL.md`. Esta skill fixa o que já foi decidido para a Retratus.

## Assunto e público

- Retratus opera equipamentos de foto/experiência em eventos (Totem, Self print, Totem slim, Plataforma 360, Túnel de LED, Máquina de garra) em Belém e região (fuso `America/Belem`).
- Dois públicos: **gestão** (donos e gestores, desktop, montam vagas, escolhem pessoas, olham valores) e **promotores** (celular, na rua, querem ver vagas, se candidatar e saber onde/quando trabalham).
- Linguagem: português do Brasil, direto, operacional. "Evento" = um dia; "Ação" = vários dias.

## Paleta (manter a que o Codex definiu)

| Token | Valor | Uso |
| --- | --- | --- |
| `--brand-ink` | `#151713` | botões primários, texto forte |
| preto profundo | `#080b09` | fundos escuros, `theme-color` |
| `--brand-gold` | `#dfb653` | destaque, marca |
| dourado claro | `#e8c770` | detalhes sobre fundo escuro |
| foco | `#c6983c` | outline de foco |
| `--amber` | `#a47420` | avisos |
| papel | `#f8f7f3` | fundo da página |
| `--border` | `#e7e2d8` | bordas |
| `--muted` | `#655f53` | texto secundário |

Logos: `src/assets/retratus-light.png` e `retratus-dark.png`.

## Evitar "cara de IA"

- Nada de gradiente roxo/azul, cards todos iguais com ícone + número grande + rótulo, emojis decorativos, sombras difusas genéricas, cantos arredondados exagerados.
- Dourado é acento, não preenchimento: linhas, marcadores, estado selecionado.
- Hierarquia por tipografia e alinhamento, não por caixas. Tabelas e listas densas para a gestão; cartões apenas no celular do promotor.
- Calendário com cara de **quadro de escala** (linhas por pessoa/equipamento, blocos de horário), não de app de agenda genérico.
- Dashboard de valores: poucos números, com contexto (período, comparação), gráficos sóbrios em tons de tinta + dourado. Siga a skill `dataviz` se disponível.
- Textos reais do domínio (nomes de equipamentos, bairros, horários), nunca "Lorem ipsum" ou "Dashboard Overview".

## Checklist por tela

1. Funciona em 375px (promotor) e 1280px (gestão)?
2. Estados vazio, carregando e erro escritos em linguagem da operação?
3. Contraste AA e foco visível com `#c6983c`?
4. Valores em R$ visíveis apenas para donos.
