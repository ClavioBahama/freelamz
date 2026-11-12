/* ============================================================
   FreelaMZ — Configuração única do MySQL

   Ordem de prioridade:
     1. MYSQL_URL / DATABASE_URL / DB_URL  (uma só string de ligação)
     2. DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME
     3. Variáveis nativas do Railway:
        MYSQLHOST/MYSQLPORT/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE

   Em produção não existem valores por omissão para host/user/base:
   se faltarem, `validarConfigBanco()` devolve os NOMES em falta
   (nunca os valores) para o arranque falhar com uma mensagem clara.

   SSL opcional:
     DB_SSL=true          → encripta (não valida o certificado)
     DB_SSL_CA=/caminho   → valida com a AC indicada
   ============================================================ */
const fs = require('fs');
const { emProducao } = require('./ambiente');

const URL_VARIAVEIS = ['MYSQL_URL', 'DATABASE_URL', 'DB_URL'];

function urlLigacao() {
  for (const nome of URL_VARIAVEIS) {
    const valor = String(process.env[nome] || '').trim();
    if (valor) return valor;
  }
  return '';
}

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

/* ---------- Validação (devolve nomes, nunca valores) ---------- */
function validarConfigBanco() {
  const problemas = [];
  const avisos = [];

  const url = urlLigacao();
  if (url) {
    try {
      const u = new URL(url);
      if (!u.hostname) problemas.push('MYSQL_URL (sem host)');
      if (!(u.pathname || '').replace(/^\//, '')) problemas.push('MYSQL_URL (sem nome da base)');
    } catch (e) {
      problemas.push('MYSQL_URL (formato inválido; esperado mysql://user:senha@host:porta/base)');
    }
    return { ok: problemas.length === 0, problemas, avisos, producao: emProducao() };
  }

  // Em desenvolvimento os valores por omissão (127.0.0.1/root/freelamz)
  // são aceitáveis. Em produção, não.
  if (emProducao()) {
    if (!process.env.DB_HOST && !process.env.MYSQLHOST) {
      problemas.push('DB_HOST (ou MYSQLHOST, ou MYSQL_URL)');
    }
    if (!process.env.DB_USER && !process.env.MYSQLUSER) {
      problemas.push('DB_USER (ou MYSQLUSER, ou MYSQL_URL)');
    }
    if (!process.env.DB_NAME && !process.env.MYSQLDATABASE) {
      problemas.push('DB_NAME (ou MYSQLDATABASE, ou MYSQL_URL)');
    }
    if (!process.env.DB_PASSWORD && !process.env.MYSQLPASSWORD) {
      avisos.push('DB_PASSWORD está vazia (o MySQL do Railway tem sempre uma password)');
    }
  }

  return { ok: problemas.length === 0, problemas, avisos, producao: emProducao() };
}

function obterConfigBanco() {
  const producao = emProducao();
  const url = urlLigacao();
  let base;

  if (url) {
    base = configDeUrl(url);
  } else {
    base = {
      host: process.env.DB_HOST || process.env.MYSQLHOST || (producao ? '' : '127.0.0.1'),
      port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT, 10) || 3306,
      user: process.env.DB_USER || process.env.MYSQLUSER || (producao ? '' : 'root'),
      password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
      database: process.env.DB_NAME || process.env.MYSQLDATABASE || (producao ? '' : 'freelamz'),
    };
  }

  return { ...base, ssl: opcoesSsl() };
}

/* Resumo seguro (NUNCA inclui a password) para logs de diagnóstico. */
function resumoConfig(cfg) {
  return {
    host: cfg.host || '(não definido)',
    port: cfg.port,
    user: cfg.user || '(não definido)',
    database: cfg.database || '(não definida)',
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

module.exports = {
  obterConfigBanco,
  validarConfigBanco,
  resumoConfig,
  opcoesMysql,
  urlLigacao,
};
