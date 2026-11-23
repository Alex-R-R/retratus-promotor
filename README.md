# Retratus · demonstração funcional

Aplicação responsiva em português do Brasil, com operação em `America/Belem`, identidade em preto, dourado e branco e logotipos fornecidos pelo usuário. Os tipos de atividade são **Evento** e **Ação**. Todos os integrantes, telefones, eventos, registros e valores são fictícios. Não inserir dados reais.

## Executar

Requisito: Node.js 22 ou superior. Sem pacotes externos ou instalação de dependências.

```sh
npm run dev
```

Abra **http://localhost:4173**. O servidor atende somente a máquina local. `npm run build` gera `dist/` para hospedagem estática futura; nenhum deploy ou serviço externo foi provisionado.

```sh
npm test
npm run lint
npm run build
```

`lint` executa verificação sintática de todos os arquivos JavaScript com `node --check`. Não existe compilação TypeScript nem análise estática de tipos neste projeto.

## Contas e roteiro de teste

A primeira abertura usa a conta de dona fictícia. Clique no perfil para trocar entre donos, dois gestores, mídia e promotores. Todas as senhas iniciais são `demo123`. Em “Testar acesso por telefone e senha”, use:

| Perfil fictício | Telefone |
| --- | --- |
| Dona / dono | `00000000001` / `00000000002` |
| Gestores | `00000000003` / `00000000004` |
| Mídia | `00000000005` |
| Promotor 01 a 16 | `00000000101` a `00000000116` |
| Funcionário / prestador | `00000000201` / `00000000202` |
| Cadastro aguardando aprovação | `00000000301` |

1. Na agenda de 18/11, consulte as 18 pessoas operacionais: 16 freelancers, um funcionário e um prestador. Filtre também por horário. “Sem escala registrada” exige consulta à pessoa e nunca é disponibilidade confirmada.
2. Em Eventos e ações, crie um trabalho futuro, revise o rascunho e publique. Para ações, adicione dias ou repita o último horário até uma data; edite horários individuais se necessário.
3. Troque para um promotor, abra a oportunidade e marque um ou vários serviços. A candidatura é por trabalho e encerra 24h antes do primeiro início.
4. Como gestão, selecione a candidatura ou use “Convocar pessoa”. Escolha serviço e dias da participação. Não há recomendações ou classificação automática.
5. Como participante, confirme em Meus compromissos. O Promotor 02 tem duas convocações sobrepostas; confirmar uma impede confirmar a outra.
6. Pelo relógio demonstrativo, avance até a data de execução. Envie uma imagem fictícia de início e depois uma de encerramento. Apenas a pessoa/dia correspondente encerra. Use JPG, PNG ou WebP até 1 MB. O envio inclui validação de imagem e estado de carregamento.
7. Como gestão, confira os horários e registre uma observação. Os envios originais permanecem separados dos horários validados. Como dono, informe um valor ou deixe vazio.
8. Avance 2h para expirar as convocações iniciais ou 31 dias para observar a exclusão demonstrativa das fotos encerradas. Os candidatos e históricos permanecem.
9. Use “Substituir / remover dias” e convoque o substituto manualmente. A ação de Natal já contém substituição em 19/11. Dias com execução não podem ser removidos.
10. Alterações de programação futura preservam dias iniciados e históricos. Participações futuras ativas são retiradas e recebem aviso de alteração; a gestão deve convocar novamente e os participantes reconfirmar. Observações simples não retiram confirmações.

O evento “Celebração sob as estrelas” vai de 20/11 às 22h até 21/11 às 2h. O Promotor 06 já está confirmado para testar as fotos na madrugada. A ação “Natal em movimento” vai de 15/11 a 24/12, das 16h às 20h por dia: manhãs não são bloqueadas.

“Restaurar demonstração” recria a base inicial, descartando somente as alterações locais de teste. O relógio inicial é 18/11/2026 às 10h de Belém e só avança manualmente.

## Estrutura

- `src/domain.js`: regras, permissões funcionais, prazos, capacidade, conflitos, registros e indicadores. `POLICY` centraliza fuso, semana iniciando segunda-feira, mês civil e prazos.
- `src/seed.js`: base fictícia reproduzível e imagem ilustrativa dos registros iniciais.
- `src/repository.js`: adaptador demonstrativo em `localStorage`, gravação por cópia e tratamento de quota. Ponto a substituir por chamadas à API futura.
- `src/app.js` e `src/styles.css`: telas por perfil, formulários, agenda responsiva e estados de erro/vazio/carregamento.
- `scripts/`: servidor estático local, verificação sintática e build.
- `tests/`: testes automatizados das regras e persistência local.

## Limites reais da demonstração

**Não há backend de negócio ou autenticação segura.** As senhas são fictícias e ficam em texto na base de teste. As funções validam perfis para demonstrar o comportamento, mas isso não constitui controle de segurança: o navegador contém a base completa, incluindo valores e fotos. A interface não expõe valores a gestores, mídia ou promotores, mas uma pessoa com acesso às ferramentas do navegador consegue inspecionar todos os dados.

Dados são locais à origem e ao navegador, sujeitos a limpeza e quota. Não usar para operação compartilhada. Abas recebem aviso de alterações, mas não há transações concorrentes entre dispositivos ou garantia contra gravações simultâneas.

As fotos ficam em base64 no armazenamento do navegador, cuja quota é pequena e varia. O limite de 1 MB por foto não significa que várias fotos desse tamanho caberão. Falhas de quota não confirmam a operação nem encerram o trabalho. Uma imagem inválida não é aceita como foto.

A expiração e a exclusão de conteúdo após 30 dias são reaplicadas ao carregar ou alterar a base e ao avançar o relógio. Não existe agendador real. A exclusão preserva metadados, envios, horários validados e histórico; arquivos baixados anteriormente não são apagados.

Indicadores de horas incluem somente registros conferidos; os encerramentos pendentes aparecem separadamente. Cancelamentos não contam como realização. Funcionários e prestadores não entram na comparação dos freelancers. Valores vazios são diferentes de zero; não há pagamentos ou custo total do evento.

## Evolução para testes compartilhados e produção

Avaliação documental em **18/11/2026**; limites podem mudar. Nenhum serviço foi contratado ou configurado.

| Componente | Opção avaliada e limites oficiais | Consequência para a Retratus |
| --- | --- | --- |
| Hospedagem estática | Cloudflare Workers Static Assets: requisições de arquivos estáticos gratuitas; API no Workers Free limitada a 100 mil requisições/dia e 10 ms de CPU por execução. [Documentação](https://developers.cloudflare.com/workers/platform/pricing/) | O frontend pode ser hospedado sem mensalidade dentro das condições do plano. Isso não fornece autenticação ou banco automaticamente. |
| Banco, autenticação e fotos | Supabase Free: 500 MB de banco, 1 GB de arquivos, 50 mil usuários ativos/mês, 5 GB de saída e 5 GB de saída em cache; até dois projetos ativos e pausa após uma semana de inatividade. [Preços](https://supabase.com/pricing) | Candidato para piloto compartilhado, sem garantia de continuidade irrestrita. Fotos e downloads provavelmente serão o limite mais relevante. |
| Telefone e senha | Supabase documenta autenticação por telefone e senha. [Documentação](https://supabase.com/docs/guides/auth/passwords) | A integração futura deve configurar cadastro aprovado pela gestão e recuperação administrativa sem disparo de SMS. Não foi implementada ou validada contra conta externa nesta demo. |
| Expiração e retenção | Supabase Cron executa tarefas no Postgres e registra execuções. [Documentação](https://supabase.com/docs/guides/cron) | Implementar jobs idempotentes e monitorados; expiração também deve ser revalidada em toda transação. Pausas do projeto afetam a confiabilidade operacional. |
| Alternativa de banco | Cloudflare D1 Free: 5 milhões de linhas lidas/dia, 100 mil escritas/dia e 5 GB totais. [Documentação](https://developers.cloudflare.com/d1/platform/pricing/) | Exigiria API e solução de autenticação adicionais; não é necessário introduzir essa complexidade na demo. |
| Alternativa para fotos | R2 Standard: franquia de 10 GB-mês, 1 milhão de operações A e 10 milhões B por mês; excedentes são tarifados. [Documentação](https://developers.cloudflare.com/r2/pricing/) | Franquia não equivale a serviço sem risco de cobrança; não ativar faturamento ou excedentes sem decisão explícita. |

Proposta para um próximo piloto: frontend estático e Supabase Free, após validar as configurações de telefone/senha e os limites da conta. É uma avaliação, não uma integração pronta. Como estimativa própria, 16 pessoas × 30 dias × 2 fotos × 1 MB resulta em aproximadamente 960 MB de imagens antes de margem operacional; portanto, compressão, quota global e monitoramento são necessários para um teto de 1 GB. Não há promessa de gratuidade ilimitada.

Antes de usar dados reais, implementar:

- API com sessão segura e autorização em cada operação e consulta, inclusive valores exclusivos dos donos; aprovação somente pelos donos.
- Banco compartilhado com transações e proteção concorrente de vagas e conflitos; relógio confiável do servidor.
- Armazenamento privado com autorização de arquivos por participante, gestão e mídia; downloads temporários; validação real de conteúdo, limite por arquivo e quota total.
- Jobs monitorados de expiração e exclusão, retries idempotentes, auditoria e backups. Retenção calculada pelo encerramento, não apenas pela data de upload.
- Recuperação administrativa com verificação de identidade e auditoria; sem SMS, pagamentos ou integrações bancárias.
- Testes de segurança no servidor e de carga/concorrência. Os testes locais não comprovam segurança de produção.

Contas externas e credenciais ficam para a próxima etapa; a demonstração não depende delas. Os logotipos fornecidos estão em `src/assets/`; não são dados pessoais fictícios da base.
