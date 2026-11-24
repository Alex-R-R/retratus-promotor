# Publicação do app Retratus

Passo a passo para colocar o app no ar. Fica tudo em planos grátis: Supabase (banco e login), Cloudflare Pages (site) e GitHub (código, verificação e backup).

Siga na ordem. Os passos marcados **(donos)** precisam de login nas contas da Retratus.

## 0. Juntar as fases na `main`

O site publica o ramo `main`. Cada fase está num ramo que saiu da anterior (`fase-2` → … → `fase-6`).

1. Juntar o PR da `fase-2` na `main`.
2. Abrir e juntar, em ordem, os PRs das fases 3, 4, 5 e 6, cada um contra a `main`.

A cada envio, a verificação no GitHub (aba **Actions**) roda o build do app e todos os testes do banco. Só junte um PR com a verificação verde.

## 1. Projeto no Supabase **(donos)**

1. Em [supabase.com](https://supabase.com), clique em **New project**.
   - Nome: `retratus`.
   - Região: **South America (São Paulo)**, a mais perto de Belém.
   - Crie uma senha forte para o banco e guarde num gerenciador de senhas. Ela é usada no passo 2 e no backup.
2. Em **Project Settings > General**, copie o **Reference ID**.
3. No computador, na pasta do projeto, rode os comandos abaixo:

```powershell
npx supabase login
```

```powershell
npx supabase link --project-ref COLE_O_REFERENCE_ID
```

```powershell
npx supabase db push
```

O `db push` aplica as migrations, ou seja, as tabelas e regras. Ele **não** roda `supabase/seed.sql`, então as contas de teste (`@retratus.test`) não vão para a produção.

## 2. Login e e-mails **(donos)**

Em **Authentication**, no painel do Supabase:

| Onde | O que preencher |
| --- | --- |
| URL Configuration > Site URL | endereço do app, por exemplo `https://escalas.retratus.com.br` |
| URL Configuration > Redirect URLs | `https://escalas.retratus.com.br/aguardando` e `https://escalas.retratus.com.br/nova-senha` |
| Sign In / Providers > Email | **Confirm email** ligado; senha mínima de **8** caracteres |
| Email Templates > Confirm signup | assunto "Confirme seu e-mail · Retratus"; corpo: conteúdo de `supabase/templates/confirmacao.html` |
| Email Templates > Reset password | assunto "Crie uma senha nova · Retratus"; corpo: `supabase/templates/recuperacao.html` |
| Email Templates > Change email address | assunto "Confirme o novo e-mail · Retratus"; corpo: `supabase/templates/troca-email.html` |

**Envio de e-mail.** O envio de e-mail do próprio Supabase serve só para testes: manda poucas mensagens por hora. Para a equipe toda se cadastrar e recuperar senha, ligue um SMTP em **Project Settings > Authentication > SMTP Settings**. O Brevo e o Resend têm plano grátis que basta. Configure:

- remetente com o domínio da Retratus, como `escalas@retratus.com.br`;
- nome do remetente "Retratus".

## 3. Site no Cloudflare Pages **(donos)**

1. Em [dash.cloudflare.com](https://dash.cloudflare.com), vá em **Workers & Pages > Create > Pages > Connect to Git** e escolha o repositório `retratus-promotor`.
2. Preencha a configuração:
   - Production branch: `main`.
   - Root directory: `web`.
   - Build command: `npm run build`.
   - Build output directory: `dist`.
3. Em **Environment variables (Production)**, cadastre:
   - `NODE_VERSION` = `22`;
   - `VITE_SUPABASE_URL` = Project URL do Supabase (**Project Settings > API**);
   - `VITE_SUPABASE_ANON_KEY` = chave **anon public**, da mesma tela. Esta chave pode ficar no site; quem protege os dados são as regras do banco. Nunca use a `service_role`.
4. Clique em **Save and Deploy**. O site sai num endereço `*.pages.dev`.

Daí em diante, cada envio para a `main` publica sozinho.

Os cabeçalhos de segurança e de cache estão em `web/public/_headers`.

Se um dia preferirem a Vercel, `web/vercel.json` já tem a mesma configuração. Use **Root Directory** `web` e as mesmas variáveis.

## 4. Domínio **(donos)**

1. No projeto do Cloudflare Pages, abra **Custom domains > Set up a domain** e informe, por exemplo, `escalas.retratus.com.br`.
2. Se o domínio já estiver no Cloudflare, o registro é criado sozinho. Se não estiver, crie no provedor do domínio (Registro.br ou outro) um registro **CNAME**:
   - nome: `escalas`;
   - destino: o endereço `*.pages.dev`.
3. O certificado HTTPS sai em alguns minutos.
4. Volte ao passo 2 e confira se a Site URL e as Redirect URLs usam o domínio final.

## 5. Primeiro dono **(donos)**

1. Abra o app no domínio e faça o cadastro normal com o e-mail de um dos donos. Depois confirme o e-mail.
2. No Supabase, em **SQL Editor**, rode trocando o e-mail:

```sql
update public.profiles set role = 'owner', approved = true
where email = 'email.do.dono@exemplo.com';
```

3. Entre de novo no app. A partir daí, os outros cadastros são aprovados pela tela **Equipe**. Lá também se define quem é dono, gestão, social media ou promotor.
4. Na tela **Valores**, preencha a tabela de eventos: 4h = R$ 130, mais o valor de 3h e o da hora adicional quando estiverem definidos.

## 6. Backup diário **(donos)**

O GitHub faz uma cópia do banco todo dia às 3h (horário de Belém). A cópia sai criptografada e fica guardada por 30 dias. O arquivo de configuração é `.github/workflows/backup.yml`.

1. No GitHub, abra **Settings > Secrets and variables > Actions > New repository secret** e cadastre:
   - `SUPABASE_DB_URL`: no Supabase, botão **Connect**, depois **Session pooler**. Copie a URI e troque `[YOUR-PASSWORD]` pela senha do banco do passo 1.
   - `BACKUP_PASSPHRASE`: uma senha longa, só para os backups. Guarde-a fora do GitHub; sem ela, nenhum backup abre.
2. Em **Actions > Backup do banco > Run workflow**, rode uma vez para conferir. O arquivo aparece em **Artifacts**, no fim da execução.

O backup diário também mantém o projeto ativo. No plano grátis, o Supabase pausa projetos sem uso por 7 dias.

### Restaurar

Este é o caminho para recuperar dados apagados por engano ou migrar para outro projeto. Faça com calma, de preferência num projeto Supabase novo.

1. Baixe o artefato do dia em **Actions**.
2. Descriptografe e descompacte (o Git for Windows já traz o `gpg`):

```powershell
gpg -d retratus-AAAA-MM-DD.tar.gz.gpg > backup.tar.gz
```

```powershell
tar -xzf backup.tar.gz
```

3. Aplique os três arquivos, nesta ordem, com a URL do projeto de destino. Precisa do `psql`, que vem com o instalador do PostgreSQL (opção "Command Line Tools"):

```powershell
psql "URL_DO_DESTINO" -f roles.sql -f schema.sql -c "SET session_replication_role = replica" -f data.sql
```

## 7. Teste com dados reais

Antes de chamar a equipe toda, faça um ensaio com duas ou três pessoas de verdade:

- [ ] Um promotor se cadastra pelo celular, confirma o e-mail e aparece em **Equipe** para aprovação.
- [ ] O promotor instala o app na tela inicial:
  - Android (Chrome): menu ⋮, depois **Instalar app**;
  - iPhone (Safari): **Compartilhar**, depois **Adicionar à Tela de Início**.
- [ ] A gestão cria e publica um evento real. O promotor recebe o aviso e se candidata.
- [ ] A gestão escala o promotor. O trabalho aparece na **Agenda** dele com local e horário certos (fuso de Belém).
- [ ] "Esqueci a senha" chega por e-mail e o link abre a tela de nova senha no domínio certo.
- [ ] A social media cola o link da pasta do Drive. Os donos recebem o aviso.
- [ ] Os donos conferem o valor em **Valores** e marcam como pago.
- [ ] O backup manual do passo 6 roda sem erro.

Se algo falhar, anote a tela, o perfil e o horário, e mande para a equipe do app.
