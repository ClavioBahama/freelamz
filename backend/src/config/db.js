/* ============================================================
   FreelaMZ — Pool de ligações MySQL (mysql2/promise)

   - A configuração vem de src/config/dbConfig.js
     (DB_* ou variáveis nativas do Railway).
   - `testarConexao()` tenta 5 vezes com espera crescente e
     NUNCA encerra o processo: devolve { ok, code, message }.
   - `verificarBanco()` faz um teste rápido (usado por /api/health/db).
   - `estadoBanco` guarda o último estado conhecido (sem segredos).
   ============================================================ */
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { obterConfigBanco, resumoConfig } = require('./dbConfig');

const cfg = obterConfigBanco();

const pool = mysql.createPool({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  ...(cfg.ssl ? { ssl: cfg.ssl } : {}),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

/* Estado observável (usado pelos endpoints de health). */
const estadoBanco = {
  online: false,
  tentativas: 0,
  ultimoErro: null,
  verificadoEm: null,
};

function registarErro(err) {
  estadoBanco.online = false;
  estadoBanco.ultimoErro = {
    code: err.code || 'ERRO',
    message: err.message || String(err),
  };
  estadoBanco.verificadoEm = new Date().toISOString();
}

/* Um único teste rápido. Nunca lança. */
async function verificarBanco() {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.query('SELECT 1');
    } finally {
      conn.release();
    }
    estadoBanco.online = true;
    estadoBanco.ultimoErro = null;
    estadoBanco.verificadoEm = new Date().toISOString();
    return { ok: true };
  } catch (err) {
    registarErro(err);
    return { ok: false, code: estadoBanco.ultimoErro.code, message: estadoBanco.ultimoErro.message };
  }
}

/* Liga com retentativas: 1s, 2s, 4s, 8s (5 tentativas no total). */
async function testarConexao({ tentativas = 5 } = {}) {
  const esperas = [1000, 2000, 4000, 8000, 8000];

  for (let i = 1; i <= tentativas; i += 1) {
    estadoBanco.tentativas = i;
    const r = await verificarBanco();

    if (r.ok) {
      console.log('[DB] Conectado ao MySQL:', cfg.database || '(sem nome)',
        `(${cfg.host}:${cfg.port})`);
      return { ok: true };
    }

    console.error(`[DB] Tentativa ${i}/${tentativas} falhou:`, r.code, '—', r.message);

    if (i < tentativas) {
      const espera = esperas[Math.min(i - 1, esperas.length - 1)];
      console.error(`[DB] Nova tentativa em ${espera / 1000}s…`);
      await new Promise((resolve) => setTimeout(resolve, espera));
    }
  }

  console.error('[DB] ERRO: não foi possível ligar ao MySQL após', tentativas, 'tentativas.');
  console.error('[DB] Configuração usada (sem password):', resumoConfig(cfg));
  console.error('[DB] Verifique DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME');
  console.error('[DB] (ou defina MYSQL_URL). Em MySQL gerido, experimente DB_SSL=true.');
  return { ok: false, ...estadoBanco.ultimoErro };
}

/* NOTA: não criar `pool.pool` — o mysql2/promise usa essa propriedade
   internamente para o pool de callback e a sobrescrita provoca
   "Maximum call stack size exceeded". */
module.exports = pool;
module.exports.testarConexao = testarConexao;
module.exports.verificarBanco = verificarBanco;
module.exports.estadoBanco = estadoBanco;
module.exports.configBanco = cfg;
