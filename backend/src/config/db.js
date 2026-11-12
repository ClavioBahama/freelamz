/* ============================================================
   FreelaMZ — Pool de ligações MySQL (mysql2/promise)

   A configuração vem de src/config/dbConfig.js (DB_* ou variáveis
   nativas do Railway). A ligação é testada no arranque por
   server.js, com mensagens de erro claras.
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

/* Testa a ligação. Lança erro com mensagem clara se falhar. */
async function testarConexao() {
  try {
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    console.log('[DB] Conectado ao MySQL:', cfg.database);
    return true;
  } catch (err) {
    console.error('[DB] ERRO: não foi possível ligar ao MySQL.');
    console.error('[DB] Detalhe:', err.code || '', err.message);
    console.error('[DB] Configuração usada:', resumoConfig(cfg));
    console.error('[DB] Verifique DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME');
    console.error('[DB] (ou defina MYSQL_URL). Em MySQL gerido, experimente DB_SSL=true.');
    throw err;
  }
}

/* NOTA: não criar `pool.pool` — o mysql2/promise usa essa propriedade
   internamente para o pool de callback e a sobrescrita provoca
   "Maximum call stack size exceeded". */
module.exports = pool;
module.exports.testarConexao = testarConexao;
module.exports.configBanco = cfg;
