/* ============================================================
   FreelaMZ — Serviço financeiro (escrow, livro-razão, carteiras)
   ------------------------------------------------------------
   REGRAS INVARIÁVEIS:
   1. Todo o dinheiro é movimentado DENTRO de transações SQL
      (BEGIN/COMMIT + ROLLBACK) com SELECT ... FOR UPDATE nas
      linhas de projects/escrow/wallets.
   2. Valores em CENTAVOS (inteiros BIGINT) — nunca float.
   3. O livro-razão (tabela transactions) é append-only: só INSERT.
   4. Cada operação tem reference ÚNICA → idempotência e proteção
      contra dupla liberação/reembolso/pagamento.
   5. O escrow só sai de RETIDO com a aprovação dos DOIS lados
      (ou decisão do admin numa disputa). Nunca automático.
   ============================================================ */
const db = require('../config/db');
const crypto = require('crypto');
const { getProvider } = require('./payments');
const Message = require('../models/Message');
const Notification = require('../models/Notification');

/* ---------- Erro de negócio com status HTTP ---------- */
class ErroFinanceiro extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

/* ---------- Conversões (DECIMAL MT ↔ centavos) ---------- */
function paraCentavos(mt) {
  return Math.round(Number(mt || 0) * 100);
}
function paraMT(centavos) {
  return (Number(centavos || 0) / 100).toFixed(2);
}
function formatarMT(centavos) {
  return `${paraMT(centavos)} MT`;
}

/* ---------- Referências únicas (idempotência) ---------- */
function ref(prefixo) {
  return `${prefixo}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
}

/* ---------- Executar dentro de transação SQL ---------- */
async function transacao(fn) {
  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (e) {
    await conn.rollback().catch(() => {});
    if (e && e.code === 'ER_DUP_ENTRY') {
      throw new ErroFinanceiro(409, 'Operação já executada anteriormente (registo duplicado bloqueado)');
    }
    throw e;
  } finally {
    conn.release();
  }
}

/* ---------- Settings ---------- */
async function getSetting(nome, padrao) {
  const [rows] = await db.query('SELECT valor FROM settings WHERE chave = ?', [nome]);
  return rows.length ? rows[0].valor : padrao;
}
async function setSetting(nome, valor) {
  await db.query(
    'INSERT INTO settings (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
    [nome, String(valor)]
  );
}
async function comissaoPercentual(conn = db) {
  const [rows] = await conn.query('SELECT valor FROM settings WHERE chave = ?', ['comissao_percentual']);
  const pct = parseFloat(rows.length ? rows[0].valor : '10');
  return Number.isFinite(pct) ? pct : 10;
}

/* ---------- Carteiras ---------- */
async function walletDe(conn, userId, { forUpdate = false } = {}) {
  let sql = 'SELECT * FROM wallets WHERE user_id = ?';
  if (forUpdate) sql += ' FOR UPDATE';
  let [rows] = await conn.query(sql, [userId]);
  if (!rows.length) {
    await conn.query('INSERT INTO wallets (user_id) VALUES (?)', [userId]);
    [rows] = await conn.query('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [userId]);
  }
  return rows[0];
}

/* Saldo "a receber" do freelancer: escrow RETIDO (líquido de comissão) */
async function aReceber(conn, freelancerId) {
  const c = conn || db;
  const [rows] = await c.query(`
    SELECT COALESCE(SUM(amount_held - platform_fee), 0) as total
    FROM escrow e JOIN projects p ON p.id = e.project_id
    WHERE p.freelancer_id = ? AND e.status = 'RETIDO'
  `, [freelancerId]);
  return Number(rows[0].total);
}

/* Saldo "em escrow" do cliente: escrow RETIDO */
async function emEscrow(conn, clienteId) {
  const c = conn || db;
  const [rows] = await c.query(`
    SELECT COALESCE(SUM(amount_held), 0) as total
    FROM escrow e JOIN projects p ON p.id = e.project_id
    WHERE p.cliente_id = ? AND e.status IN ('RETIDO','EM_DISPUTA')
  `, [clienteId]);
  return Number(rows[0].total);
}

/* ---------- Livro-razão (só INSERT) ---------- */
async function registrar(conn, { tipo, valor, origem = null, destino = null, projectId = null, reference, descricao = null }) {
  if (!reference) throw new ErroFinanceiro(500, 'Livro-razão exige reference única');
  await conn.query(
    `INSERT INTO transactions (tipo, valor, wallet_origem_id, wallet_destino_id, project_id, status, reference, descricao)
     VALUES (?, ?, ?, ?, ?, 'CONCLUIDA', ?, ?)`,
    [tipo, valor, origem, destino, projectId, reference, descricao]
  );
}

/* ---------- Notificações + mensagens de sistema ---------- */
async function notify(userId, tipo, titulo, mensagem) {
  try { await Notification.create(userId, tipo, titulo, mensagem); } catch (e) { /* não bloqueia */ }
}

async function msgSistema({ de, para, projectId, texto, tipo = 'SISTEMA', extra = null }) {
  try {
    return await Message.send({
      remetente_id: de, destinatario_id: para, projeto_id: projectId,
      texto, tipo, extra,
    });
  } catch (e) {
    console.error('[FINANCE] Erro ao criar mensagem de sistema:', e.message);
    return null;
  }
}

/* ============================================================
   A2) PAGAR PROJETO (cliente) — cria escrow RETIDO
   ============================================================ */
async function pagarProjeto({ userId, projectId, metodo, numero, pin, simularFalha = false }) {
  const provider = getProvider();
  if (!['SALDO', 'MPESA', 'EMOLA', 'CARTAO'].includes(metodo)) {
    throw new ErroFinanceiro(400, 'Método de pagamento inválido');
  }
  if (metodo !== 'SALDO' && !numero) {
    throw new ErroFinanceiro(400, 'Indique o número do seu M-Pesa/e-Mola ou os dados do cartão');
  }

  /* Cobrança externa ANTES da transação (M-Pesa/e-Mola/Cartão simulados).
     Validamos o projeto primeiro para cobrar o valor certo — a transação
     abaixo volta a validar tudo com FOR UPDATE. */
  let charge = null;
  if (metodo !== 'SALDO') {
    const [[projPre]] = await db.query(
      'SELECT cliente_id, status, valor FROM projects WHERE id = ?', [projectId]
    );
    if (!projPre) throw new ErroFinanceiro(404, 'Projeto não encontrado');
    if (projPre.cliente_id !== userId) throw new ErroFinanceiro(403, 'Apenas o cliente do projeto pode pagar');
    if (projPre.status === 'PENDENTE') {
      throw new ErroFinanceiro(400, 'Aceite primeiro uma proposta — depois o projeto aguarda o seu pagamento');
    }
    if (projPre.status !== 'AGUARDANDO_PAGAMENTO') {
      throw new ErroFinanceiro(409, 'Este projeto já foi pago');
    }
    const valorPre = paraCentavos(projPre.valor);
    if (valorPre <= 0) throw new ErroFinanceiro(400, 'Valor do projeto inválido');
    charge = await provider.charge({
      amount: valorPre, currency: 'MZN', method: metodo, userId,
      meta: { numero, pin, simularFalha },
    });
    if (!charge.ok) {
      throw new ErroFinanceiro(402, charge.erro || 'Pagamento recusado');
    }
  }

  const resultado = await transacao(async (conn) => {
    const [[proj]] = await conn.query('SELECT * FROM projects WHERE id = ? FOR UPDATE', [projectId]);
    if (!proj) throw new ErroFinanceiro(404, 'Projeto não encontrado');
    if (proj.cliente_id !== userId) throw new ErroFinanceiro(403, 'Apenas o cliente do projeto pode pagar');
    if (proj.status === 'PENDENTE') {
      throw new ErroFinanceiro(400, 'Aceite primeiro uma proposta — depois o projeto aguarda o seu pagamento');
    }
    if (proj.status !== 'AGUARDANDO_PAGAMENTO') {
      throw new ErroFinanceiro(409, 'Este projeto já foi pago');
    }

    const [[esc]] = await conn.query('SELECT * FROM escrow WHERE project_id = ? FOR UPDATE', [projectId]);
    if (esc && esc.status !== 'AGUARDANDO_PAGAMENTO') {
      throw new ErroFinanceiro(409, 'Este projeto já foi pago');
    }

    const valor = paraCentavos(proj.valor);
    if (valor <= 0) throw new ErroFinanceiro(400, 'Valor do projeto inválido');
    const pct = await comissaoPercentual(conn);
    const fee = Math.round((valor * pct) / 100);

    let walletId = null;
    if (metodo === 'SALDO') {
      const wallet = await walletDe(conn, userId, { forUpdate: true });
      if (Number(wallet.balance) < valor) {
        throw new ErroFinanceiro(400, 'Saldo insuficiente — adicione saldo (fictício) à sua carteira ou pague com M-Pesa/e-Mola');
      }
      await conn.query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [valor, wallet.id]);
      walletId = wallet.id;
      await registrar(conn, {
        tipo: 'PAGAMENTO_PROJETO', valor, origem: wallet.id, projectId,
        reference: `PAY-${projectId}`,
        descricao: `Cliente pagou o projeto #${projectId} com saldo da carteira`,
      });
    } else {
      await registrar(conn, {
        tipo: 'PAGAMENTO_PROJETO', valor, projectId,
        reference: `PAY-${projectId}`,
        descricao: `Cliente pagou o projeto #${projectId} via ${metodo} (provedor: ${charge ? charge.provider : provider.name})`,
      });
    }

    if (esc) {
      await conn.query(
        `UPDATE escrow SET amount_held = ?, platform_fee = ?, status = 'RETIDO', paid_at = NOW() WHERE id = ?`,
        [valor, fee, esc.id]
      );
    } else {
      await conn.query(
        `INSERT INTO escrow (project_id, amount_held, platform_fee, status, paid_at) VALUES (?, ?, ?, 'RETIDO', NOW())`,
        [projectId, valor, fee]
      );
    }

    await conn.query(
      `UPDATE projects SET status = 'EM_ANDAMENTO', data_inicio = NOW(), updated_at = NOW() WHERE id = ?`,
      [projectId]
    );

    return { projeto: proj, valor, fee, walletId, charge, freelancerId: proj.freelancer_id, clienteId: proj.cliente_id };
  });

  /* Pós-commit: mensagem de sistema no chat + notificações */
  await msgSistema({
    de: resultado.clienteId, para: resultado.freelancerId, projectId,
    texto: `💳 Pagamento de ${formatarMT(resultado.valor)} recebido e RETIDO com segurança pela plataforma. `
      + `Freelancer, pode começar o trabalho! (Comissão da plataforma: ${formatarMT(resultado.fee)})`,
  });
  await notify(resultado.freelancerId, 'pagamento_recebido', 'Pagamento retido 🔒',
    `O cliente pagou o projeto #${projectId}. O valor de ${formatarMT(resultado.valor)} está retido e será liberado quando ambos aprovarem.`);
  await notify(resultado.clienteId, 'pagamento_efetuado', 'Pagamento efetuado ✅',
    `Pagaste ${formatarMT(resultado.valor)} pelo projeto #${projectId}. O valor está retido até aprovares a entrega.`);

  return {
    project: { id: projectId, status: 'EM_ANDAMENTO' },
    escrow: { project_id: projectId, amount_held: resultado.valor, platform_fee: resultado.fee, status: 'RETIDO' },
    valor: resultado.valor, fee: resultado.fee, charge: charge ? { provider: charge.provider, reference: charge.reference } : { provider: 'carteira' },
  };
}

/* ============================================================
   A3) ENTREGA (freelancer) — só com escrow RETIDO
   ============================================================ */
async function criarEntrega({ projectId, freelancerId, mensagem, links, arquivos }) {
  /* arquivos: [{ url, nome_original, tipo, tamanho }] já validados e guardados */
  const r = await transacao(async (conn) => {
    const [[proj]] = await conn.query('SELECT * FROM projects WHERE id = ? FOR UPDATE', [projectId]);
    if (!proj) throw new ErroFinanceiro(404, 'Projeto não encontrado');
    if (proj.freelancer_id !== freelancerId) {
      throw new ErroFinanceiro(403, 'Apenas o freelancer do projeto pode entregar');
    }
    const [[esc]] = await conn.query('SELECT * FROM escrow WHERE project_id = ? FOR UPDATE', [projectId]);
    if (!esc || esc.status !== 'RETIDO') {
      throw new ErroFinanceiro(403, 'Não é possível entregar: o pagamento ainda não foi retido (ou está em disputa)');
    }
    if (!['EM_ANDAMENTO', 'ENTREGUE'].includes(proj.status)) {
      throw new ErroFinanceiro(400, `O projeto está em estado "${proj.status}" — entrega não permitida agora`);
    }

    const [[{ total }]] = await conn.query(
      'SELECT COUNT(*) as total FROM deliveries WHERE project_id = ?', [projectId]
    );
    const numero = Number(total) + 1;

    const [delRes] = await conn.query(
      `INSERT INTO deliveries (project_id, freelancer_id, numero, mensagem, links) VALUES (?, ?, ?, ?, ?)`,
      [projectId, freelancerId, numero, mensagem || null, JSON.stringify(links || [])]
    );
    const arquivosMeta = [];
    for (const a of arquivos || []) {
      await conn.query(
        `INSERT INTO delivery_files (delivery_id, url, nome_original, tipo, tamanho) VALUES (?, ?, ?, ?, ?)`,
        [delRes.insertId, a.url, a.nome_original, a.tipo, a.tamanho]
      );
      arquivosMeta.push({ id: null, nome: a.nome_original, tipo: a.tipo, tamanho: a.tamanho, url: a.url });
    }

    await conn.query(
      `UPDATE projects SET status = 'ENTREGUE', last_delivery_at = NOW(), client_approved = 0, updated_at = NOW() WHERE id = ?`,
      [projectId]
    );

    return { numero, deliveryId: delRes.insertId, clienteId: proj.cliente_id, valor: Number(esc.amount_held), arquivos: arquivosMeta, links: links || [] };
  });

  await msgSistema({
    de: freelancerId, para: r.clienteId, projectId, tipo: 'ENTREGA',
    texto: mensagem || 'Entrega enviada.',
    extra: { delivery_id: r.deliveryId, numero: r.numero, arquivos: r.arquivos, links: r.links },
  });
  await notify(r.clienteId, 'entrega_enviada', `Entrega #${r.numero} recebida 📦`,
    `O freelancer enviou a entrega #${r.numero}. Veja no chat do projeto e aprove, peça revisão ou abra uma disputa.`);

  return { delivery: { id: r.deliveryId, numero: r.numero, arquivos: r.arquivos, links: r.links }, project: { id: projectId, status: 'ENTREGUE' } };
}

/* ============================================================
   A4) RESPOSTA DO CLIENTE: aprovar / revisão / disputa
   ============================================================ */
async function aprovarEntrega({ projectId, userId }) {
  const r = await transacao(async (conn) => {
    const [[proj]] = await conn.query('SELECT * FROM projects WHERE id = ? FOR UPDATE', [projectId]);
    if (!proj) throw new ErroFinanceiro(404, 'Projeto não encontrado');
    if (proj.cliente_id !== userId) throw new ErroFinanceiro(403, 'Apenas o cliente do projeto pode aprovar a entrega');
    if (proj.status === 'CONCLUIDO') throw new ErroFinanceiro(409, 'Projeto já concluído');

    const [[esc]] = await conn.query('SELECT * FROM escrow WHERE project_id = ? FOR UPDATE', [projectId]);
    if (esc && esc.status === 'EM_DISPUTA') throw new ErroFinanceiro(409, 'Projeto em disputa — aguarde a decisão do administrador');
    if (proj.status !== 'ENTREGUE') throw new ErroFinanceiro(400, 'Ainda não há entrega para aprovar');

    await conn.query(
      `UPDATE projects SET client_approved = 1, client_approved_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [projectId]
    );

    /* Liberação só quando AMBOS aprovarem — feita dentro da mesma transação */
    let liberado = false;
    if (esc && esc.status === 'RETIDO' && proj.freelancer_approved) {
      liberado = await liberarDentroDaTx(conn, { proj, esc, sufixo: 'CLI' });
    }
    return { clienteId: proj.cliente_id, freelancerId: proj.freelancer_id, liberado, valor: esc ? Number(esc.amount_held) : 0 };
  });

  await msgSistema({
    de: r.clienteId, para: r.freelancerId, projectId,
    texto: r.liberado
      ? '✅ O cliente aprovou a entrega — com a confirmação do freelancer, o pagamento foi LIBERADO!'
      : '✅ O cliente aprovou a entrega. Falta o freelancer confirmar a conclusão e o valor para liberar o pagamento.',
  });
  await notify(r.freelancerId, 'entrega_aprovada', 'Entrega aprovada ✅',
    r.liberado ? 'A entrega foi aprovada e o valor já foi liberado para a sua carteira.'
      : 'O cliente aprovou a entrega. Confirme a conclusão e o valor para receber.');
  return { aprovado: true, liberado: r.liberado };
}

async function pedirRevisao({ projectId, userId, motivo }) {
  if (!motivo || !String(motivo).trim()) {
    throw new ErroFinanceiro(400, 'Escreva o motivo da revisão (é obrigatório)');
  }
  const maxRev = parseInt(await getSetting('max_revisoes', '3'), 10) || 3;

  const r = await transacao(async (conn) => {
    const [[proj]] = await conn.query('SELECT * FROM projects WHERE id = ? FOR UPDATE', [projectId]);
    if (!proj) throw new ErroFinanceiro(404, 'Projeto não encontrado');
    if (proj.cliente_id !== userId) throw new ErroFinanceiro(403, 'Apenas o cliente do projeto pode pedir revisão');
    if (proj.status !== 'ENTREGUE') throw new ErroFinanceiro(400, 'Só pode pedir revisão com uma entrega à espera de resposta');
    if (Number(proj.revisions_count) >= maxRev) {
      throw new ErroFinanceiro(403, `Limite de ${maxRev} revisões atingido — aprove a entrega ou abra uma disputa`);
    }

    await conn.query(
      `UPDATE projects SET status = 'EM_ANDAMENTO', revisions_count = revisions_count + 1,
        client_approved = 0, client_approved_at = NULL, updated_at = NOW() WHERE id = ?`,
      [projectId]
    );
    return { clienteId: proj.cliente_id, freelancerId: proj.freelancer_id, revisoes: Number(proj.revisions_count) + 1, maxRev };
  });

  await msgSistema({
    de: r.clienteId, para: r.freelancerId, projectId,
    texto: `🔁 O cliente pediu revisão (revisão ${r.revisoes}/${r.maxRev}): "${String(motivo).trim()}"`,
  });
  await notify(r.freelancerId, 'revisao_pedida', 'Revisão pedida 🔁',
    `O cliente pediu uma revisão: ${String(motivo).trim()}`);
  return { status: 'EM_ANDAMENTO', revisoes: r.revisoes };
}

async function abrirDisputa({ projectId, userId, motivo }) {
  if (!motivo || !String(motivo).trim()) {
    throw new ErroFinanceiro(400, 'Explique o motivo da disputa (é obrigatório)');
  }
  const r = await transacao(async (conn) => {
    const [[proj]] = await conn.query('SELECT * FROM projects WHERE id = ? FOR UPDATE', [projectId]);
    if (!proj) throw new ErroFinanceiro(404, 'Projeto não encontrado');
    const souCliente = proj.cliente_id === userId;
    const souFreelancer = proj.freelancer_id === userId;
    if (!souCliente && !souFreelancer) throw new ErroFinanceiro(403, 'Apenas participantes do projeto podem abrir disputa');

    const [[esc]] = await conn.query('SELECT * FROM escrow WHERE project_id = ? FOR UPDATE', [projectId]);
    if (!esc || esc.status !== 'RETIDO') {
      throw new ErroFinanceiro(409, 'Não há valor retido para disputar');
    }

    await conn.query(
      `UPDATE escrow SET status = 'EM_DISPUTA', dispute_reason = ?, updated_at = NOW() WHERE id = ?`,
      [String(motivo).trim(), esc.id]
    );
    await conn.query(`UPDATE projects SET status = 'EM_DISPUTA', updated_at = NOW() WHERE id = ?`, [projectId]);

    const outro = souCliente ? proj.freelancer_id : proj.cliente_id;
    return { clienteId: proj.cliente_id, freelancerId: proj.freelancer_id, autor: userId, outro };
  });

  await msgSistema({
    de: userId, para: r.outro, projectId,
    texto: `⚖️ Disputa aberta por ${userId === r.clienteId ? 'o cliente' : 'o freelancer'}: "${String(motivo).trim()}". `
      + 'O valor retido fica bloqueado até a decisão do administrador.',
  });
  await notify(r.clienteId, 'disputa_aberta', 'Disputa aberta ⚖️',
    `Disputa no projeto #${projectId}: ${String(motivo).trim()}`);
  await notify(r.freelancerId, 'disputa_aberta', 'Disputa aberta ⚖️',
    `Disputa no projeto #${projectId}: ${String(motivo).trim()}`);
  return { escrow: 'EM_DISPUTA', project: 'EM_DISPUTA' };
}

/* ============================================================
   A5) CONFIRMAÇÃO DO FREELANCER + LIBERAÇÃO (os dois lados)
   ============================================================ */
async function confirmarConclusao({ projectId, userId }) {
  const r = await transacao(async (conn) => {
    const [[proj]] = await conn.query('SELECT * FROM projects WHERE id = ? FOR UPDATE', [projectId]);
    if (!proj) throw new ErroFinanceiro(404, 'Projeto não encontrado');
    if (proj.freelancer_id !== userId) throw new ErroFinanceiro(403, 'Apenas o freelancer do projeto pode confirmar a conclusão');
    if (proj.status === 'CONCLUIDO') throw new ErroFinanceiro(409, 'Projeto já concluído e pago');

    const [[esc]] = await conn.query('SELECT * FROM escrow WHERE project_id = ? FOR UPDATE', [projectId]);
    if (!esc) throw new ErroFinanceiro(409, 'Projeto sem pagamento retido');
    if (esc.status === 'EM_DISPUTA') throw new ErroFinanceiro(409, 'Projeto em disputa — o administrador decide');
    if (esc.status === 'LIBERADO') throw new ErroFinanceiro(409, 'O pagamento já foi liberado — não é possível liberar duas vezes');
    if (esc.status === 'REEMBOLSADO') throw new ErroFinanceiro(409, 'O valor já foi reembolsado ao cliente');
    if (proj.status !== 'ENTREGUE') throw new ErroFinanceiro(400, 'Só pode confirmar depois de entregar e o cliente responder');

    await conn.query(
      `UPDATE projects SET freelancer_approved = 1, freelancer_approved_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [projectId]
    );

    /* Liberação exige a aprovação dos DOIS lados */
    let liberado = false;
    if (esc.status === 'RETIDO' && proj.client_approved) {
      liberado = await liberarDentroDaTx(conn, { proj, esc, sufixo: 'FRE' });
    }
    return { clienteId: proj.cliente_id, freelancerId: proj.freelancer_id, liberado, valor: Number(esc.amount_held), fee: Number(esc.platform_fee) };
  });

  await msgSistema({
    de: r.freelancerId, para: r.clienteId, projectId,
    texto: r.liberado
      ? '✅ O freelancer confirmou a conclusão e o valor — pagamento LIBERADO com a aprovação dos dois lados!'
      : '👍 O freelancer confirmou que o projeto e o valor combinado estão corretos. Falta a aprovação do cliente para liberar.',
  });
  await notify(r.clienteId, 'conclusao_confirmada', 'Freelancer confirmou a conclusão 👍',
    r.liberado ? 'Projeto concluído e pagamento liberado.' : 'Falta a sua aprovação da entrega para liberar o pagamento.');
  return { confirmado: true, liberado: r.liberado };
}

/* Libera o escrow DENTRO de uma transação já aberta.
   Retorna true se liberou. Chaves de referência únicas por projeto+sufixo
   + status do escrow verificado com FOR UPDATE = proteção contra dupla liberação. */
async function liberarDentroDaTx(conn, { proj, esc, sufixo, brutoFreelancer = null, decisaoDisputa = null }) {
  const bruto = brutoFreelancer !== null ? brutoFreelancer : Number(esc.amount_held);
  const pct = await comissaoPercentual(conn);
  const fee = Math.round((bruto * pct) / 100);
  const liquido = bruto - fee;
  const reembolsoCliente = Number(esc.amount_held) - bruto;

  if (liquido > 0) {
    const wf = await walletDe(conn, proj.freelancer_id, { forUpdate: true });
    await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [liquido, wf.id]);
    await registrar(conn, {
      tipo: 'LIBERACAO_ESCROW', valor: liquido, destino: wf.id, projectId: proj.id,
      reference: `REL-${proj.id}-${sufixo}`,
      descricao: `Escrow liberado ao freelancer (projeto #${proj.id})${decisaoDisputa ? ` — decisão admin: ${decisaoDisputa}` : ''}`,
    });
    if (fee > 0) {
      await registrar(conn, {
        tipo: 'COMISSAO', valor: fee, projectId: proj.id,
        reference: `COM-${proj.id}-${sufixo}`,
        descricao: `Comissão da plataforma (${pct}%) sobre projeto #${proj.id}`,
      });
    }
  }
  if (reembolsoCliente > 0) {
    const wc = await walletDe(conn, proj.cliente_id, { forUpdate: true });
    await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [reembolsoCliente, wc.id]);
    await registrar(conn, {
      tipo: 'REEMBOLSO', valor: reembolsoCliente, destino: wc.id, projectId: proj.id,
      reference: `RFB-${proj.id}-${sufixo}`,
      descricao: `Parte do escrow devolvida ao cliente (projeto #${proj.id})${decisaoDisputa ? ` — decisão admin: ${decisaoDisputa}` : ''}`,
    });
  }

  await conn.query(
    `UPDATE escrow SET status = ?, released_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [reembolsoCliente >= Number(esc.amount_held) ? 'REEMBOLSADO' : 'LIBERADO', esc.id]
  );
  await conn.query(
    `UPDATE projects SET status = 'CONCLUIDO', concluido_em = NOW(), updated_at = NOW() WHERE id = ?`,
    [proj.id]
  );
  return true;
}

/* ============================================================
   Ajuste de valor (o valor fica TRAVADO após o pagamento)
   ============================================================ */
async function proporAjuste({ projectId, autorId, valorNovo, motivo }) {
  const valorNovoC = paraCentavos(valorNovo);
  if (!valorNovoC || valorNovoC <= 0) throw new ErroFinanceiro(400, 'Novo valor inválido');

  const r = await transacao(async (conn) => {
    const [[proj]] = await conn.query('SELECT * FROM projects WHERE id = ? FOR UPDATE', [projectId]);
    if (!proj) throw new ErroFinanceiro(404, 'Projeto não encontrado');
    if (proj.cliente_id !== autorId && proj.freelancer_id !== autorId) {
      throw new ErroFinanceiro(403, 'Apenas participantes do projeto podem propor ajuste');
    }
    const [[esc]] = await conn.query('SELECT * FROM escrow WHERE project_id = ? FOR UPDATE', [projectId]);
    if (!esc || esc.status !== 'RETIDO') throw new ErroFinanceiro(409, 'Ajuste só é possível com o valor retido e sem disputa');
    const [[pend]] = await conn.query(
      `SELECT id FROM value_adjustments WHERE project_id = ? AND status = 'PENDENTE'`, [projectId]
    );
    if (pend) throw new ErroFinanceiro(409, 'Já existe uma proposta de ajuste à espera de resposta');

    const atual = paraCentavos(proj.valor);
    if (valorNovoC === atual) throw new ErroFinanceiro(400, 'O novo valor é igual ao atual');

    const [adj] = await conn.query(
      `INSERT INTO value_adjustments (project_id, autor_id, valor_antigo, valor_novo, motivo)
       VALUES (?, ?, ?, ?, ?)`,
      [projectId, autorId, atual, valorNovoC, motivo ? String(motivo).slice(0, 500) : null]
    );
    const outro = autorId === proj.cliente_id ? proj.freelancer_id : proj.cliente_id;
    return { ajusteId: adj.insertId, autorId, outro, atual, novo: valorNovoC, clienteId: proj.cliente_id, freelancerId: proj.freelancer_id };
  });

  await msgSistema({
    de: r.autorId, para: r.outro, projectId, tipo: 'AJUSTE',
    texto: `🤝 Proposta de ajuste de valor: ${formatarMT(r.atual)} → ${formatarMT(r.novo)}. ${motivo ? `Motivo: "${motivo}"` : ''}`,
    extra: { ajuste_id: r.ajusteId, valor_antigo: r.atual, valor_novo: r.novo },
  });
  await notify(r.outro, 'ajuste_proposto', 'Proposta de ajuste de valor 🤝',
    `O outro lado propôs mudar o valor do projeto #${projectId} para ${formatarMT(r.novo)}.`);
  return { ajuste: { id: r.ajusteId, valor_antigo: r.atual, valor_novo: r.novo, status: 'PENDENTE' } };
}

async function responderAjuste({ ajusteId, userId, aceitar }) {
  const r = await transacao(async (conn) => {
    const [[adj]] = await conn.query('SELECT * FROM value_adjustments WHERE id = ? FOR UPDATE', [ajusteId]);
    if (!adj) throw new ErroFinanceiro(404, 'Ajuste não encontrado');
    if (adj.autor_id === userId) throw new ErroFinanceiro(403, 'Quem propôs não pode responder ao próprio ajuste');
    if (adj.status !== 'PENDENTE') throw new ErroFinanceiro(409, 'Este ajuste já foi respondido');

    const [[proj]] = await conn.query('SELECT * FROM projects WHERE id = ? FOR UPDATE', [adj.project_id]);
    const [[esc]] = await conn.query('SELECT * FROM escrow WHERE project_id = ? FOR UPDATE', [adj.project_id]);
    if (!esc || esc.status !== 'RETIDO') throw new ErroFinanceiro(409, 'Escrow indisponível para ajuste');

    const outro = adj.autor_id;

    if (!aceitar) {
      await conn.query(`UPDATE value_adjustments SET status = 'RECUSADO', responded_by = ?, responded_at = NOW() WHERE id = ?`, [userId, ajusteId]);
      return { clienteId: proj.cliente_id, freelancerId: proj.freelancer_id, outro, aceito: false, projectId: adj.project_id };
    }

    const diff = Number(adj.valor_novo) - Number(adj.valor_antigo);
    const pct = await comissaoPercentual(conn);

    if (diff > 0) {
      /* aumento: cliente paga a diferença (com saldo da carteira) */
      const wallet = await walletDe(conn, proj.cliente_id, { forUpdate: true });
      if (Number(wallet.balance) < diff) {
        throw new ErroFinanceiro(400, 'Saldo insuficiente para o aumento — adicione saldo fictício à carteira primeiro');
      }
      await conn.query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [diff, wallet.id]);
      await conn.query('UPDATE escrow SET amount_held = amount_held + ?, platform_fee = ? WHERE id = ?',
        [diff, Math.round(((Number(esc.amount_held) + diff) * pct) / 100), esc.id]);
      await registrar(conn, {
        tipo: 'AJUSTE_VALOR', valor: diff, origem: wallet.id, projectId: proj.id,
        reference: `ADJ-${ajusteId}`,
        descricao: `Ajuste de valor aceite: aumento de ${formatarMT(diff)} no escrow do projeto #${proj.id}`,
      });
    } else if (diff < 0) {
      /* diminuição: diferença volta ao cliente */
      const volta = -diff;
      const wallet = await walletDe(conn, proj.cliente_id, { forUpdate: true });
      await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [volta, wallet.id]);
      await conn.query('UPDATE escrow SET amount_held = amount_held - ?, platform_fee = ? WHERE id = ?',
        [volta, Math.round(((Number(esc.amount_held) - volta) * pct) / 100), esc.id]);
      await registrar(conn, {
        tipo: 'AJUSTE_VALOR', valor: volta, destino: wallet.id, projectId: proj.id,
        reference: `ADJ-${ajusteId}`,
        descricao: `Ajuste de valor aceite: devolução de ${formatarMT(volta)} ao cliente do projeto #${proj.id}`,
      });
    }

    await conn.query(`UPDATE projects SET valor = ?, updated_at = NOW() WHERE id = ?`, [paraMT(adj.valor_novo), proj.id]);
    await conn.query(`UPDATE value_adjustments SET status = 'ACEITE', responded_by = ?, responded_at = NOW() WHERE id = ?`, [userId, ajusteId]);

    return { clienteId: proj.cliente_id, freelancerId: proj.freelancer_id, outro, aceito: true, novo: Number(adj.valor_novo), diff, projectId: adj.project_id };
  });

  await msgSistema({
    de: userId, para: r.outro, projectId: r.projectId, texto: r.aceito
      ? `🤝 Ajuste de valor ACEITO. Novo valor: ${formatarMT(r.novo)}${r.diff ? ` (${r.diff > 0 ? `cliente pagou ${formatarMT(r.diff)} a mais para o escrow` : `devolvemos ${formatarMT(-r.diff)} ao cliente`})` : ''}.`
      : '🤝 Ajuste de valor RECUSADO. O valor combinado mantém-se.',
  });
  await notify(r.outro, 'ajuste_respondido', 'Resposta ao ajuste de valor 🤝',
    r.aceito ? 'O ajuste de valor foi aceite.' : 'O ajuste de valor foi recusado.');
  return { aceito: r.aceito, valor: r.aceito ? r.novo : null };
}

/* ============================================================
   A6) CANCELAMENTO DE COMUM ACORDO (antes de qualquer entrega)
   ============================================================ */
async function proporCancelamento({ projectId, autorId, motivo }) {
  if (!motivo || !String(motivo).trim()) throw new ErroFinanceiro(400, 'Escreva o motivo do cancelamento');

  const r = await transacao(async (conn) => {
    const [[proj]] = await conn.query('SELECT * FROM projects WHERE id = ? FOR UPDATE', [projectId]);
    if (!proj) throw new ErroFinanceiro(404, 'Projeto não encontrado');
    if (proj.cliente_id !== autorId && proj.freelancer_id !== autorId) {
      throw new ErroFinanceiro(403, 'Apenas participantes do projeto podem pedir cancelamento');
    }
    if (!['AGUARDANDO_PAGAMENTO', 'EM_ANDAMENTO'].includes(proj.status)) {
      throw new ErroFinanceiro(400, 'Cancelamento por acordo só antes da primeira entrega');
    }
    const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM deliveries WHERE project_id = ?', [projectId]);
    if (Number(total) > 0) throw new ErroFinanceiro(400, 'Já houve entregas — use a disputa se necessário');

    const [[esc]] = await conn.query('SELECT * FROM escrow WHERE project_id = ?', [projectId]);
    if (Number(esc && esc.amount_held) > 0) {
      /* projeto pago: precisa de acordo dos dois */
      const [[pend]] = await conn.query(
        `SELECT id FROM cancel_requests WHERE project_id = ? AND status = 'PENDENTE'`, [projectId]
      );
      if (pend) throw new ErroFinanceiro(409, 'Já existe um pedido de cancelamento à espera de resposta');
      const [req] = await conn.query(
        `INSERT INTO cancel_requests (project_id, autor_id, motivo) VALUES (?, ?, ?)`,
        [projectId, autorId, String(motivo).trim().slice(0, 500)]
      );
      const outro = autorId === proj.cliente_id ? proj.freelancer_id : proj.cliente_id;
      return { tipo: 'PEDIDO', reqId: req.insertId, autorId, outro, clienteId: proj.cliente_id, freelancerId: proj.freelancer_id };
    }

    /* sem pagamento: cancela direto (não há dinheiro para reembolsar) */
    await conn.query(`UPDATE projects SET status = 'CANCELADO', updated_at = NOW() WHERE id = ?`, [projectId]);
    const outro = autorId === proj.cliente_id ? proj.freelancer_id : proj.cliente_id;
    return { tipo: 'DIRETO', autorId, outro, clienteId: proj.cliente_id, freelancerId: proj.freelancer_id };
  });

  if (r.tipo === 'PEDIDO') {
    await msgSistema({
      de: r.autorId, para: r.outro, projectId,
      texto: `🚫 Pedido de cancelamento (antes de qualquer entrega): "${String(motivo).trim()}". O outro lado precisa aceitar para o escrow voltar ao cliente.`,
      extra: { cancel_req_id: r.reqId },
    });
    await notify(r.outro, 'cancelamento_pedido', 'Pedido de cancelamento 🚫',
      `Pedido de cancelamento do projeto #${projectId}. Responda no chat do projeto.`);
    return { pedido: { id: r.reqId, status: 'PENDENTE' } };
  }

  await msgSistema({ de: r.autorId, para: r.outro, projectId, texto: '🚫 Projeto cancelado (não havia pagamento retido).' });
  await notify(r.outro, 'projeto_cancelado', 'Projeto cancelado 🚫', `O projeto #${projectId} foi cancelado.`);
  return { project: { id: projectId, status: 'CANCELADO' } };
}

async function responderCancelamento({ reqId, userId, aceitar }) {
  const r = await transacao(async (conn) => {
    const [[req]] = await conn.query('SELECT * FROM cancel_requests WHERE id = ? FOR UPDATE', [reqId]);
    if (!req) throw new ErroFinanceiro(404, 'Pedido de cancelamento não encontrado');
    if (req.autor_id === userId) throw new ErroFinanceiro(403, 'Quem pediu não pode responder ao próprio pedido');
    if (req.status !== 'PENDENTE') throw new ErroFinanceiro(409, 'Este pedido já foi respondido');

    const [[proj]] = await conn.query('SELECT * FROM projects WHERE id = ? FOR UPDATE', [req.project_id]);
    const outro = req.autor_id;

    if (!aceitar) {
      await conn.query(`UPDATE cancel_requests SET status = 'RECUSADO', responded_by = ?, responded_at = NOW() WHERE id = ?`, [userId, reqId]);
      return { clienteId: proj.cliente_id, freelancerId: proj.freelancer_id, outro, aceito: false, projectId: req.project_id };
    }

    const [[esc]] = await conn.query('SELECT * FROM escrow WHERE project_id = ? FOR UPDATE', [req.project_id]);
    if (esc && esc.status === 'RETIDO' && Number(esc.amount_held) > 0) {
      const wallet = await walletDe(conn, proj.cliente_id, { forUpdate: true });
      await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [Number(esc.amount_held), wallet.id]);
      await registrar(conn, {
        tipo: 'REEMBOLSO', valor: Number(esc.amount_held), destino: wallet.id, projectId: req.project_id,
        reference: `CNC-${reqId}`,
        descricao: `Cancelamento de comum acordo — escrow devolvido ao cliente (projeto #${req.project_id})`,
      });
      await conn.query(`UPDATE escrow SET status = 'REEMBOLSADO', refunded_at = NOW() WHERE id = ?`, [esc.id]);
    }
    await conn.query(`UPDATE projects SET status = 'CANCELADO', updated_at = NOW() WHERE id = ?`, [req.project_id]);
    await conn.query(`UPDATE cancel_requests SET status = 'ACEITE', responded_by = ?, responded_at = NOW() WHERE id = ?`, [userId, reqId]);

    return {
      clienteId: proj.cliente_id, freelancerId: proj.freelancer_id, outro, aceito: true,
      reembolso: esc ? Number(esc.amount_held) : 0, projectId: req.project_id,
    };
  });

  await msgSistema({
    de: userId, para: r.outro, projectId: r.projectId,
    texto: r.aceito
      ? `🚫 Cancelamento ACEITO pelos dois lados${r.reembolso ? ` — ${formatarMT(r.reembolso)} devolvidos à carteira do cliente` : ''}.`
      : '🚫 Pedido de cancelamento RECUSADO — o projeto continua.',
  });
  await notify(r.outro, 'cancelamento_respondido', 'Resposta ao cancelamento 🚫',
    r.aceito ? 'O cancelamento foi aceite e o valor retido devolvido ao cliente.' : 'O pedido de cancelamento foi recusado.');
  return { aceito: r.aceito, reembolso: r.reembolso || 0 };
}

/* ============================================================
   Disputa — decisão do ADMIN (nunca automática)
   ============================================================ */
async function decidirDisputa({ adminId, projectId, decisao, percentualFreelancer, motivo }) {
  if (!['LIBERAR_FREELANCER', 'REEMBOLSAR_CLIENTE', 'DIVIDIR'].includes(decisao)) {
    throw new ErroFinanceiro(400, 'Decisão inválida');
  }
  if (!motivo || !String(motivo).trim()) throw new ErroFinanceiro(400, 'Registre o motivo da decisão (auditoria)');

  const r = await transacao(async (conn) => {
    const [[proj]] = await conn.query('SELECT * FROM projects WHERE id = ? FOR UPDATE', [projectId]);
    if (!proj) throw new ErroFinanceiro(404, 'Projeto não encontrado');
    const [[esc]] = await conn.query('SELECT * FROM escrow WHERE project_id = ? FOR UPDATE', [projectId]);
    if (!esc || esc.status !== 'EM_DISPUTA') throw new ErroFinanceiro(409, 'Este projeto não está em disputa');

    let brutoFreelancer = 0;
    if (decisao === 'LIBERAR_FREELANCER') brutoFreelancer = Number(esc.amount_held);
    if (decisao === 'DIVIDIR') {
      const pct = parseInt(percentualFreelancer, 10);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        throw new ErroFinanceiro(400, 'Percentual do freelancer deve estar entre 0 e 100');
      }
      brutoFreelancer = Math.round((Number(esc.amount_held) * pct) / 100);
    }

    await liberarDentroDaTx(conn, { proj, esc, sufixo: `DSP${esc.id}`, brutoFreelancer, decisaoDisputa: decisao });

    await conn.query(
      `UPDATE escrow SET dispute_decision = ?, dispute_percent_freelancer = ?, dispute_decided_by = ?,
        dispute_decided_at = NOW(), dispute_reason = COALESCE(dispute_reason, ?), updated_at = NOW() WHERE id = ?`,
      [decisao, decisao === 'DIVIDIR' ? parseInt(percentualFreelancer, 10) : (decisao === 'LIBERAR_FREELANCER' ? 100 : 0),
        adminId, String(motivo).trim().slice(0, 500), esc.id]
    );

    return {
      clienteId: proj.cliente_id, freelancerId: proj.freelancer_id,
      brutoFreelancer, reembolsoCliente: Number(esc.amount_held) - brutoFreelancer,
    };
  });

  await msgSistema({
    de: r.clienteId, para: r.freelancerId, projectId, texto: `⚖️ Decisão do administrador (${decisao}): "${String(motivo).trim()}". `
      + `Freelancer recebe ${formatarMT(r.brutoFreelancer)}${r.reembolsoCliente ? ` · cliente recebe de volta ${formatarMT(r.reembolsoCliente)}` : ''}.`,
  });
  await notify(r.clienteId, 'disputa_decidida', 'Disputa decidida ⚖️', `Decisão: ${decisao}. ${String(motivo).trim()}`);
  await notify(r.freelancerId, 'disputa_decidida', 'Disputa decidida ⚖️', `Decisão: ${decisao}. ${String(motivo).trim()}`);
  return { decisao, bruto_freelancer: r.brutoFreelancer, reembolso_cliente: r.reembolsoCliente };
}

/* ============================================================
   Carteira: recarga fictícia, saque, extrato
   ============================================================ */
async function recarregar({ userId, valorMT }) {
  const provider = getProvider();
  if (!provider.isTestMode) {
    throw new ErroFinanceiro(403, 'Recarga fictícia só existe em modo de teste (PAYMENT_PROVIDER=fake)');
  }
  const valor = paraCentavos(valorMT);
  if (!valor || valor <= 0 || valor > 100 * 100 * 100) throw new ErroFinanceiro(400, 'Valor de recarga inválido (máx. 10.000 MT)');

  return transacao(async (conn) => {
    const wallet = await walletDe(conn, userId, { forUpdate: true });
    await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [valor, wallet.id]);
    await registrar(conn, {
      tipo: 'RECARGA_FICTICIA', valor, destino: wallet.id,
      reference: ref('RCH'),
      descricao: `Recarga fictícia (modo de teste) — ${formatarMT(valor)}`,
    });
    const [[nova]] = await conn.query('SELECT balance FROM wallets WHERE id = ?', [wallet.id]);
    return { saldo: Number(nova.balance) };
  });
}

async function sacar({ userId, valorMT, metodo, destino }) {
  if (!['MPESA', 'EMOLA', 'BANCO'].includes(metodo)) throw new ErroFinanceiro(400, 'Método de saque inválido');
  if (!destino || !String(destino).trim()) throw new ErroFinanceiro(400, 'Indique o número/IBAN de destino');
  const valor = paraCentavos(valorMT);
  if (!valor || valor <= 0) throw new ErroFinanceiro(400, 'Valor de saque inválido');

  const provider = getProvider();

  return transacao(async (conn) => {
    const wallet = await walletDe(conn, userId, { forUpdate: true });
    if (Number(wallet.balance) < valor) throw new ErroFinanceiro(400, 'Saldo disponível insuficiente');
    await conn.query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [valor, wallet.id]);
    const [w] = await conn.query(
      `INSERT INTO withdrawals (user_id, valor, metodo, destino) VALUES (?, ?, ?, ?)`,
      [userId, valor, metodo, String(destino).trim().slice(0, 120)]
    );
    await registrar(conn, {
      tipo: 'SAQUE', valor, origem: wallet.id,
      reference: `WDR-${w.insertId}`,
      descricao: `Saque via ${metodo} para ${String(destino).trim()} (pendente de aprovação do admin)`,
    });
    return { saqueId: w.insertId, provider: provider.name };
  });
}

async function listarSaques({ userId = null, status = null } = {}) {
  let sql = `
    SELECT w.*, u.nome as user_nome, u.email as user_email
    FROM withdrawals w JOIN users u ON u.id = w.user_id WHERE 1=1
  `;
  const valores = [];
  if (userId) { sql += ' AND w.user_id = ?'; valores.push(userId); }
  if (status) { sql += ' AND w.status = ?'; valores.push(status); }
  sql += ' ORDER BY w.created_at DESC LIMIT 100';
  const [rows] = await db.query(sql, valores);
  return rows;
}

async function decidirSaque({ adminId, saqueId, aprovar, motivo }) {
  const r = await transacao(async (conn) => {
    const [[saque]] = await conn.query('SELECT * FROM withdrawals WHERE id = ? FOR UPDATE', [saqueId]);
    if (!saque) throw new ErroFinanceiro(404, 'Saque não encontrado');
    if (saque.status !== 'PENDENTE') throw new ErroFinanceiro(409, 'Este saque já foi processado');

    if (aprovar) {
      await conn.query(
        `UPDATE withdrawals SET status = 'CONCLUIDO', processed_by = ?, processed_at = NOW() WHERE id = ?`,
        [adminId, saqueId]
      );
      return { userId: saque.user_id, valor: Number(saque.valor), aprovado: true };
    }
    /* recusa devolve o valor à carteira */
    const wallet = await walletDe(conn, saque.user_id, { forUpdate: true });
    await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [Number(saque.valor), wallet.id]);
    await registrar(conn, {
      tipo: 'SAQUE_RECUSADO', valor: Number(saque.valor), destino: wallet.id,
      reference: `WDRR-${saqueId}`,
      descricao: `Saque #${saqueId} recusado — valor devolvido à carteira. ${motivo ? `Motivo: ${String(motivo).slice(0, 200)}` : ''}`,
    });
    await conn.query(
      `UPDATE withdrawals SET status = 'RECUSADO', processed_by = ?, processed_at = NOW(), motivo_recusa = ? WHERE id = ?`,
      [adminId, motivo ? String(motivo).slice(0, 255) : null, saqueId]
    );
    return { userId: saque.user_id, valor: Number(saque.valor), aprovado: false };
  });
  await notify(r.userId, r.aprovado ? 'saque_concluido' : 'saque_recusado',
    r.aprovado ? 'Saque concluído 💸' : 'Saque recusado',
    r.aprovado ? `O teu saque de ${formatarMT(r.valor)} foi concluído (simulado).`
      : `O teu saque de ${formatarMT(r.valor)} foi recusado — o valor voltou à tua carteira.`);
  return { aprovado: r.aprovado };
}

/* ============================================================
   Leitura (sem transação) — carteira, extrato, stats
   ============================================================ */
async function estadoCarteira(userId, tipoUsuario) {
  const [w] = await db.query('SELECT * FROM wallets WHERE user_id = ?', [userId]);
  const wallet = w[0] || { balance: 0, currency: 'MZN' };
  const saldo = Number(wallet.balance);
  let pendente = 0;
  if (tipoUsuario === 'FREELANCER') pendente = await aReceber(null, userId);
  else if (tipoUsuario === 'CLIENTE') pendente = await emEscrow(null, userId);

  const [extrato] = await db.query(`
    SELECT t.*
    FROM transactions t
    WHERE t.wallet_origem_id = (SELECT id FROM wallets WHERE user_id = ?)
       OR t.wallet_destino_id = (SELECT id FROM wallets WHERE user_id = ?)
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT 200
  `, [userId, userId]);
  return { saldo, currency: wallet.currency || 'MZN', pendente, extrato };
}

async function extratoFiltrado(userId, { tipo = null, page = 1, limit = 50 } = {}) {
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  let sql = `
    SELECT t.*
    FROM transactions t
    WHERE t.wallet_origem_id = (SELECT id FROM wallets WHERE user_id = ?)
       OR t.wallet_destino_id = (SELECT id FROM wallets WHERE user_id = ?)
  `;
  const valores = [userId, userId];
  if (tipo) { sql += ' AND t.tipo = ?'; valores.push(tipo); }
  sql += ' ORDER BY t.created_at DESC, t.id DESC LIMIT ? OFFSET ?';
  valores.push(parseInt(limit, 10), offset);
  const [rows] = await db.query(sql, valores);
  return rows;
}

async function statsFinanceirosAdmin() {
  const [[retido]] = await db.query(`SELECT COALESCE(SUM(amount_held),0) as total, COUNT(*) as n FROM escrow WHERE status = 'RETIDO'`);
  const [[disputa]] = await db.query(`SELECT COALESCE(SUM(amount_held),0) as total, COUNT(*) as n FROM escrow WHERE status = 'EM_DISPUTA'`);
  const [[comissoes]] = await db.query(`SELECT COALESCE(SUM(platform_fee),0) as total FROM escrow WHERE status = 'LIBERADO'`);
  const [[liberado]] = await db.query(`SELECT COALESCE(SUM(amount_held),0) as total FROM escrow WHERE status = 'LIBERADO'`);
  const [[reembolsado]] = await db.query(`SELECT COALESCE(SUM(amount_held),0) as total FROM escrow WHERE status = 'REEMBOLSADO'`);
  const [[saquesPend]] = await db.query(`SELECT COUNT(*) as n, COALESCE(SUM(valor),0) as total FROM withdrawals WHERE status = 'PENDENTE'`);
  const [porMes] = await db.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') as mes,
           COALESCE(SUM(CASE WHEN tipo = 'COMISSAO' THEN valor END), 0) as comissoes,
           COALESCE(SUM(CASE WHEN tipo = 'PAGAMENTO_PROJETO' THEN valor END), 0) as volume
    FROM transactions
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY mes ORDER BY mes
  `);
  const [disputas] = await db.query(`
    SELECT e.*, p.valor as project_valor, s.titulo as project_titulo,
           c.nome as cliente_nome, f.nome as freelancer_nome
    FROM escrow e
    JOIN projects p ON p.id = e.project_id
    LEFT JOIN services s ON s.id = p.servico_id
    JOIN users c ON c.id = p.cliente_id
    JOIN users f ON f.id = p.freelancer_id
    WHERE e.status = 'EM_DISPUTA'
    ORDER BY e.updated_at DESC
  `);
  const [recentes] = await db.query(`
    SELECT t.*, uo.nome as origem_nome, ud.nome as destino_nome
    FROM transactions t
    LEFT JOIN wallets wo ON wo.id = t.wallet_origem_id LEFT JOIN users uo ON uo.id = wo.user_id
    LEFT JOIN wallets wd ON wd.id = t.wallet_destino_id LEFT JOIN users ud ON ud.id = wd.user_id
    ORDER BY t.created_at DESC, t.id DESC LIMIT 30
  `);
  const settings = {};
  const [sets] = await db.query('SELECT chave, valor FROM settings');
  sets.forEach((s) => { settings[s.chave] = s.valor; });

  return {
    escrow_retido: Number(retido.total), escrow_retido_n: Number(retido.n),
    escrow_disputa: Number(disputa.total), disputas_n: Number(disputa.n),
    comissoes_total: Number(comissoes.total),
    liberado_total: Number(liberado.total),
    reembolsado_total: Number(reembolsado.total),
    saques_pendentes_n: Number(saquesPend.n), saques_pendentes_total: Number(saquesPend.total),
    por_mes: porMes, disputas, transacoes_recentes: recentes, settings,
  };
}

/* Lembrete de resposta lenta do cliente — só NOTIFICA, nunca libera */
async function lembretesAutoRelease() {
  const dias = parseInt(await getSetting('dias_liberacao_automatica', '7'), 10) || 7;
  const [rows] = await db.query(`
    SELECT p.id, p.cliente_id, p.freelancer_id, p.last_delivery_at
    FROM projects p JOIN escrow e ON e.project_id = p.id
    WHERE p.status = 'ENTREGUE' AND e.status = 'RETIDO'
      AND p.last_delivery_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      AND (e.dispute_decided_at IS NULL)
  `, [dias]);
  for (const p of rows) {
    await notify(p.cliente_id, 'responda_entrega', 'Responda à entrega ⏰',
      `Passaram ${dias} dias desde a entrega do projeto #${p.id}. Aprove, peça revisão ou abra uma disputa.`);
    await notify(p.freelancer_id, 'cliente_silente', 'Cliente sem resposta ⏰',
      `O cliente não responde à entrega do projeto #${p.id} há ${dias} dias. Pode pedir a intervenção do administrador.`);
  }
  return rows.length;
}

module.exports = {
  ErroFinanceiro,
  paraCentavos, paraMT, formatarMT,
  transacao, getSetting, setSetting, comissaoPercentual,
  walletDe, aReceber, emEscrow, registrar,
  pagarProjeto, criarEntrega,
  aprovarEntrega, pedirRevisao, abrirDisputa,
  confirmarConclusao, liberarDentroDaTx,
  proporAjuste, responderAjuste,
  proporCancelamento, responderCancelamento,
  decidirDisputa,
  recarregar, sacar, listarSaques, decidirSaque,
  estadoCarteira, extratoFiltrado, statsFinanceirosAdmin,
  lembretesAutoRelease,
};
