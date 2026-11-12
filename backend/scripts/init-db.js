/* ============================================================
   FreelaMZ — Inicialização da base de dados (PRODUÇÃO)

   Executa, de forma IDEMPOTENTE:
     1. database/schema.sql  (CREATE TABLE IF NOT EXISTS)
     2. database/seed.sql    (apenas categorias + habilidades)
     3. src/scripts/migrate.js (tabelas da FASE A: carteiras, escrow…)
     4. Cria/atualiza o ADMIN com ADMIN_EMAIL e ADMIN_PASSWORD

   NÃO cria contas de teste (cliente/freelancer/smoke).
   O seed de desenvolvimento continua em src/scripts/seed.js.

   Como correr a partir do PC contra o MySQL do Railway:
     - No Railway, abra o MySQL > Connect > Public Networking e copie
       o host/porta/usuário/password/base (ou a MYSQL_URL pública).
     - Defina as variáveis na sua máquina (PowerShell), por exemplo:
         $env:DB_HOST="containers-us-west-XX.railway.app"
         $env:DB_PORT="12345"
         $env:DB_USER="root"
         $env:DB_PASSWORD="..."
         $env:DB_NAME="railway"
         $env:DB_SSL="true"
         $env:ADMIN_EMAIL="seu@email.com"
         $env:ADMIN_PASSWORD="uma-senha-forte"
         npm run db:init
   ============================================================ */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { opcoesMysql, obterConfigBanco, resumoConfig } = require('../src/config/dbConfig');

function falhar(msg) {
  console.error('[DB:INIT] ERRO:', msg);
  process.exit(1);
}

function lerSql(nome) {
  const candidatos = [
    path.resolve(__dirname, '../../database', nome),
    path.resolve(__dirname, '../database', nome),
    path.resolve(process.cwd(), 'database', nome),
    path.resolve(process.cwd(), '../database', nome),
  ];
  const achado = candidatos.find((p) => fs.existsSync(p));
  if (!achado) {
    falhar(`não encontrei ${nome}. Locais testados:\n  ${candidatos.join('\n  ')}`);
  }
  return { caminho: achado, sql: fs.readFileSync(achado, 'utf8') };
}

function validarAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (!email || !password) {
    falhar(
      'defina ADMIN_EMAIL e ADMIN_PASSWORD.\n'
      + '  No Railway: serviço freelamz > Variables > New Variable.\n'
      + '  Localmente: no ficheiro backend/.env ou com $env:ADMIN_EMAIL=...\n'
      + '  (NÃO use valores por omissão em produção.)'
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    falhar(`ADMIN_EMAIL inválido: "${email}".`);
  }
  if (password.length < 8) {
    falhar('ADMIN_PASSWORD demasiado curta (mínimo 8 caracteres). Use letras, números e símbolos.');
  }
  return { email, password };
}

function correrMigrate() {
  console.log('[DB:INIT] A aplicar migrações (FASE A)…');
  const r = spawnSync(process.execPath, [path.resolve(__dirname, '../src/scripts/migrate.js')], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    falhar(`migrate.js terminou com código ${r.status}.`);
  }
}

async function main() {
  const admin = validarAdmin();
  const cfg = obterConfigBanco();
  console.log('[DB:INIT] Destino:', resumoConfig(cfg));

  const schema = lerSql('schema.sql');
  const seed = lerSql('seed.sql');

  /* 1) schema + categorias/habilidades */
  const conn = await mysql.createConnection(opcoesMysql({ multipleStatements: true }));
  try {
    await conn.query(schema.sql);
    console.log('[DB:INIT] schema.sql aplicado (tabelas garantidas).');
    await conn.query(seed.sql);
    console.log('[DB:INIT] seed.sql aplicado (categorias + habilidades).');
  } finally {
    await conn.end();
  }

  /* 2) migrações da FASE A */
  correrMigrate();

  /* 3) administrador (cria ou atualiza a senha) */
  const conn2 = await mysql.createConnection(opcoesMysql());
  try {
    const hash = await bcrypt.hash(admin.password, 10);
    const [existe] = await conn2.query('SELECT id FROM users WHERE email = ?', [admin.email]);

    let adminId;
    if (existe.length) {
      adminId = existe[0].id;
      await conn2.query(
        `UPDATE users
            SET senha_hash = ?, tipo_usuario = 'ADMIN', status = 'ativo', email_verificado = 1
          WHERE id = ?`,
        [hash, adminId]
      );
      console.log('[DB:INIT] Administrador atualizado:', admin.email);
    } else {
      const [r] = await conn2.query(
        `INSERT INTO users
           (nome, email, senha_hash, tipo_usuario, status, email_verificado, cidade, provincia, pais)
         VALUES (?, ?, ?, 'ADMIN', 'ativo', 1, 'Maputo', 'Maputo', 'Moçambique')`,
        ['Administrador', admin.email, hash]
      );
      adminId = r.insertId;
      console.log('[DB:INIT] Administrador criado:', admin.email);
    }

    await conn2.query('INSERT IGNORE INTO wallets (user_id) VALUES (?)', [adminId]);
    console.log('[DB:INIT] Carteira do administrador garantida.');
  } finally {
    await conn2.end();
  }

  console.log('[DB:INIT] Concluído com sucesso.');
  console.log('[DB:INIT] Já pode iniciar sessão com o e-mail:', admin.email);
}

main().catch((err) => {
  console.error('[DB:INIT] Falhou:', err.code || '', err.message);
  process.exit(1);
});
