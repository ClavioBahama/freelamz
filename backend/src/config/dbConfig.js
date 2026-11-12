/* ============================================================
   FreelaMZ — Configuração única do MySQL

   Ordem de prioridade:
     1. MYSQL_URL / DATABASE_URL / DB_URL  (uma só string de ligação)
     2. DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME
     3. Variáveis nativas do Railway:
        MYSQLHOST/MYSQLPORT/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE

   SSL opcional:
     DB_SSL=true          → encripta (não valida o certificado)
     DB_SSL_CA=/caminho   → valida com a AC indicada

   Este módulo é usado por db.js, migrate.js, seed.js e scripts/init-db.js,
   para que TODOS falem com a base de dados da mesma forma.
   ============================================================ */
const fs = require('fs');

function opcoesSsl() {
  const modo = String(process.env.DB_SSL || '').trim().toLowerCase();
  if (!modo || modo === 'false' || modo === '0' || modo === 'no') return undefined;

  const caPath = process.env.DB_SSL_CA;
  if (caPath && fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath), rejectUnauthorized: true };
  }
  // Encripta mas não valida a AC (útil em MySQL gerido)
  return { rejectUnauthorized: false };
}

function configDeUrl(url) {
  const u = new URL(url);
  const database = decodeURIComponent((u.pathname || '').replace(/^\//, ''));
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: database || undefined,
  };
}

function obterConfigBanco() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.DB_URL;
  let base;

  if (url) {
    base = configDeUrl(url);
  } else {
    base = {
      host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT, 10) || 3306,
      user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
      password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
      database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'freelamz',
    };
  }

  return { ...base, ssl: opcoesSsl() };
}

/* Resumo seguro (NUNCA inclui a password) para logs de diagnóstico. */
function resumoConfig(cfg) {
  return {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    database: cfg.database,
    ssl: !!cfg.ssl,
  };
}

/* Opções prontas para mysql2 (createConnection/createPool). */
function opcoesMysql(extra = {}) {
  const cfg = obterConfigBanco();
  return {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    charset: 'utf8mb4',
    ...(cfg.ssl ? { ssl: cfg.ssl } : {}),
    ...extra,
  };
}

module.exports = { obterConfigBanco, resumoConfig, opcoesMysql };
