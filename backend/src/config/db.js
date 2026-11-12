const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

/* SSL opcional para MySQL gerido (Railway, Aiven, PlanetScale...).
   DB_SSL=true          → encripta a ligação (não valida o certificado)
   DB_SSL_CA=/caminho   → valida com a AC indicada (recomendado) */
function opcoesSsl() {
  const modo = String(process.env.DB_SSL || '').trim().toLowerCase();
  if (!modo || modo === 'false' || modo === '0') return undefined;
  const caPath = process.env.DB_SSL_CA;
  if (caPath && fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

const ssl = opcoesSsl();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'freelamz',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  ...(ssl ? { ssl } : {}),
});

pool.getConnection()
  .then((conn) => {
    console.log('[DB] Conectado ao MySQL:', process.env.DB_NAME);
    conn.release();
  })
  .catch((err) => {
    console.error('[DB] Erro ao conectar ao MySQL:', err.message);
  });

module.exports = pool;
