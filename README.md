# FreelaMZ

Marketplace de freelancers focado em Moçambique. Encontre talentos. Encontre oportunidades.

**Stack:** Framework7 (Vite) · Node.js · Express · MySQL · JWT + bcrypt · Multer

**Documentação:**
- [Relatório completo do projeto](RELATORIO.md) — o que foi feito, passo a passo, problemas e soluções
- [Relatório académico (PDF A4)](docs/FreelaMZ-Relatorio.pdf) — documento formal para entrega ao docente (fonte: [docs/relatorio-academico.html](docs/relatorio-academico.html))
- [Apresentação em PDF](docs/FreelaMZ-Apresentacao.pdf) — 14 slides + roteiro de fala (fonte: [docs/apresentacao.html](docs/apresentacao.html))
- [Migração Railway → Render + TiDB](docs/migracao-render-tidb.md) — guia operacional da hospedagem gratuita actual

---

## 0. Pré-requisitos (Laragon)

- [Laragon](https://laragon.org/) instalado (MySQL + Node.js)
- Node.js e npm (verificar com `node -v` e `npm -v`)
- MySQL do Laragon iniciado (Menu > "Iniciar tudo")

Caminhos esperados:
- Projeto: `C:\laragon\www\freelamz`
- Backend API: `http://localhost:3000`
- Frontend: `http://localhost:5173`

> **Importante:** confirme a senha do root do MySQL. No Laragon padrão ela costuma estar vazia, mas nesta instalação o acesso com senha vazia foi negado. Se for o caso, defina ou informe a senha no `backend/.env` (`DB_PASSWORD`).

---

## 1. Banco de Dados (MySQL)

### Via linha de comando (Terminal do Laragon / PowerShell)

```powershell
# 1. Criar o banco
"C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS freelamz CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Executar o schema
"C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe" -u root freelamz < database\schema.sql

# 3. Executar o seed (categorias e habilidades)
"C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe" -u root freelamz < database\seed.sql

# 4. Popular usuários de teste com senhas hasheadas (bcrypt)
cd backend
npm install
node src/scripts/seed.js
```

### Via HeidiSQL

1. Abra o HeidiSQL (Menu do Laragon > HeidiSQL).
2. Conecte em `127.0.0.1`, usuário `root`, senha (conforme seu Laragon).
3. Crie o banco `freelamz` com collation `utf8mb4_unicode_ci`.
4. Execute os arquivos `database/schema.sql` e depois `database/seed.sql`.
5. Rode `node src/scripts/seed.js` na pasta `backend` para criar os usuários.

---

## 2. Configuração (.env)

Copie o exemplo:

```powershell
copy backend\.env.example backend\.env
```

Edite `backend\.env` e preencha `DB_PASSWORD` se o root do MySQL tiver senha. Os demais valores já estão prontos para desenvolvimento.

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=SUA_SENHA_AQUI
DB_NAME=freelamz
JWT_SECRET=qualquer_coisa_muito_secreta
```

### Pagamentos (FASE A)

```env
PAYMENT_PROVIDER=fake          # fake (modo de teste) | mpesa | emola
FAKE_PAYMENT_DELAY_MS=1500     # atraso simulado da cobrança externa (~2 s)
FAKE_PAYMENT_FAIL_RATE=0       # 0 a 1 — probabilidade de falha simulada (só em dev)
MPESA_API_KEY=                 # necessárias quando PAYMENT_PROVIDER=mpesa
MPESA_API_SECRET=
EMOLA_API_KEY=                 # necessárias quando PAYMENT_PROVIDER=emola
EMOLA_API_SECRET=
```

- `fake` (padrão): tudo simulado — carteira com recarga fictícia, M-Pesa/e-Mola/cartão fictícios (com PIN qualquer), banner "🧪 MODO DE TESTE" no frontend e opção "Simular falha" em desenvolvimento.
- `mpesa` / `emola`: os provedores reais já estão esqueletizados (`backend/src/services/payments/`); basta preencher as chaves. A troca não exige mudanças no resto do sistema (o provider é injetado via `getProvider()`).

---

## 3. Instalação e Execução

### Backend (Node.js + Express)

```powershell
cd C:\laragon\www\freelamz\backend
npm install
npm run dev       # roda com nodemon em http://localhost:3000
```

### Frontend (Framework7 + Vite)

```powershell
cd C:\laragon\www\freelamz\frontend
npm install
npm run dev       # roda em http://localhost:5173 (proxy para a API)
```

Abra o navegador em `http://localhost:5173`.

### Testar o arranque de produção localmente

```powershell
cd C:\laragon\www\freelamz\backend
npm ci
npm start                       # http://localhost:3000
```

Verifique `http://localhost:3000/api/health` → `{"success":true,"name":"FreelaMZ API","status":"ok","db":"up"}`.
O estado da base de dados é `http://localhost:3000/api/health/db`.

---

## 3.1. Deploy no Railway (backend)

> **Histórico — não é o deploy actual (21/11/2026).** O backend passou para a **Render** em `https://freelamz.onrender.com`, com a base num cluster **TiDB Cloud Starter** compatível com MySQL. Ver o [guia de migração](docs/migracao-render-tidb.md). As instruções abaixo ficam apenas como registo do que foi feito no Railway.

O backend era publicado como um serviço Node.js no [Railway](https://railway.com) e usava o **MySQL do próprio Railway**. O repositório é um monorepo, por isso o serviço **tem de** apontar para a subpasta `backend`.

### Configuração do serviço

| Campo | Valor |
|-------|-------|
| Root Directory | `/backend` |
| Build | RAILPACK (definido em `backend/railway.json`) |
| Start Command | `npm start` |
| Healthcheck Path | `/api/health` |

> Sem **Root Directory = /backend**, o build falha com `railpack process exited with an error`, porque não existe `package.json` na raiz do repositório.

### Variáveis de ambiente (serviço do backend)

| Variável | Obrigatória | O que é |
|----------|-------------|---------|
| `MYSQL_URL` | **Sim** (ou `DB_*`) | Uma só string com host, porta, utilizador, senha e base. No Railway: `${{MySQL.MYSQL_URL}}`. |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Alternativa | Variáveis separadas, caso não queira usar `MYSQL_URL`. |
| `JWT_SECRET` | **Sim** | Texto aleatório longo que assina os tokens de login. |
| `NODE_ENV` | **Sim** (recomendado) | `production`. Liga a validação e desliga logs verbosos. |
| `CORS_ORIGINS` | Sim para o site | Origens web separadas por vírgula. As do APK (`capacitor://localhost`, `http://localhost`, `https://localhost`) já são aceites automaticamente. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Só para `npm run db:init` | Não são usadas pelo servidor em execução; servem para criar/atualizar o administrador. |
| `UPLOADS_DIR` / `UPLOADS_PRIVATE_DIR` | Opcional | Só com Volume: `/app/uploads` e `/app/uploads_private`. |
| `DB_SSL` | Só com URL pública | `true` quando liga ao MySQL pela URL pública (por exemplo, a partir do PC). |
| `PORT` | Automática | O Railway define-a; não precisa de a criar. |

A ligação ao MySQL pode ser feita de duas formas:

1. **Uma só string (recomendada):** `MYSQL_URL=${{MySQL.MYSQL_URL}}` — cobre host, porta, utilizador, senha e base.
2. **Separadas:** `DB_HOST=${{MySQL.MYSQLHOST}}`, `DB_PORT=${{MySQL.MYSQLPORT}}`, `DB_USER=${{MySQL.MYSQLUSER}}`,
   `DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}`, `DB_NAME=${{MySQL.MYSQLDATABASE}}`.

Se nenhuma for definida, o código também lê `MYSQLHOST`/`MYSQLPORT`/`MYSQLUSER`/`MYSQLPASSWORD`/`MYSQLDATABASE` diretamente (variáveis nativas do Railway).

Gerar um `JWT_SECRET` (Node.js):

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Diagnóstico (health checks)

| Endpoint | Comportamento |
|----------|---------------|
| `GET /api/health` | Responde **sempre 200** com `{"success":true,...,"db":"up"\|"down"}` — o Railway não mata o serviço por causa da BD. |
| `GET /api/health/db` | Testa a BD agora: `200` com `db:"up"`, ou `503` com `db:"down"`, o código do erro (`ECONNREFUSED`, `ER_ACCESS_DENIED_ERROR`, `ENOTFOUND`…) e a configuração usada (sem password). |

No arranque, o servidor:

1. valida as variáveis obrigatórias e, se faltar alguma, **lista os nomes em falta** nos logs e termina;
2. sobe primeiro o HTTP e só depois liga à BD, com **5 tentativas** (1s, 2s, 4s, 8s);
3. se a BD continuar indisponível, **continua online** e mostra `db:"down"` — corrige as variáveis e faz Redeploy.

### Criar as tabelas e o administrador

Depois do primeiro deploy, corra o script idempotente **do seu PC**, apontando para o MySQL público do Railway
(Railway > serviço MySQL > **Connect** > *Public Networking*). Copie a **Public URL** para a variável local
`MYSQL_URL` (a URL inclui a senha; não a cole em chats/commits):

```powershell
cd C:\laragon\www\freelamz\backend
$env:MYSQL_URL="mysql://root:SENHA@HOST-PUBLICO:PORTA/railway"
$env:DB_SSL="true"
$env:ADMIN_EMAIL="seu@email.com"
$env:ADMIN_PASSWORD="uma-senha-forte"
npm run db:init
```

Alternativa com variáveis separadas: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (e `DB_SSL=true`).

O `db:init` executa `database/schema.sql`, `database/seed.sql` (categorias + habilidades), as migrações
e cria/atualiza apenas o utilizador **ADMIN**. Não cria contas de teste.

### Dados de demonstração (opcional)

#### Forma mais simples: no próprio Railway (sem copiar URL nem senha)

1. Railway → serviço **backend** → **Variables** → **New Variable**:
   - Nome: `SEED_DEMO`
   - Valor: `true`
2. O Railway faz **Redeploy** automático. Nos logs aparece:
   `[DEMO] Contas criadas agora: 10 | já existiam: 0`
3. Depois de confirmar os dados na app, podes **remover** a variável `SEED_DEMO`
   (ou pôr `false`) — o seed é idempotente, mas assim fica desligado.

O servidor usa a `MYSQL_URL` interna do Railway; não é preciso ativar o
Public Networking do MySQL.

#### Alternativa: a partir do PC (requer Public Networking)

```powershell
cd C:\laragon\www\freelamz\backend
$env:MYSQL_URL="mysql://root:SENHA@HOST-PUBLICO:PORTA/railway"
$env:DB_SSL="true"
npm run db:demo
```

> ⚠️ Confirma que `$env:MYSQL_URL` está mesmo definido antes de correr:
> `[uri]$env:MYSQL_URL` tem de mostrar `host=` e `porta=` preenchidos.
> Se estiverem vazios, o script liga-se ao MySQL **local** (`127.0.0.1`).

Cria **8 freelancers + 2 clientes** (e-mails `@demo.freelamz.mz`) com perfil, habilidades e serviços.
É idempotente (repetir não duplica). A senha de todas as contas demo é `Demo1234`; para outra:

```powershell
$env:DEMO_PASSWORD="OutraSenhaForte"; npm run db:demo
```

Para remover os dados de demonstração (só apaga os e-mails `@demo.freelamz.mz`):

```powershell
npm run db:demo:limpar
```

### Ficheiros enviados (uploads)

O disco do Railway é **efémero**: tudo o que for escrito em `uploads/` desaparece no próximo deploy.

- **Opção A (simples):** criar um **Volume** no serviço e montá-lo em `/app/uploads`; definir
  `UPLOADS_DIR=/app/uploads` e `UPLOADS_PRIVATE_DIR=/app/uploads_private`.
- **Opção B (escala):** usar um serviço externo de imagens (ex.: Cloudinary) e guardar apenas as URLs na base de dados.

Sem uma destas opções, as imagens funcionam, mas perdem-se a cada deploy.

---

## 4. Credenciais de Teste

### Produção (Railway)

| Usuário | Email | Senha | Tipo |
|---------|-------|-------|------|
| Administrador | o e-mail definido em `ADMIN_EMAIL` | a senha definida em `ADMIN_PASSWORD` (no `db:init`) | ADMIN |
| Freelancers demo (8) | `isabel@demo.freelamz.mz`, `carlos@…`, `beatriz@…`, `helder@…`, `rosa@…`, `amos@…`, `luis@…`, `marta@…` | `Demo1234` | FREELANCER |
| Clientes demo (2) | `cliente@demo.freelamz.mz`, `empresa@demo.freelamz.mz` | `Demo1234` | CLIENTE |

> As contas demo só existem depois de correr `npm run db:demo`. **Mude a senha** (`DEMO_PASSWORD`) antes de
> divulgar a app a utilizadores reais, ou remova-as com `npm run db:demo:limpar`.

### Local (seed de desenvolvimento)

Criadas pelo seed (`backend/src/scripts/seed.js`):

| Usuário | Email | Senha | Tipo |
|---------|-------|-------|------|
| Administrador | `admin@freelamz.com` | `Admin@12345` | ADMIN |
| Cliente | `cliente@freelamz.com` | `Cliente@123` | CLIENTE (15.000 MT fictícios na carteira) |
| Freelancer | `freela@freelamz.com` | `Freela@123` | FREELANCER |

> Todos os pagamentos são fictícios enquanto `PAYMENT_PROVIDER=fake` — a carteira pode ser recarregada na própria UI (`/wallet`).

---

## 5. Estrutura do Projeto

```
C:\laragon\www\freelamz
├── frontend/              # Framework7 + Vite
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── src/
│   │   ├── app.js         # Inicialização do Framework7 + guard de rotas + banner de modo de teste
│   │   ├── routes.js      # Rotas do router (26 rotas)
│   │   ├── css/app.css    # Tema vibrante (variáveis CSS, gradientes)
│   │   ├── js/            # api.js, auth.js, layout.js, utils.js
│   │   ├── pages/         # 25 telas (dashboard, carteira, chat, etc.)
│   │   │   ├── dashboard.js     # Dashboard com métricas + Chart.js + tira da carteira
│   │   │   ├── wallet.js        # Carteira: saldo, recarga fictícia, saque, extrato (FASE A)
│   │   │   ├── message-conversa.js # Chat com barra de estado do projeto e ações FASE A
│   │   │   └── ...
│   │   └── components/
│   └── favicon.svg
├── backend/               # Node.js + Express
│   ├── src/server.js      # Entrada (PORT, 0.0.0.0, trust proxy, /api/health)
│   ├── scripts/init-db.js # Schema + seed mínimo + admin (npm run db:init)
│   ├── railway.json       # Build RAILPACK, start, healthcheck
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   ├── src/
│   │   ├── config/db.js   # Pool MySQL (mysql2)
│   │   ├── config/dbConfig.js # DB_* / MYSQL_* / MYSQL_URL + SSL
│   │   ├── config/paths.js    # UPLOADS_DIR / UPLOADS_PRIVATE_DIR
│   │   ├── controllers/   # auth, user, service, project, payment, delivery, admin, etc.
│   │   ├── routes/        # Rotas da API REST
│   │   ├── middleware/    # auth, validação, upload (multer + magic bytes)
│   │   ├── models/        # Models de acesso a dados
│   │   ├── services/      # finance.js (escrow, livro-razão, ajustes, disputas)
│   │   │   └── payments/  # PaymentProvider: Fake, M-Pesa, e-Mola (injetável via .env)
│   │   └── scripts/       # migrate.js (idempotente), seed.js (bcrypt)
│   ├── uploads/           # Avatares e imagens (público)
│   └── uploads_private/    # Ficheiros de entrega (download só por endpoint autorizado)
├── database/
│   ├── schema.sql         # 13 tabelas, FKs, índices
│   └── seed.sql           # 12 categorias + 15 habilidades
├── README.md
└── .gitignore
```

---

## Funcionalidades Implementadas

- **Autenticação:** cadastro, login, logout, JWT, rotas protegidas
- **Usuários e Perfis:** cliente, freelancer, admin; perfil profissional completo
- **Categorias:** 12 categorias com ícone e cor própria
- **Serviços:** criar, listar, detalhe, editar, favoritar
- **Propostas:** enviar, listar, aceitar/recusar (projeto nasce aguardando pagamento)
- **Projetos:** criar, listar, linha do tempo (pagamento → entregas → aprovações → liberação), avaliar
- **Chat:** mensagens entre cliente e freelancer (polling, pronto para Socket.IO) com barra de estado do projeto e ações financeiras contextuais (pagar, entregar, aprovar, revisão, disputa, ajuste, cancelamento de comum acordo)
- **Pagamentos com escrow (FASE A):** carteira, pagamento M-Pesa/e-Mola/cartão/saldo (fictícios), retenção, entrega com ficheiros validados por magic bytes, aprovação dos dois lados, liberação, disputas decididas pelo admin, saques
- **Avaliações:** nota 1–5 + comentário após projeto concluído
- **Favoritos:** freelancers e serviços, página "Meus Favoritos"
- **Notificações:** contador de não lidas, marcar como lida
- **Dashboard:** métricas coloridas + gráficos Chart.js (projetos por status) + tira da carteira
- **Painel Admin:** estatísticas, gráficos, bloquear/desbloquear usuários, listar serviços/projetos + aba Financeiro (comissões, escrow, disputas com decisão inline, saques, comissão configurável)
- **Design:** tema vibrante (azul elétrico, verde vivo, coral), gradientes, cards com sombra, avatars com iniciais, badges, empty states, toasts, skeleton loaders


---

## 6. APIs Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/register` | Cadastro |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Usuário logado (protegido) |
| GET | `/api/categories` | Categorias |
| GET | `/api/services` | Listar serviços |
| GET | `/api/services/:id` | Detalhe do serviço |
| POST | `/api/services` | Criar serviço (freelancer) |
| GET | `/api/users/freelancers` | Listar freelancers |
| POST | `/api/proposals` | Enviar proposta |
| GET | `/api/projects` | Meus projetos |
| POST | `/api/messages` | Enviar mensagem |
| GET | `/api/messages/conversation` | Conversa |
| GET | `/api/notifications` | Notificações |
| POST | `/api/favorites` | Favoritar |
| GET | `/api/users/dashboard` | Dashboard do usuário logado |
| GET | `/api/admin/stats` | Estatísticas (admin) |
| PUT | `/api/admin/users/:id/block` | Bloquear usuário (admin) |
| PUT | `/api/admin/users/:id/unblock` | Desbloquear usuário (admin) |
| POST | `/api/projects` | Criar projeto (cliente) |
| PUT | `/api/projects/:id/status` | Atualizar status do projeto |
| POST | `/api/proposals/:id/status` | Aceitar/recusar proposta |
| POST | `/api/reviews` | Avaliar projeto concluído |
| GET | `/api/payments/config` | Modo de teste, comissão e métodos (FASE A) |
| POST | `/api/payments/pay` | Pagar projeto (SALDO/MPESA/EMOLA/CARTAO) → escrow |
| GET | `/api/payments/wallet` | Carteira (saldo, pendente, extrato) |
| POST | `/api/payments/wallet/recharge` | Recarga fictícia (modo de teste) |
| POST | `/api/payments/wallet/withdraw` | Pedir saque (M-Pesa/e-Mola/banco) |
| POST | `/api/projects/:id/deliveries` | Entrega: mensagem + ≤5 ficheiros + links |
| POST | `/api/projects/:id/deliveries/:id/approve` | Cliente aprova a entrega |
| POST | `/api/projects/:id/confirm` | Freelancer confirma conclusão → liberação |
| POST | `/api/projects/:id/dispute` | Abrir disputa (decisão do admin) |
| POST | `/api/projects/:id/adjustments` | Propor ajuste de valor (após pago) |
| GET | `/api/admin/finance` | Painel financeiro (comissões, escrow, disputas) |
| PUT | `/api/admin/disputes/:projectId/resolve` | Decidir disputa (admin) |
| PUT | `/api/admin/withdrawals/:id` | Aprovar/recusar saque (admin) |

---

## 7. Segurança

- Senhas hasheadas com **bcrypt** (nunca em texto puro).
- Autenticação via **JWT** armazenado em `localStorage` (note: vulnerável a XSS; em produção usar cookie HttpOnly + refresh token).
- Rotas protegidas por middleware de autenticação.
- Validação com **express-validator**.
- Queries parametrizadas (**mysql2**) contra SQL Injection.
- CORS configurado para o frontend.
- Uploads de imagem limitados por tipo/tamanho (multer).
- **Ficheiros de entrega** (FASE A): guardados fora da pasta pública (`uploads_private/deliveries`), validados por **magic bytes reais** (não por extensão), máx. 5 × 20 MB; download apenas para participantes do projeto e admin, via endpoint com JWT.

---

## 8. Pagamentos com Escrow (FASE A)

Fluxo completo de pagamentos fictícios com retenção em segurança (escrow), entrega pelo chat e aprovação dos dois lados:

1. **Proposta aceita** → projeto entra em `AGUARDANDO_PAGAMENTO` (linha de escrow criada com valor 0).
2. **Cliente paga** no chat do projeto (`?projeto=`): M-Pesa, e-Mola, cartão (nº + PIN fictício, ~2 s simulados) ou **Saldo** da carteira. O valor é debitado e **RETIDO em escrow** → projeto `EM_ANDAMENTO`. Comissão da plataforma (padrão **10%**, configurável no admin em 0–30%).
3. **Freelancer entrega** pelo chat: mensagem + até **5 ficheiros de 20 MB** (validação real por magic bytes: PDF, ZIP, DOCX, XLSX, MP4, JPG, PNG, WEBP) + links. Os ficheiros ficam em `uploads_private/deliveries` (fora da pasta pública); o download passa sempre pelo endpoint autorizado.
4. **Cliente responde**: aprovar · pedir **revisão** (máx. 3) · abrir **disputa**. O valor fica travado — ajustes só por proposta de ajuste aceite pelos dois (aumento sai do saldo do cliente, diminuição volta para ele).
5. **Liberação só com os dois aprovados** (cliente aprova + freelancer confirma conclusão), numa única transação SQL com locks. Até lá, cancelamento antes da primeira entrega exige **acordo dos dois** (reembolso).
6. **Disputa** decide o admin: liberar ao freelancer · reembolsar o cliente · dividir por percentagem (comissão só sobre a parte do freelancer). Tudo com auditoria no livro-razão (`transactions`, append-only, valores em centavos BIGINT).
7. **Carteira** (`/wallet`): saldo, valor retido/a receber, recarga fictícia (modo de teste), saque M-Pesa/e-Mola/banco (PENDENTE → admin conclui/recusa, recusa devolve o valor) e extrato filtrado por tipo.
8. **Painel admin → aba Financeiro**: comissões, escrow retido, disputas, saques pendentes, liberado/reembolsado, gráfico de comissões e volume por mês (Chart.js) e comissão editável.
9. Lembretes automáticos: cliente silente 7 dias após a entrega → apenas notificação (nunca libera sozinho).

### Trocar de provedor

`PAYMENT_PROVIDER=fake|mpesa|emola` no `backend/.env` + chaves do provedor. Os provedores implementam a interface `PaymentProvider` (`charge`, `isTestMode`, etc.) em `backend/src/services/payments/` — o resto do sistema não muda.

### Testes

```powershell
# Backend (requer MySQL do Laragon ativo; rodar dentro de backend/)
npm run smoke             # 130 checks — fluxo geral da API
npm run smoke:payments    # 65 checks — pagamentos, escrow, disputas, saques

# Frontend (requer backend :3000 + `npm run dev` :5173)
npm run e2e               # 60 checks — UI completa incl. fluxo FASE A pela interface
npm run smoke:build       # 9 checks — bundle de produção (npm run build + preview)
```

---

## 9. Problemas Comuns (Windows / Laragon)

- **MySQL não conectado:** inicie o Laragon > "Iniciar tudo".
- **Access denied (1045):** o root do MySQL tem senha. Edite `backend/.env` com `DB_PASSWORD`.
- **Porta 3000 ou 5173 ocupada:** encerre o processo que usa a porta ou altere `PORT` / `vite.config.js`.
- **mysql CLI não no PATH:** use o caminho completo `C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe`.
- **CORS:** certifique-se de que `FRONTEND_URL=http://localhost:5173` no `.env`.

---

## 10. Licença

Projeto desenvolvido para demonstração acadêmica / portfólio — FreelaMZ.
