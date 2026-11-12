/* ============================================================
   FreelaMZ — Bootstrap de produção (Railway / Render / VPS)

   Executa, por ordem e de forma IDEMPOTENTE:
     1. database/schema.sql   → cria as tabelas se não existirem
     2. seed inicial          → SÓ se a tabela `users` estiver vazia
     3. src/scripts/migrate.js→ acrescenta colunas/tabelas novas

   Nunca apaga dados. Pode correr em cada arranque sem problema.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function opcoesSsl() {
  const modo = String(process.env.DB_SSL || '').trim().toLowerCase();
  if (!modo || modo === 'false' || modo === '0') return undefined;
  const caPath = process.env.DB_SSL_CA;
  if (caPath && fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

function conexaoBase(extra = {}) {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'freelamz',
    ...extra,
  };
}

/* Procura o schema.sql em vários locais possíveis (raiz do repo,
   pasta backend, diretório atual) para funcionar em qualquer host. */
function encontrarSchema() {
  const candidatos = [
    path.resolve(__dirname, '../../../database/schema.sql'),
    path.resolve(__dirname, '../../database/schema.sql'),
    path.resolve(process.cwd(), 'database/schema.sql'),
    path.resolve(process.cwd(), '../database/schema.sql'),
  ];
  return candidatos.find((p) => fs.existsSync(p)) || null;
}

function correr(script, nome) {
  console.log(`[BOOTSTRAP] A executar ${nome}…`);
  const r = spawnSync(process.execPath, [path.resolve(__dirname, script)], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`[BOOTSTRAP] ${nome} falhou (código ${r.status}).`);
    process.exit(r.status || 1);
  }
}

async function main() {
  const schema = encontrarSchema();
  if (!schema) {
    console.error('[BOOTSTRAP] ERRO: não encontrei database/schema.sql.');
    console.error('[BOOTSTRAP] Locais testados:',
      path.resolve(__dirname, '../../../database/schema.sql'),
      path.resolve(__dirname, '../../database/schema.sql'),
      path.resolve(process.cwd(), 'database/schema.sql'));
    process.exit(1);
  }
  console.log('[BOOTSTRAP] Schema encontrado em:', schema);

  const ssl = opcoesSsl();
  const conn = await mysql.createConnection(
    conexaoBase({ multipleStatements: true, ...(ssl ? { ssl } : {}) })
  );

  let baseVazia = false;
  try {
    const sql = fs.readFileSync(schema, 'utf8');
    await conn.query(sql);
    console.log('[BOOTSTRAP] Schema aplicado (tabelas garantidas).');

    const [rows] = await conn.query('SELECT COUNT(*) AS n FROM users');
    baseVazia = !rows.length || Number(rows[0].n) === 0;
    console.log(`[BOOTSTRAP] Utilizadores existentes: ${rows[0] ? rows[0].n : 0}`);
  } finally {
    await conn.end();
  }

  if (baseVazia) {
    console.log('[BOOTSTRAP] Base vazia → a criar dados iniciais (seed).');
    correr('seed.js', 'seed');
  } else {
    console.log('[BOOTSTRAP] Base já tem dados → seed ignorado.');
  }

  correr('migrate.js', 'migrate');

  console.log('[BOOTSTRAP] Concluído com sucesso.');
}

main().catch((err) => {
  console.error('[BOOTSTRAP] Erro fatal:', err);
  process.exit(1);
});
