/* ============================================================
   FreelaMZ — Criar as tabelas no TiDB Cloud Starter

   Necessário porque o seed automático da Render parte do princípio
   de que o schema já existe. Este script aplica, na ordem:
     1. database/schema.sql
     2. database/seed.sql   (categorias + habilidades)
     3. src/scripts/migrate.js (tabelas da FASE A)

   A senha vem de TIDB_PASSWORD no backend/.env e nunca é impressa.
   ============================================================ */
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const HOST = process.env.TIDB_HOST || 'gateway01.sa-east-1.prod.aws.tidbcloud.com';
const PORTA = parseInt(process.env.TIDB_PORT || '4000', 10);
const UTILIZADOR = process.env.TIDB_USER || '4RvyEVJJGCtaatr.root';
const SENHA = process.env.TIDB_PASSWORD || '';
const BASE = 'freelamz';

function semSegredo(texto) {
  const s = String(texto || '');
  return SENHA ? s.split(SENHA).join('***') : s;
}

function lerSql(nome) {
  const caminho = path.resolve(__dirname, '../../database', nome);
  if (!fs.existsSync(caminho)) throw new Error(`não encontrei ${caminho}`);
  return fs.readFileSync(caminho, 'utf8');
}

async function main() {
  if (!SENHA) {
    console.error('[TIDB] Falta TIDB_PASSWORD no backend/.env.');
    process.exitCode = 1;
    return;
  }

  const opcoes = {
    host: HOST,
    port: PORTA,
    user: UTILIZADOR,
    password: SENHA,
    database: BASE,
    ssl: {},
    multipleStatements: true,
    connectTimeout: 20000,
  };

  console.log('[TIDB] Destino:', `${HOST}:${PORTA}`, 'utilizador:', UTILIZADOR, 'base:', BASE, 'TLS: sim');

  let ligacao;
  try {
    ligacao = await mysql.createConnection(opcoes);

    console.log('[TIDB] A aplicar schema.sql…');
    await ligacao.query(lerSql('schema.sql'));
    console.log('[TIDB] schema.sql aplicado.');

    console.log('[TIDB] A aplicar seed.sql…');
    await ligacao.query(lerSql('seed.sql'));
    console.log('[TIDB] seed.sql aplicado.');

    const [tabelas] = await ligacao.query(
      'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ?',
      [BASE]
    );
    const [cats] = await ligacao.query('SELECT COUNT(*) AS total FROM categories');
    console.log('[TIDB] Tabelas criadas:', tabelas[0].total);
    console.log('[TIDB] Categorias:', cats[0].total);
  } catch (erro) {
    console.error('[TIDB] ERRO:', erro.code || 'ERRO', '—', semSegredo(erro.message || erro));
    process.exitCode = 1;
    return;
  } finally {
    if (ligacao) await ligacao.end();
  }

  /* O migrate.js lê a config por MYSQL_URL. Passamos uma URL já codificada
     para que o dotenv do processo-filho não a substitua pela do .env local. */
  console.log('[TIDB] A aplicar migrações (FASE A)…');
  const url = 'mysql://'
    + encodeURIComponent(UTILIZADOR) + ':' + encodeURIComponent(SENHA)
    + '@' + HOST + ':' + PORTA + '/' + BASE;

  const envFilho = { ...process.env };
  delete envFilho.DATABASE_URL;
  delete envFilho.DB_URL;
  envFilho.MYSQL_URL = url;
  envFilho.DB_SSL = 'true';

  const r = spawnSync(process.execPath, [path.resolve(__dirname, '../src/scripts/migrate.js')], {
    stdio: 'inherit',
    env: envFilho,
    cwd: path.resolve(__dirname, '..'),
  });

  if (r.status !== 0) {
    console.error('[TIDB] migrate.js falhou com código', r.status);
    process.exitCode = 1;
    return;
  }

  console.log('[TIDB] CONCLUÍDO. A Render deve semear os dados de demonstração em até 60 s.');
}

main();
