# Migração do Railway para Render + TiDB Cloud

Guia operacional da migração do FreelaMZ para hospedagem gratuita, sem depender dos créditos do Railway.

**Decisão tomada em 21/11/2026:** backend na **Render** (Web Service gratuito) + base de dados na **TiDB Cloud Starter** (compatível com MySQL).

**Estado deste ficheiro (21/11/2026):**
- [x] Decisão de migrate e de não exportar o Railway registadas.
- [x] Base `freelamz` criada no TiDB Cloud Starter por `backend/scripts/criar-base-tidb.js`, com TLS, e confirmada por `SHOW DATABASES` (`freelamz` presente na lista).
- [x] Schema, seed de categorias e migrações aplicados no TiDB por `backend/scripts/preparar-tabelas-tidb.js` (15 tabelas, 12 categorias).
- [x] Web Service na Render criado; `MYSQL_URL` corrigida com o utilizador real do TiDB; `/api/health` com `db:"up"`.
- [x] Variável GitHub `VITE_API_URL` apontada para `https://freelamz.onrender.com/api`.
- [x] Seed de demonstração concluído automaticamente pela Render (`seed_demo.feito:true`).
- [x] Validação: `/api/health` com `db:"up"`, login demo `200 FREELANCER`, 12 categorias e 12 serviços.
- [x] Variável `VITE_API_URL` do GitHub actualizada e build do APK disparado (`gh workflow run build-apk.yml`).
- [ ] Commit/push final (depende de confirmação do utilizador).

> **Nota cosmética:** `/api/health` mostra `revisao:"local"` porque `backend/src/server.js` lê `RAILWAY_GIT_COMMIT_SHA`/`GIT_COMMIT`, e a Render expõe `RENDER_GIT_COMMIT`. Não afeta o funcionamento. Corrigir implica acrescentar essa variável à lista e fazer um novo deploy.
- [ ] Variável `VITE_API_URL` no GitHub, rebuild do APK, validação e commit (dependem da URL pública da Render e de confirmação).

Nenhuma senha, token ou variável sensível foi escrita neste ficheiro.

---

## 1. Porque esta combinação

| Item | Render (backend) | TiDB Cloud Starter (base) |
|---|---|---|
| Grátis | Web Service Node.js, 0,1 CPU / 512 MB, 750 h/mês por workspace | 5 GiB linha + 5 GiB coluna + 50 M RU por instância/mês; até 5 instâncias por organização |
| Cartão | Não é pedido para começar (a doc só fala em suspensão se exceder tráfego sem método de pagamento) | A doc oficial diz que o cartão só é exigido a partir da 6.ª instância ou em planos *Scalable* |
| Dorme | **Sim**: após 15 min sem pedidos, acorda em ~1 min | Não |
| MySQL | Não tem MySQL nativo (só Postgres grátis, que expira em 30 dias) | **Compatível com MySQL** — o `mysql2` do projeto funciona |
| Risco principal | Primeiro clique depois de inativo demora ~1 min | Se esgotar a quota, a instância é estrangulada até ao mês seguinte (sem cobrança) |

Alternativas analisadas e descartadas: Koyeb (já não tem web service grátis; Pro $29/mês), PlanetScale (sem plano grátis visível), Glitch (encerrado em 2025), Aiven (free tier não cobre MySQL), Cyclic (não foi possível confirmar).

**Aviso sobre o cold start da Render:** o docente deve abrir o link cerca de 1 minuto antes de apresentar, ou aceitar essa espera no primeiro acesso.

---

## 2. O que já está pronto no código (não é preciso alterar)

| Ficheiro | Motivo |
|---|---|
| `backend/src/config/dbConfig.js` | Aceita uma única `MYSQL_URL` (ou variáveis `DB_*`) e activa SSL com `DB_SSL=true` |
| `backend/src/config/db.js` | Pool `mysql2/promise`, `utf8mb4`, retry de ligação |
| `backend/src/server.js` | Usa `PORT`, escuta em `0.0.0.0`, expõe `/api/health`, CORS por `CORS_ORIGINS`, seed automático com `SEED_DEMO=true` |
| `frontend/src/js/api.js` | Lê `VITE_API_URL` (com `/api` por omissão) |
| `frontend/capacitor.config.js` | Deriva a URL do APK de `VITE_API_URL` |
| `.github/workflows/build-apk.yml` | Usa a variável de repositório `VITE_API_URL` — basta mudar o valor no GitHub |

**Não mudar** `frontend/.env.development`: ele deve continuar com `VITE_API_URL=/api`, porque em desenvolvimento o Vite faz proxy para `localhost:3000`. Apontá-lo para a Render quebraria o desenvolvimento local.

---

## 3. Antes de tocarmos em nada — decisão sobre os dados do Railway

O seed automático (`SEED_DEMO=true`) recria, no arranque e de forma idempotente:

- 12 categorias
- 9 freelancers de demonstração
- 12 serviços de demonstração
- login demo: `isabel@demo.freelamz.mz` / `Demo1234`

**Decisão confirmada pelo utilizador em 21/11/2026: NÃO há dados reais a preservar → exportação pulada.**

Consequências práticas:

- Não é preciso reactivar o serviço MySQL do Railway (está *Paused from exceeding limits*).
- Não é preciso gerar, transferir nem importar nenhum `freelamz-backup.sql`.
- A base no TiDB fica vazia e é povoada automaticamente pelo `SEED_DEMO=true` no primeiro arranque do backend: 12 categorias, 9 freelancers, 12 serviços e o login demo `isabel@demo.freelamz.mz` / `Demo1234`.
- O Railway pode ser desligado logo após a validação final, sem risco de perda de dados.

> Nunca partilhar o dump nem qualquer senha neste chat ou no repositório.

---

## 4. Passo A — Criar a base no TiDB Cloud (feito por si, no browser)

1. Abrir `https://tidbcloud.com` e criar conta / entrar.
2. **Create Cluster → Starter** (não escolher *Scalable*).
3. Região: **São Paulo (sa-east-1)** se aparecer; senão, a mais próxima.
4. Nome do cluster: `freelamz`.
5. Enquanto o cluster arranca, em **Access / Connection**:
   - criar um utilizador de aplicação com senha forte;
   - activar o **endpoint público**;
   - confirmar que a ligação usa **TLS**;
   - anotar: `host`, `porta 4000`, `utilizador`, `nome da base`.
6. Criar a base (pelo botão do painel ou por SQL):

```sql
CREATE DATABASE IF NOT EXISTS freelamz
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4.1 Criar a base por script (quando o SQL Editor não aparece)

Algumas contas TiDB Cloud Starter não mostram o SQL Editor. Nesse caso, usar o script do projeto:

1. Ligação usada (fornecida pelo utilizador):
   - Host: `gateway01.sa-east-1.prod.aws.tidbcloud.com`
   - Porta: `4000`
   - Utilizador: `4RvyEVJJGCtaatr.root`
   - TLS: obrigatório
2. Acrescentar ao `backend/.env` (este ficheiro é ignorado pelo Git):
   ```env
   TIDB_PASSWORD=<senha do utilizador TiDB>
   ```
3. Executar na pasta `backend`:
   ```powershell
   node scripts/criar-base-tidb.js
   ```
4. O script usa `mysql2` com `ssl: {}`, corre `CREATE DATABASE IF NOT EXISTS \`freelamz\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, corre `SHOW DATABASES` e confirma que `freelamz` aparece. **A senha nunca é impressa** e as mensagens de erro são filtradas para não a revelar.
5. O host, a porta e o utilizador também podem ser sobrescritos por `TIDB_HOST`, `TIDB_PORT` e `TIDB_USER` no mesmo `.env`.

### 4.2 Criar as tabelas (necessário numa base vazia)

O `SEED_DEMO=true` cria os **dados** de demonstração, mas pressupõe que as **tabelas** já existem. Numa base nova, o primeiro arranque falha com `ER_NO_SUCH_TABLE: freelamz.categories`. Aplicar então, a partir do PC:

```powershell
cd C:\laragon\www\freelamz\backend
node scripts/preparar-tabelas-tidb.js
```

O script aplica `database/schema.sql`, `database/seed.sql` e `src/scripts/migrate.js` directamente no TiDB, com a senha lida de `TIDB_PASSWORD` no `.env` (nunca impressa). Resultado observado em 21/11/2026: **15 tabelas, 12 categorias**, migrações FASE A concluídas.

Depois disso não é preciso fazer redeploy: o servidor revalida a ligação e volta a tentar o seed de demonstração a cada 60 segundos (`server.js`, bloco `revalidar`).

7. Importação de dump: **não aplicável** nesta migração (decisão registada na secção 3). O seed automático cria os dados no arranque.

8. Verificar que a base foi criada:

```powershell
mysql -h <HOST_TIDB> -P 4000 -u <UTILIZADOR_TIDB> -p -e "SHOW DATABASES LIKE 'freelamz';"
```

> Antes do primeiro arranque do backend a base está vazia — isso é esperado. As tabelas e os dados aparecem quando a Render iniciar o serviço com `SEED_DEMO=true`.
> O TiDB aceita `JSON`, `ENUM`, `FOREIGN KEY`, `AUTO_INCREMENT` e `information_schema`, que são usados pelo `database/schema.sql` e pelo `backend/src/scripts/migrate.js`.

---

## 5. Passo B — Criar o Web Service na Render (feito por si, no browser)

1. Abrir `https://dashboard.render.com` → **New → Web Service**.
2. Ligar a conta GitHub (OAuth) e escolher o repositório `freelamz`.
3. Configuração:
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
   - **Health Check Path:** `/api/health`
4. Em **Environment**, introduzir **directamente no painel** (nunca no chat):

| Variável | Valor |
|---|---|
| `MYSQL_URL` | `mysql://<UTILIZADOR_TIDB>:<SENHA>@<HOST_TIDB>:4000/freelamz` |
| `DB_SSL` | `true` (se a URL não incluir `ssl`) |
| `JWT_SECRET` | gerar localmente: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | `http://localhost,https://localhost,capacitor://localhost` |
| `SEED_DEMO` | `true` |

> **Pode usar "Add from .env":** a Render confirma na sua documentação que o botão *Add from .env* (em *Environment*) adiciona as variáveis em bloco. Use um ficheiro limpo, com apenas as 6 variáveis acima — o modelo está em `backend/.env.render.example`. **Não carregue o `backend/.env` local**: ele contém `DB_HOST=127.0.0.1`, `DB_PASSWORD` do Laragon e outras definições de desenvolvimento que não devem ir para a Render. Depois escolha *Save, rebuild, and deploy*.
>
> Não usar a secção *Secret Files*: o código lê `process.env`, não ficheiros em `/etc/secrets`.

5. **Create Web Service**. Quando o deploy terminar, copiar a URL pública, que terá o formato `https://<servico>.onrender.com`.
6. Enviar **apenas essa URL pública** para o assistente (não é segredo). É a única informação que falta para a parte automatizada.

Verificação imediata:

```powershell
curl.exe -s https://<servico>.onrender.com/api/health
```

Esperar `db:"up"` e `revisao` igual ao SHA do último commit.

---

## 6. Passo C — Parte automatizada (feita pelo assistente, após a URL pública)

Com a URL da Render em mãos:

1. Actualizar a variável de repositório usada pelo APK:
   ```powershell
   gh variable set VITE_API_URL --repo ClavioBahama/freelamz --body "https://<servico>.onrender.com/api"
   ```
2. Actualizar `README.md` e `RELATORIO.md` com a nova URL da API.
3. Disparar a rebuild do APK:
   ```powershell
   gh workflow run build-apk.yml --repo ClavioBahama/freelamz
   ```
4. Rodar a validação (health, login demo, contagens, rota `/sobre`).
5. Só com aprovação: `git add` + `git commit` + `git push` destes ficheiros.

---

## 7. Validação final

```powershell
# 1. Saúde da API e da base
curl.exe -s https://<servico>.onrender.com/api/health
curl.exe -s https://<servico>.onrender.com/api/health/db

# 2. Login demo (esperar 200 e perfil FREELANCER)
curl.exe -s -X POST https://<servico>.onrender.com/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"isabel@demo.freelamz.mz","senha":"Demo1234"}'

# 3. Smoke test completo (usa API_URL; cria e apaga contas de teste)
cd backend
$env:API_URL="https://<servico>.onrender.com/api"
npm run smoke
```

Checklist:

- [ ] `/api/health` com `db:"up"` e `revisao` correcto
- [ ] Login demo devolve `200 FREELANCER`
- [ ] Rota pública `/sobre` abre sem login
- [ ] 12 categorias, 9 freelancers, 12 serviços
- [ ] APK novo gerado no GitHub Actions com a URL da Render
- [ ] README e RELATORIO actualizados

---

## 8. Segurança e rollout

- Nenhuma senha, `JWT_SECRET`, `MYSQL_URL` com senha ou token foi ou deve ser colado no chat.
- Os valores sensíveis ficam apenas nos painéis da TiDB e da Render.
- O cartão da TiDB só é necessário a partir da 6.ª instância ou em *Scalable* — confirmar no ecrã de registo.
- A Render pode suspender os serviços gratuitos se esgotar horas/banda; nesse caso, sem método de pagamento, suspende até ao mês seguinte.
- **Manter o Railway intacto até a validação terminar.** Só depois de tudo verde é que o projecto antigo deve ser desligado.
- Se algo falhar, o rollback imediato é voltar a apontar `VITE_API_URL` para a URL antiga — mas essa URL está actualmente pausada, por isso o rollback real depende de reactivar o Railway.

---

## 9. Fontes consultadas

- Render — https://docs.render.com/free
- TiDB Cloud Starter — https://www.pingcap.com/tidb-cloud-starter-pricing-details/
- alwaysdata (alternativa descartada) — https://www.alwaysdata.com/en/pricing/ e https://help.alwaysdata.com/en/docs/admin-billing/billing/choose-its-paas/
- Koyeb (alternativa descartada) — https://www.koyeb.com/pricing
