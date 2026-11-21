/* ============================================================
   FreelaMZ — Criar a base `freelamz` no TiDB Cloud Starter
   (alternativa ao SQL Editor, usando mysql2 com TLS)

   Como usar:
     1. Acrescentar ao backend/.env:
          TIDB_PASSWORD=<senha do utilizador TiDB>
     2. Na pasta backend: node scripts/criar-base-tidb.js

   A senha é lida apenas do ambiente e NUNCA é impressa.
   O host, a porta e o utilizador podem ser sobrescritos no .env
   com TIDB_HOST, TIDB_PORT e TIDB_USER.
   ============================================================ */
const path = require('path');
const mysql = require('mysql2/promise');

/* O `.env` principal é o que o utilizador indicou para a senha.
   O `.env.tidb.local` é opcional e serve para sobreposições locais. */
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env.tidb.local') });

const HOST = process.env.TIDB_HOST || 'gateway01.sa-east-1.prod.aws.tidbcloud.com';
const PORTA = parseInt(process.env.TIDB_PORT || '4000', 10);
const UTILIZADOR = process.env.TIDB_USER || '4RvyEVJJGCtaatr.root';
const SENHA = process.env.TIDB_PASSWORD || '';
const BASE = 'freelamz';

/* Garante que uma mensagem de erro nunca revela a senha. */
function semSegredo(texto) {
  const s = String(texto || '');
  return SENHA ? s.split(SENHA).join('***') : s;
}

async function main() {
  if (!SENHA) {
    console.error('[TIDB] Falta TIDB_PASSWORD.');
    console.error('[TIDB] Acrescente esta linha a backend/.env:');
    console.error('[TIDB]   TIDB_PASSWORD=<senha do utilizador TiDB>');
    console.error('[TIDB] Depois rode: node scripts/criar-base-tidb.js');
    process.exitCode = 1;
    return;
  }

  let ligacao;
  try {
    ligacao = await mysql.createConnection({
      host: HOST,
      port: PORTA,
      user: UTILIZADOR,
      password: SENHA,
      /* TiDB Cloud exige TLS. Objeto vazio = usar TLS com os defaults do Node. */
      ssl: {},
      connectTimeout: 20000,
    });

    console.log('[TIDB] Ligado com TLS a', `${HOST}:${PORTA}`, 'como', UTILIZADOR);

    await ligacao.query(
      'CREATE DATABASE IF NOT EXISTS `freelamz` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    console.log('[TIDB] CREATE DATABASE IF NOT EXISTS `freelamz` — concluído.');

    const [linhas] = await ligacao.query('SHOW DATABASES');
    const nomes = linhas.map((linha) => Object.values(linha)[0]);

    console.log('[TIDB] SHOW DATABASES:');
    for (const nome of nomes) console.log('   -', nome);

    if (nomes.includes(BASE)) {
      console.log(`[TIDB] OK: base \`${BASE}\` confirmada.`);
    } else {
      console.error(`[TIDB] ERRO: base \`${BASE}\` não aparece no SHOW DATABASES.`);
      process.exitCode = 1;
    }
  } catch (erro) {
    console.error('[TIDB] ERRO:', erro.code || 'ERRO', '—', semSegredo(erro.message || erro));
    process.exitCode = 1;
  } finally {
    if (ligacao) await ligacao.end();
  }
}

main();
