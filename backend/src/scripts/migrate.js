/* ============================================================
   FreelaMZ — Migração "Perfis ricos" (idempotente)
   Executar: npm run migrate   (pode repetir sem quebrar nada)

   Estratégia: MySQL 8.4 não suporta ADD COLUMN IF NOT EXISTS,
   portanto cada coluna é verificada em information_schema antes
   do ALTER. Tabelas novas usam CREATE TABLE IF NOT EXISTS.
   Nunca apaga dados — apenas adiciona/preenche.
   ============================================================ */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const { opcoesMysql } = require('../config/dbConfig');
const paths = require('../config/paths');

function slug(nome) {
  return String(nome || 'user')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 40) || 'user';
}

async function colunasExistentes(c, tabela) {
  const [rows] = await c.query(
    `SELECT COLUMN_NAME as nome FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tabela]
  );
  return new Set(rows.map((r) => r.nome));
}

async function indexesExistentes(c, tabela) {
  const [rows] = await c.query(
    `SELECT INDEX_NAME as nome FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? GROUP BY INDEX_NAME`,
    [tabela]
  );
  return new Set(rows.map((r) => r.nome));
}

async function main() {
  const c = await mysql.createConnection(opcoesMysql({ multipleStatements: true }));

  try {
    console.log('[MIGRATE] A ligar ao banco…');

    /* ---------- users: novas colunas ---------- */
    const novosUsers = [
      ['nome_utilizador', "VARCHAR(60) NULL"],
      ['bio', "VARCHAR(160) NULL"],
      ['sobre_mim', "VARCHAR(1000) NULL"],
      ['whatsapp', "VARCHAR(30) NULL"],
      ['capa', "VARCHAR(255) NULL"],
      ['idiomas', "VARCHAR(255) NULL"],
      ['linkedin', "VARCHAR(255) NULL"],
      ['instagram', "VARCHAR(255) NULL"],
      ['facebook', "VARCHAR(255) NULL"],
      ['site_pessoal', "VARCHAR(255) NULL"],
      ['ultima_atividade', "TIMESTAMP NULL DEFAULT NULL"],
      ['email_verificado', "TINYINT(1) NOT NULL DEFAULT 0"],
      ['telefone_verificado', "TINYINT(1) NOT NULL DEFAULT 0"],
      ['verificado_plataforma', "TINYINT(1) NOT NULL DEFAULT 0"],
      ['tipo_cliente', "ENUM('pessoa','empresa') NULL DEFAULT NULL"],
      ['nome_empresa', "VARCHAR(120) NULL"],
      ['setor', "VARCHAR(80) NULL"],
      ['tamanho_equipa', "VARCHAR(30) NULL"],
    ];
    const colsUsers = await colunasExistentes(c, 'users');
    for (const [nome, def] of novosUsers) {
      if (!colsUsers.has(nome)) {
        await c.query(`ALTER TABLE users ADD COLUMN ${nome} ${def}`);
        console.log(`[MIGRATE] users + ${nome}`);
      }
    }

    /* ---------- profiles: novas colunas ---------- */
    const novosProfiles = [
      ['categoria_id', "INT UNSIGNED NULL"],
      ['nivel', "ENUM('iniciante','intermedio','especialista') NOT NULL DEFAULT 'iniciante'"],
      ['anos_experiencia', "TINYINT UNSIGNED NOT NULL DEFAULT 0"],
      ['educacao', "JSON NULL"],
      ['experiencia_prof', "JSON NULL"],
      ['certificacoes', "JSON NULL"],
      ['metodos_recebimento', "JSON NULL"],
    ];
    const colsProfiles = await colunasExistentes(c, 'profiles');
    for (const [nome, def] of novosProfiles) {
      if (!colsProfiles.has(nome)) {
        await c.query(`ALTER TABLE profiles ADD COLUMN ${nome} ${def}`);
        console.log(`[MIGRATE] profiles + ${nome}`);
      }
    }
    // FK de categoria principal (só se não existir)
    const [fks] = await c.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'profiles'
         AND CONSTRAINT_TYPE = 'FOREIGN KEY'`
    );
    const temFkCat = fks.some((f) => f.CONSTRAINT_NAME === 'fk_profiles_categoria');
    if (!temFkCat) {
      await c.query(
        `ALTER TABLE profiles ADD CONSTRAINT fk_profiles_categoria
         FOREIGN KEY (categoria_id) REFERENCES categories(id) ON DELETE SET NULL`
      );
      console.log('[MIGRATE] profiles + FK categoria_id');
    }

    /* ---------- Portfólio ---------- */
    await c.query(`
      CREATE TABLE IF NOT EXISTS portfolio_items (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        titulo VARCHAR(150) NOT NULL,
        descricao TEXT,
        link VARCHAR(255),
        ordem INT UNSIGNED DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_portfolio_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await c.query(`
      CREATE TABLE IF NOT EXISTS portfolio_images (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        item_id INT UNSIGNED NOT NULL,
        url VARCHAR(255) NOT NULL,
        ordem INT UNSIGNED DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES portfolio_items(id) ON DELETE CASCADE,
        INDEX idx_portfolio_images_item (item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[MIGRATE] Tabelas de portfólio garantidas');

    /* ---------- Backfill: nome_utilizador único ---------- */
    const [semUsername] = await c.query('SELECT id, nome FROM users WHERE nome_utilizador IS NULL OR nome_utilizador = \'\'');
    for (const u of semUsername) {
      let base = slug(u.nome);
      let final = base;
      let n = 1;
      // garantir unicidade
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const [dup] = await c.query('SELECT id FROM users WHERE nome_utilizador = ? AND id != ?', [final, u.id]);
        if (!dup.length) break;
        n += 1;
        final = `${base}${n}`;
      }
      await c.query('UPDATE users SET nome_utilizador = ? WHERE id = ?', [final, u.id]);
    }
    if (semUsername.length) console.log(`[MIGRATE] ${semUsername.length} nome_utilizador preenchidos`);

    const idxUsers = await indexesExistentes(c, 'users');
    if (!idxUsers.has('uk_users_nome_utilizador')) {
      await c.query('ALTER TABLE users ADD UNIQUE KEY uk_users_nome_utilizador (nome_utilizador)');
      console.log('[MIGRATE] users + unique(nome_utilizador)');
    }

    /* ---------- Diretório de uploads ---------- */
    paths.garantirPastas();
    console.log('[MIGRATE] Pastas de uploads garantidas em:', paths.UPLOADS_DIR);

    /* ============================================================
       FASE A — Pagamentos fictícios com escrow (idempotente)
       Dinheiro sempre em CENTAVOS (BIGINT). Livro-razão (transactions)
       é append-only: nunca UPDATE/DELETE, apenas INSERT.
       ============================================================ */

    /* ---------- settings (comissão etc., editável no admin) ---------- */
    await c.query(`
      CREATE TABLE IF NOT EXISTS settings (
        chave VARCHAR(60) PRIMARY KEY,
        valor VARCHAR(255) NOT NULL,
        descricao VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await c.query(`
      INSERT IGNORE INTO settings (chave, valor, descricao) VALUES
        ('comissao_percentual', '10', 'Comissão da plataforma em % sobre o valor do projeto'),
        ('max_revisoes', '3', 'Número máximo de revisões por projeto'),
        ('dias_liberacao_automatica', '7', 'Dias após a entrega sem resposta do cliente (apenas lembrete — o admin decide)')
    `);

    /* ---------- wallets (carteira por utilizador) ---------- */
    await c.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        balance BIGINT NOT NULL DEFAULT 0,
        currency VARCHAR(8) NOT NULL DEFAULT 'MZN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_wallets_user (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // garantir carteira a todos os utilizadores existentes
    await c.query(`
      INSERT INTO wallets (user_id)
      SELECT u.id FROM users u
      WHERE u.id NOT IN (SELECT user_id FROM wallets)
    `);

    /* ---------- transactions (livro-razão — só INSERT) ---------- */
    await c.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tipo ENUM('RECARGA_FICTICIA','PAGAMENTO_PROJETO','LIBERACAO_ESCROW','COMISSAO',
                   'REEMBOLSO','AJUSTE_VALOR','SAQUE','SAQUE_RECUSADO') NOT NULL,
        valor BIGINT NOT NULL,
        wallet_origem_id INT UNSIGNED NULL,
        wallet_destino_id INT UNSIGNED NULL,
        project_id INT UNSIGNED NULL,
        status ENUM('CONCLUIDA','FALHADA') NOT NULL DEFAULT 'CONCLUIDA',
        reference VARCHAR(80) NOT NULL,
        descricao VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_transactions_reference (reference),
        INDEX idx_transactions_project (project_id),
        INDEX idx_transactions_origem (wallet_origem_id),
        INDEX idx_transactions_destino (wallet_destino_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    /* ---------- escrow (retenção por projeto) ---------- */
    await c.query(`
      CREATE TABLE IF NOT EXISTS escrow (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        project_id INT UNSIGNED NOT NULL,
        amount_held BIGINT NOT NULL DEFAULT 0,
        platform_fee BIGINT NOT NULL DEFAULT 0,
        status ENUM('AGUARDANDO_PAGAMENTO','RETIDO','LIBERADO','REEMBOLSADO','EM_DISPUTA')
          NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
        paid_at TIMESTAMP NULL,
        released_at TIMESTAMP NULL,
        refunded_at TIMESTAMP NULL,
        dispute_reason TEXT,
        dispute_decision VARCHAR(40),
        dispute_percent_freelancer TINYINT UNSIGNED,
        dispute_decided_by INT UNSIGNED,
        dispute_decided_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_escrow_project (project_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        INDEX idx_escrow_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    /* ---------- deliveries + delivery_files ---------- */
    await c.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        project_id INT UNSIGNED NOT NULL,
        freelancer_id INT UNSIGNED NOT NULL,
        numero INT UNSIGNED NOT NULL DEFAULT 1,
        mensagem TEXT,
        links JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        INDEX idx_deliveries_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await c.query(`
      CREATE TABLE IF NOT EXISTS delivery_files (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        delivery_id INT UNSIGNED NOT NULL,
        url VARCHAR(255) NOT NULL,
        nome_original VARCHAR(255) NOT NULL,
        tipo VARCHAR(40) NOT NULL,
        tamanho INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
        INDEX idx_delivery_files_delivery (delivery_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    /* ---------- withdrawals (saques fictícios) ---------- */
    await c.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        valor BIGINT NOT NULL,
        metodo ENUM('MPESA','EMOLA','BANCO') NOT NULL,
        destino VARCHAR(120) NOT NULL,
        status ENUM('PENDENTE','CONCLUIDO','RECUSADO') NOT NULL DEFAULT 'PENDENTE',
        processed_by INT UNSIGNED,
        processed_at TIMESTAMP NULL,
        motivo_recusa VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_withdrawals_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    /* ---------- value_adjustments (proposta de ajuste de valor) ---------- */
    await c.query(`
      CREATE TABLE IF NOT EXISTS value_adjustments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        project_id INT UNSIGNED NOT NULL,
        autor_id INT UNSIGNED NOT NULL,
        valor_antigo BIGINT NOT NULL,
        valor_novo BIGINT NOT NULL,
        motivo VARCHAR(500),
        status ENUM('PENDENTE','ACEITE','RECUSADO') NOT NULL DEFAULT 'PENDENTE',
        responded_by INT UNSIGNED,
        responded_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        INDEX idx_adjustments_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    /* ---------- cancel_requests (cancelamento de comum acordo) ---------- */
    await c.query(`
      CREATE TABLE IF NOT EXISTS cancel_requests (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        project_id INT UNSIGNED NOT NULL,
        autor_id INT UNSIGNED NOT NULL,
        motivo VARCHAR(500) NOT NULL,
        status ENUM('PENDENTE','ACEITE','RECUSADO') NOT NULL DEFAULT 'PENDENTE',
        responded_by INT UNSIGNED,
        responded_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        INDEX idx_cancel_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    /* ---------- projects: novos estados + aprovações dos dois lados ---------- */
    const [colStatus] = await c.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'status'`
    );
    const tipoStatus = (colStatus[0] && colStatus[0].COLUMN_TYPE) || '';
    if (!tipoStatus.includes('AGUARDANDO_PAGAMENTO')) {
      await c.query(`
        ALTER TABLE projects MODIFY COLUMN status
        ENUM('PENDENTE','AGUARDANDO_PAGAMENTO','EM_ANDAMENTO','ENTREGUE','CONCLUIDO','CANCELADO','EM_DISPUTA')
        NULL DEFAULT 'PENDENTE'
      `);
      console.log('[MIGRATE] projects.status + AGUARDANDO_PAGAMENTO/EM_DISPUTA');
    }
    const novosProjects = [
      ['client_approved', "TINYINT(1) NOT NULL DEFAULT 0"],
      ['client_approved_at', "TIMESTAMP NULL DEFAULT NULL"],
      ['freelancer_approved', "TINYINT(1) NOT NULL DEFAULT 0"],
      ['freelancer_approved_at', "TIMESTAMP NULL DEFAULT NULL"],
      ['revisions_count', "INT UNSIGNED NOT NULL DEFAULT 0"],
      ['last_delivery_at', "TIMESTAMP NULL DEFAULT NULL"],
    ];
    const colsProjects = await colunasExistentes(c, 'projects');
    for (const [nome, def] of novosProjects) {
      if (!colsProjects.has(nome)) {
        await c.query(`ALTER TABLE projects ADD COLUMN ${nome} ${def}`);
        console.log(`[MIGRATE] projects + ${nome}`);
      }
    }

    /* ---------- messages: tipo especial + extra (JSON) ---------- */
    const colsMsgs = await colunasExistentes(c, 'messages');
    if (!colsMsgs.has('tipo')) {
      await c.query(`
        ALTER TABLE messages ADD COLUMN tipo
        ENUM('TEXTO','SISTEMA','ENTREGA','AJUSTE') NOT NULL DEFAULT 'TEXTO'
      `);
      console.log('[MIGRATE] messages + tipo');
    }
    if (!colsMsgs.has('extra')) {
      await c.query(`ALTER TABLE messages ADD COLUMN extra JSON NULL`);
      console.log('[MIGRATE] messages + extra');
    }

    /* ---------- pasta privada de entregas (não servida por /uploads) ---------- */
    console.log('[MIGRATE] Entregas privadas em:', paths.DELIVERIES_DIR);

    console.log('[MIGRATE] FASE A: wallets/transactions/escrow/deliveries/withdrawals/ajustes garantidos');

    console.log('[MIGRATE] Concluído — nada foi apagado.');
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error('[MIGRATE] Erro:', err);
  process.exit(1);
});
