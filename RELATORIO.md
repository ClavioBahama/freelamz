# Relatório do Projeto FreelaMZ

**Data:** 12 de novembro de 2026
**Autor do projeto:** Clávio Alfredo Chitsulete
**Repositório:** `ClavioBahama/freelamz` (privado) — branch `main`
**Estado:** backend online, base de dados com dados reais + demonstração, APK Android gerado automaticamente

---

## 1. Resumo executivo

O FreelaMZ é um marketplace que liga clientes a freelancers em Moçambique. Este relatório
descreve tudo o que foi feito para o colocar **no ar**: preparação do código para produção,
publicação do backend no Railway, criação e povoamento da base de dados MySQL, correção de
problemas reais encontrados no caminho, geração automática do APK Android pelo GitHub Actions
e as melhorias de interface (login no telemóvel e página “Sobre”).

No fim, ficou assim:

| Item | Estado |
|---|---|
| API pública | `https://freelamz-production-7103b885.up.railway.app` |
| Base de dados | MySQL gerido pelo Railway (online) |
| Categorias | 12 |
| Freelancers visíveis | 9 (8 de demonstração + 1 conta de diagnóstico) |
| Serviços publicados | 12 |
| APK Android | gerado no GitHub Actions (debug) |
| Página “Sobre” | no menu lateral, Configurações, login e splash |

---

## 2. O que é a aplicação

### Arquitetura

```
┌──────────────────────────┐        HTTPS/JSON        ┌──────────────────────────┐
│  App Android (APK)       │  ──────────────────────►  │  API Node.js + Express   │
│  React + Framework7      │                           │  Railway (produção)      │
│  empacotado com Capacitor│  ◄──────────────────────  │                          │
└──────────────────────────┘                           └────────────┬─────────────┘
                                                                    │ mysql2
                                                                    ▼
                                                        ┌──────────────────────────┐
                                                        │  MySQL (Railway)         │
                                                        │  base: railway           │
                                                        └──────────────────────────┘
```

### Tecnologias

| Camada | Tecnologia |
|---|---|
| Interface | React 18 + Framework7 8 + Vite |
| App nativo | Capacitor 8 (Android) |
| API | Node.js 20+ + Express 4 |
| Base de dados | MySQL 8 (`mysql2`) |
| Autenticação | JWT + bcrypt |
| Publicação backend | Railway (builder RAILPACK) |
| Build do APK | GitHub Actions + Gradle + Java 21 |
| Testes | Scripts de smoke test da API e build do frontend |

### Funcionalidades principais

- Registo/login de **Cliente**, **Freelancer** e **Admin**
- Catálogo de **categorias** e **serviços**
- **Propostas** de clientes e aceitação pelo freelancer
- **Projetos** com estados (em andamento, entregue, concluído)
- **Mensagens** entre utilizadores
- **Carteira** e **escrow** (pagamentos em modo de teste: M-Pesa/e-Mola/cartão simulados)
- **Avaliações**, **favoritos** e **notificações**
- **Painel Admin** (gestão de utilizadores, serviços e disputas)

---

## 3. Estado atual (verificado)

```
GET /api/health
{
  "success": true, "status": "ok", "db": "up",
  "revisao": "91702cf",
  "seed_demo": { "pedido": true, "em_curso": false, "feito": true, "erro": null }
}

GET /api/categories   → 12 categorias
GET /api/services     → 12 serviços
GET /api/users/freelancers → 9 freelancers
POST /api/auth/login  → 200 (isabel@demo.freelamz.mz)
```

---

## 4. Cronologia — o que foi feito, passo a passo

### Fase 0 — Base do projeto (`7c86ae0`)

Já existia o código do frontend, backend e o projeto Android (Capacitor). O objetivo era
transformar um projeto local num serviço publicado e numa app instalável.

---

### Fase 1 — Preparar o deploy na nuvem (`418f729`)

**Problema:** o backend só corria em `localhost` e a base de dados era criada manualmente.

**O que foi feito:**

1. Criado `backend/railway.json`:
   ```json
   {
     "build": { "builder": "RAILPACK" },
     "deploy": {
       "startCommand": "npm start",
       "healthcheckPath": "/api/health",
       "healthcheckTimeout": 120,
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```
2. Criado um **bootstrap automático** (`backend/scripts/init-db.js`) que aplica, de forma
   idempotente:
   - `database/schema.sql` (tabelas)
   - `database/seed.sql` (categorias + habilidades)
   - `src/scripts/migrate.js` (tabelas da fase A: carteiras, escrow, etc.)
   - criação/atualização do **ADMIN** a partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD`
3. Adicionado `npm run db:init`.
4. A pasta de uploads passou a ser configurável (`UPLOADS_DIR`), porque no Railway o disco é
   efémero.

**No Railway (painel):**
- Novo projeto → deploy do repositório GitHub.
- Serviço **backend** com **Root Directory = `/backend`**.
- Serviço **MySQL** adicionado ao mesmo projeto.
- Variáveis do backend:
  - `MYSQL_URL = ${{MySQL.MYSQL_URL}}` (referência interna, sem expor a senha)
  - `JWT_SECRET` (valor aleatório gerado pelo utilizador)
  - `NODE_ENV = production`
  - `CORS_ORIGINS = http://localhost,https://localhost,capacitor://localhost`
- Domínio público gerado: `freelamz-production-7103b885.up.railway.app`.

**Resultado:** `/api/health` respondeu `db: "up"`.

---

### Fase 2 — Arranque resiliente (`97466a2`)

**Problema:** se a base de dados demorasse a acordar (ou estivesse em baixo), o processo morria
e o Railway entrava em ciclo de reinícios.

**O que foi feito:**

- `validarArranque()` lista apenas os **nomes** das variáveis em falta (nunca os valores) e
  explica onde as definir.
- O servidor começa a ouvir **antes** de ligar à BD: `/api/health` responde sempre `200`.
- `testarConexao({ tentativas: 5 })` com espera entre tentativas.
- Revalidação a cada 60 s: quando a BD volta, os lembretes automáticos arrancam sozinhos.
- Novo endpoint `/api/health/db` com host, base e motivo do erro (sem senha).
- Encerramento limpo em `SIGTERM`/`SIGINT` (o Railway envia `SIGTERM` nos deploys).

**Resultado:** deploys deixaram de falhar por causa da BD.

---

### Fase 3 — `MYSQL_URL` com fallback de senha (`aa9129e`)

**Problema:** em alguns cenários o Railway fornecia `MYSQL_URL` sem senha utilizável, ou o
utilizador definia `MYSQLPASSWORD` em vez de `DB_PASSWORD`.

**O que foi feito** em `backend/src/config/dbConfig.js`:

- Prioridade: `MYSQL_URL` → variáveis `DB_*` → `MYSQL*` do Railway.
- Fallback da senha: `MYSQL_URL` → `MYSQLPASSWORD` → `DB_PASSWORD`.
- Aviso **apenas** quando falta mesmo uma variável obrigatória.
- `resumoConfig()` mostra host/porta/base (nunca a senha) para diagnóstico.

---

### Fase 4 — Página inicial sem login (`7582478`)

**Problema:** um visitante sem conta era expulso para o login só por abrir a app, e a lista de
freelancers exigia autenticação.

**O que foi feito:**

- `GET /api/users/freelancers` e `GET /api/users/freelancers/:id` passaram a ser **públicos**.
- `Profile.semPrivados()` remove `email` e `metodos_recebimento` das respostas públicas.
- `frontend/src/js/api.js`: o `401` só termina a sessão **se existir token** (um visitante já
  não é expulso).
- Smoke test ajustado: **130/130 verificações** passaram.

---

### Fase 5 — APK Android automático

**Problema:** compilar Android exige Android Studio/SDK — demasiado para o dia a dia.

**O que foi feito** em `.github/workflows/build-apk.yml`:

1. `workflow_dispatch` (botão “Run workflow”) e tags `v*`.
2. Node.js 22 + Java 21 (exigido pelo Capacitor 8).
3. Verificação obrigatória da variável de repositório `VITE_API_URL`
   (ex.: `https://freelamz-production-7103b885.up.railway.app/api`).
4. `npm ci` → `npm run build` → `npx cap sync android` → `./gradlew assembleDebug`.
5. Publicação do artefacto **`freelamz-apk`** (retenção 30 dias).
6. Bloco comentado para APK/AAB assinado da Play Store (keystore em Secrets).

**Resultado:** primeiro APK gerado em 4m12s (run `43179221389`).

---

### Fase 6 — Dados de demonstração (`021eb32`)

**Problema:** a app publicada aparecia vazia (só categorias + admin).

**O que foi feito** em `backend/scripts/demo-seed.js`:

- **8 freelancers + 2 clientes** com perfil, habilidades, carteira e **12 serviços**.
- E-mails `@demo.freelamz.mz`, senha única `Demo1234` (configurável por `DEMO_PASSWORD`).
- **Idempotente**: correr duas vezes não duplica.
- Scripts:
  - `npm run db:demo` — cria os dados
  - `npm run db:demo:limpar` — remove apenas os e-mails `@demo.freelamz.mz`
- Testado localmente: 10 criadas → 0 criadas / 10 existentes; login `200 FREELANCER`.

---

### Fase 7 — Login no telemóvel (`021eb32`)

**Problema:** o cartão de login não ficava centrado no telemóvel; o topo era cortado em ecrãs
baixos; o Android fazia zoom ao tocar no email.

**O que foi feito** em `frontend/src/css/app.css` e `frontend/src/pages/login.js`:

- `.auth-page` passou a usar `min-height: 100%` + `margin: auto` no cartão (centragem real e
  rolagem quando o teclado abre).
- `padding` com `env(safe-area-inset-*)` para **notch** e barras do sistema.
- Inputs do login com `font-size: 16px` → acaba o zoom automático do WebView.
- Botão **mostrar/esconder senha** (`.field-toggle`, classe `has-toggle`).
- Teclado sem maiúsculas/correção automática no email (`autocapitalize="none"`, `enterkeyhint`).

---

### Fase 8 — Página “Sobre” (`2e042ce`)

**Objetivo do utilizador:** uma página a dizer que foi feito por Clávio Alfredo Chitsulete,
com um pouco da história do processo.

**O que foi feito:**

- Criada `frontend/src/pages/sobre.js` com:
  - identidade da app e versão;
  - cartão do autor (nome + email);
  - “Como nasceu” — 5 parágrafos sobre o problema, o desenho do fluxo, a stack, os problemas
    reais e os próximos passos;
  - tabela de tecnologia;
  - créditos com o ano atual.
- Rota `/sobre` em `frontend/src/routes.js`.
- `/sobre` adicionada a `ROTAS_PUBLICAS` em `frontend/src/app.js` (abre sem login).
- Crédito no **splash** e no **login**; dois itens em **Configurações**.
- CSS: `.sobre-logo`, `.sobre-logo-sm`, `.sobre-p`, `.auth-credito`, `.splash-credito`.

---

### Fase 9 — Semear os dados demo sem copiar a senha (`d678367`, `20dd09a`)

**Problema:** o `npm run db:demo` a partir do PC não chegava ao Railway. A `MYSQL_URL` estava
vazia na janela do PowerShell (`host=` e `porta=` em branco), pelo que o script se ligava ao
MySQL **local** (`127.0.0.1`). Copiar a URL pública exige expor a senha e ativar o Public
Networking.

**O que foi feito:**

- `demo-seed.js` passou a ser um **módulo** (`module.exports = { main, DOMINIO }`) que pode ser
  chamado pelo servidor, além de continuar a funcionar como CLI.
- `backend/src/server.js`: se `SEED_DEMO=true`, o servidor semeia os dados no arranque, usando a
  `MYSQL_URL` **interna** do Railway. Se falhar, tenta novamente quando a BD responder.
- `/api/health` passou a expor, sem segredos:
  ```json
  { "revisao": "91702cf",
    "seed_demo": { "pedido": true, "em_curso": false, "feito": true, "erro": null } }
  ```
  - `revisao` = SHA do deploy (mostra se o código novo já está ativo).
  - `seed_demo` = se o pedido chegou, se está a correr, se terminou e o último erro.

**Como foi aplicado no Railway:** variável `SEED_DEMO=true` no serviço backend → Redeploy
automático → logs mostraram `Contas criadas agora: 10` → dados confirmados pela API.

---

### Fase 10 — “Sobre” sempre visível (`91702cf`)

**Problema:** o utilizador não encontrava a página. Os links existiam, mas estavam escondidos
(splash, login e Configurações) e o APK instalado era anterior.

**O que foi feito:**

- Novo item **Sobre** no menu lateral (☰), depois de Configurações.
- Crédito “Feito por Clávio Alfredo Chitsulete” no rodapé do menu lateral (clicável).
- O handler de navegação do painel passou a apanhar **todos** os `.panel-link` do painel
  (antes só os do `.panel-menu`), para o link do rodapé navegar e fechar o menu.
- Frontend recompilado e **APK novo** gerado (run `43196927469`).

---

## 5. Problemas encontrados e soluções

| # | Sintoma | Causa | Solução |
|---|---|---|---|
| 1 | Deploy falhava / ciclo de reinícios | BD ainda a acordar | Arranque resiliente + retentativas + health sempre 200 |
| 2 | `MYSQL_URL` sem senha | Variáveis inconsistentes no Railway | Fallback `MYSQLPASSWORD`/`DB_PASSWORD` + validação clara |
| 3 | App pedia login para ver a página inicial | Endpoints de freelancers privados + `401` a expulsar | Endpoints públicos + `401` só termina sessão com token |
| 4 | App vazia em produção | Só existiam categorias e admin | Script de dados demo idempotente |
| 5 | `db:demo` não chegava ao Railway | `MYSQL_URL` vazia na janela → ligava a `127.0.0.1` | Seed automático no servidor via `SEED_DEMO=true` |
| 6 | Login descentrado / cortado no telemóvel | `justify-content` + `100dvh` no WebView | `margin:auto`, `100%`, safe-area, inputs 16px |
| 7 | Acentos estragados nos testes | PowerShell 5.1 corrompe UTF-8 no corpo JSON | Testes passaram a usar Node/`fetch` |
| 8 | “Sobre” não encontrada | Links escondidos + APK antigo | Item no menu lateral + APK recompilado |
| 9 | Imagens desaparecem após deploy | Disco do Railway é efémero | Documentado: Volume ou Cloudinary (pendente) |

---

## 6. Ficheiros criados/alterados (principais)

### Backend

| Ficheiro | Função |
|---|---|
| `backend/src/server.js` | Arranque, health, CORS, seed automático, encerramento limpo |
| `backend/src/config/dbConfig.js` | Leitura/validação de `MYSQL_URL`/`DB_*`/`MYSQL*` |
| `backend/src/config/db.js` | Pool, teste de ligação, estado |
| `backend/scripts/init-db.js` | Schema + seed + migrações + admin |
| `backend/scripts/demo-seed.js` | Dados de demonstração (CLI e módulo) |
| `backend/railway.json` | Build/deploy/healthcheck do Railway |
| `backend/package.json` | Scripts `db:init`, `db:demo`, `db:demo:limpar` |
| `backend/.env.example` | Todas as variáveis documentadas |
| `backend/src/routes/userRoutes.js` | Listagem/perfil de freelancers públicos |
| `backend/src/models/Profile.js` | Remove `email` e `metodos_recebimento` nas respostas públicas |

### Frontend

| Ficheiro | Função |
|---|---|
| `frontend/src/app.js` | Guard de autenticação, rotas públicas, overlay sem conexão |
| `frontend/src/routes.js` | Rota `/sobre` |
| `frontend/src/pages/sobre.js` | Página “Sobre” (autor + processo) |
| `frontend/src/pages/login.js` | Layout mobile, mostrar/esconder senha, crédito |
| `frontend/src/pages/settings.js` | Itens para `/sobre` |
| `frontend/src/pages/splash.js` | Crédito do autor |
| `frontend/src/js/api.js` | `401` só termina sessão com token |
| `frontend/src/js/layout.js` | Navegação do painel (inclui rodapé) |
| `frontend/src/css/app.css` | Auth mobile, `.sobre-*`, `.field-toggle`, créditos |
| `frontend/index.html` | Item “Sobre” + crédito no menu lateral |

### Infraestrutura / documentação

| Ficheiro | Função |
|---|---|
| `.github/workflows/build-apk.yml` | Build automático do APK (debug) |
| `README.md` | Instalação, variáveis, credenciais, `db:demo` |
| `RELATORIO.md` | Este relatório |

---

## 7. Como reproduzir do zero

### 7.1 Base de dados (local)

```powershell
cd C:\laragon\www\freelamz\backend
npm install
npm run db:init     # schema + categorias + migrações + admin
npm run db:demo     # opcional: freelancers/serviços de exemplo
npm run dev         # API em http://localhost:3000
```

### 7.2 Frontend (local)

```powershell
cd C:\laragon\www\freelamz\frontend
npm install
npm run dev         # http://localhost:5173
```

### 7.3 Produção (Railway)

1. Serviço backend com **Root Directory `/backend`**.
2. Variáveis: `MYSQL_URL=${{MySQL.MYSQL_URL}}`, `JWT_SECRET`, `NODE_ENV=production`,
   `CORS_ORIGINS`.
3. Opcional: `SEED_DEMO=true` (semeia e pode ser removido depois).
4. `db:init` corre uma vez com `ADMIN_EMAIL`/`ADMIN_PASSWORD` (pode ser executado localmente
   contra a URL pública do MySQL, ou via uma tarefa do Railway).

### 7.4 APK

1. GitHub → **Settings → Secrets and variables → Actions → Variables**:
   `VITE_API_URL=https://freelamz-production-7103b885.up.railway.app/api`
2. **Actions → Build APK → Run workflow** (branch `main`).
3. Descarregar o artefacto **`freelamz-apk`** → extrair → instalar `app-debug.apk`.

---

## 8. Variáveis de ambiente

| Variável | Obrigatória | Onde | Para que serve |
|---|---|---|---|
| `MYSQL_URL` | sim | Railway | Ligação completa ao MySQL (tem prioridade) |
| `JWT_SECRET` | sim (produção) | Railway | Assinatura dos tokens |
| `NODE_ENV` | sim | Railway | `production` |
| `CORS_ORIGINS` | recomendada | Railway | Origens permitidas no browser/APK |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | só `db:init` | local/Railway | Criação do administrador |
| `SEED_DEMO` | opcional | Railway | Semeia dados demo no arranque |
| `DEMO_PASSWORD` | opcional | local/Railway | Senha das contas demo (padrão `Demo1234`) |
| `DB_SSL` | conforme | local | Encriptação da ligação |
| `UPLOADS_DIR` / `UPLOADS_PRIVATE_DIR` | opcional | Railway | Pastas de uploads (Volume) |
| `VITE_API_URL` | sim (build APK) | GitHub Actions | URL da API dentro do APK |

> Nunca colar `MYSQL_URL`, `JWT_SECRET` ou senhas em chats, issues ou commits.

---

## 9. Credenciais

### Demonstração (produção) — senha `Demo1234`

| Tipo | E-mails |
|---|---|
| Freelancers | `isabel@demo.freelamz.mz`, `carlos@…`, `beatriz@…`, `helder@…`, `rosa@…`, `amos@…`, `luis@…`, `marta@…` |
| Clientes | `cliente@demo.freelamz.mz`, `empresa@demo.freelamz.mz` |

### Administrador (produção)

`claviochitsulete@gmail.com` — senha definida pelo proprietário no `db:init` (não fica no
código nem neste relatório).

### Desenvolvimento local

| Tipo | Email | Senha |
|---|---|---|
| Admin | `admin@freelamz.com` | `Admin@12345` |
| Cliente | `cliente@freelamz.com` | `Cliente@123` |
| Freelancer | `freela@freelamz.com` | `Freela@123` |

> Antes de divulgar a app a utilizadores reais: mudar `DEMO_PASSWORD` ou remover as contas com
> `npm run db:demo:limpar`.

---

## 10. Verificações e testes

| Verificação | Resultado |
|---|---|
| `npm run smoke` (API) | 130/130 |
| Build do frontend (`npm run build`) | OK (~1 min) |
| `/api/health` | `db: "up"`, `seed_demo.feito: true` |
| `/api/categories` | 12 |
| `/api/services` | 12 |
| `/api/users/freelancers` | 9 |
| Login demo | `200`, `tipo: FREELANCER` |
| APK builds | `43179221389`, `43193384099`, `43196927469` — todos verdes |
| Idempotência do seed | 10 criadas → 0 criadas / 10 existentes |

---

## 11. Limitações conhecidas

1. **Uploads efémeros:** sem Volume no Railway, as imagens desaparecem no deploy seguinte.
   Solução: Volume em `/app/uploads` ou serviço externo (Cloudinary).
2. **APK de debug:** não assinado para a Play Store. O bloco de assinatura já está preparado
   (comentado) no workflow.
3. **Pagamentos simulados:** `PAYMENT_PROVIDER=fake`. M-Pesa/e-Mola reais exigem chaves.
4. **Sem notificações push:** só notificações dentro da app.
5. **Conta de diagnóstico** (`diagnostico.app@example.com`) ainda existe em produção; pode ser
   apagada no Painel Admin.
6. **`SEED_DEMO=true`** continua ativo; é idempotente, mas convém pôr `false` depois de
   confirmar os dados.

---

## 12. Próximos passos sugeridos

1. Remover/desativar `SEED_DEMO` e mudar `DEMO_PASSWORD`.
2. Criar Volume para uploads persistentes.
3. Integrar pagamentos reais (M-Pesa/e-Mola) e testar em modo sandbox.
4. Assinar o APK/AAB e publicar na Play Store.
5. Notificações push (Capacitor Push / FCM).
6. Testes end-to-end no telemóvel com dados móveis.

---

## 13. Comandos úteis

```powershell
# Estado da API pública
curl.exe -s https://freelamz-production-7103b885.up.railway.app/api/health

# Diagnóstico da base de dados
curl.exe -s https://freelamz-production-7103b885.up.railway.app/api/health/db

# Ver commits
git log --oneline -n 15

# Disparar o APK
gh workflow run build-apk.yml --ref main
gh run list --workflow=build-apk.yml --limit 3

# Dados demo (local)
cd backend
npm run db:demo
npm run db:demo:limpar
```

---

*Relatório gerado a partir do estado real do repositório e da API em produção.*
