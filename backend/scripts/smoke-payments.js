/* ============================================================
   FreelaMZ — Smoke test FASE A: pagamentos + escrow (casos de borda)
   Executar: npm run smoke:payments   (backend precisa de estar a rodar)
   Cobre A8: utilizador alheio, ficheiro grande/inválido, saldo
   insuficiente, falha simulada, ajuste de valor, cancelamento com
   reembolso, disputa decidida pelo admin, concorrência (liberar 2x).
   ============================================================ */
const BASE = process.env.API_URL || 'http://localhost:3000/api';
const TS = Date.now();

let passou = 0;
let falhou = 0;
const falhas = [];

/* Limpeza de EMERGÊNCIA: se o teste morrer a meio, apaga as contas
   criadas para não ficarem na base de dados. */
const CRIADOS = [];
async function limpezaEmergencia() {
  if (!CRIADOS.length) return;
  try {
    const r = await req('POST', '/auth/login', {
      body: {
        email: process.env.ADMIN_EMAIL || 'admin@freelamz.com',
        senha: process.env.ADMIN_PASSWORD || 'Admin@12345',
      },
    });
    const tok = r.data && r.data.token;
    if (!tok) return;
    for (const id of CRIADOS) {
      await req('DELETE', `/admin/users/${id}`, { token: tok });
    }
    console.log(`[limpeza] ${CRIADOS.length} conta(s) de teste removida(s) após falha`);
  } catch (e) { /* melhor esforço */ }
}

function check(nome, cond, detalhe = '') {
  if (cond) {
    passou += 1;
    console.log(`  ✓ ${nome}`);
  } else {
    falhou += 1;
    falhas.push(`${nome}${detalhe ? ` — ${detalhe}` : ''}`);
    console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* vazio */ }
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: { message: e.message } };
  }
}

async function reqForm(method, path, { token, campos = {}, ficheiros = [] } = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  for (const f of ficheiros) {
    fd.append(f.campo, new Blob([f.dados], { type: f.tipo }), f.nome);
  }
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE}${path}`, { method, headers, body: fd });
    let data = {};
    try { data = await res.json(); } catch (e) { /* vazio */ }
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: { message: e.message } };
  }
}

async function login(email, senha) {
  const r = await req('POST', '/auth/login', { body: { email, senha } });
  return { token: r.data.token, user: r.data.user };
}

async function saldoDe(token) {
  const r = await req('GET', '/payments/wallet', { token });
  return r.data.wallet ? Number(r.data.wallet.saldo) : null;
}

async function criarProjetoPago({ tokCli, tokFre, freId, cliId, svcId, valor, metodo = 'SALDO', recarga = 0, extra = {} }) {
  const proj = await req('POST', '/projects', {
    token: tokCli, body: { freelancerId: freId, servicoId: svcId, valor, prazo: '5 dias' },
  });
  const projectId = proj.data.project.id;
  const prop = await req('POST', '/proposals', {
    token: tokFre, body: { projeto_id: projectId, preco: valor, prazo: '4 dias', mensagem: 'Proposta A8.' },
  });
  await req('PUT', `/proposals/${prop.data.proposal.id}/status`, { token: tokCli, body: { status: 'ACEITA' } });
  if (recarga > 0) {
    await req('POST', '/payments/wallet/recharge', { token: tokCli, body: { valor: recarga } });
  }
  const pay = await req('POST', '/payments/pay', { token: tokCli, body: { projectId, metodo, ...extra } });
  return { projectId, pay };
}

async function main() {
  console.log('\n════════ FREELAMZ — SMOKE FASE A: PAGAMENTOS + ESCROW ════════');
  console.log(`Alvo: ${BASE}\n`);

  /* ---------- 0. Setup ---------- */
  console.log('[0] Setup (utilizadores descartáveis)');
  const SENHA = 'A8test@123';
  const reg = async (nome, tipo, tel) => {
    const email = `a8.${nome}.${TS}@freelamz.com`;
    const r = await req('POST', '/auth/register', {
      body: { nome: `A8 ${nome}`, email, telefone: tel, senha: SENHA, tipoUsuario: tipo, cidade: 'Maputo', provincia: 'Maputo' },
    });
    return { email, token: r.data.token, id: r.data.user.id };
  };
  const cli = await reg('cliente', 'CLIENTE', '+258 84 500 0001');
  const fre = await reg('freela', 'FREELANCER', '+258 84 500 0002');
  const intruso = await reg('intruso', 'FREELANCER', '+258 84 500 0003');
  CRIADOS.push(cli.id, fre.id, intruso.id); /* limpeza de emergência */
  const adm = await login(process.env.ADMIN_EMAIL || 'admin@freelamz.com', process.env.ADMIN_PASSWORD || 'Admin@12345');
  check('Utilizadores de teste criados', !!cli.token && !!fre.token && !!intruso.token && !!adm.token, '');

  const svc = await req('POST', '/services', {
    token: fre.token,
    body: {
      titulo: `Serviço A8 ${TS}`, descricao: 'Serviço para teste de pagamentos',
      categoria_id: 1, preco: 1000, prazo_entrega: '3 dias', status: 'ativo',
    },
  });
  const svcId = svc.data.service.id;
  check('Serviço de teste criado', !!svcId, `status=${svc.status}`);

  const config = await req('GET', '/payments/config', { token: cli.token });
  check('GET /payments/config → modo de teste + comissão', config.status === 200
    && config.data.config.modo_teste === true && Number(config.data.config.comissao_percentual) === 10,
    `modo=${config.data.config.modo_teste} comissao=${config.data.config.comissao_percentual}`);

  /* ---------- 1. Projeto A: ajustes, utilizador alheio, concorrência, saque ---------- */
  console.log('\n[1] Projeto A — ajuste de valor, utilizador alheio, concorrência e saque');

  const A = await criarProjetoPago({ tokCli: cli.token, tokFre: fre.token, freId: fre.id, cliId: cli.id, svcId, valor: 2000, recarga: 3000 });
  check('Projeto A pago com saldo', A.pay.status === 200 && A.pay.data.escrow.status === 'RETIDO', `status=${A.pay.status}`);
  const projA = await req('GET', `/projects/${A.projectId}`, { token: cli.token });
  check('Escrow A: 200000 retidos + 20000 comissão',
    Number(projA.data.escrow.amount_held) === 200000 && Number(projA.data.escrow.platform_fee) === 20000,
    `held=${projA.data.escrow.amount_held} fee=${projA.data.escrow.platform_fee}`);

  /* utilizador alheio */
  const intrusoGet = await req('GET', `/projects/${A.projectId}`, { token: intruso.token });
  check('Utilizador alheio não vê o projeto → 403', intrusoGet.status === 403, `status=${intrusoGet.status}`);
  const intrusoDeliver = await reqForm('POST', `/projects/${A.projectId}/deliveries`, {
    token: intruso.token, campos: { mensagem: 'sou intruso' },
  });
  check('Utilizador alheio não entrega → 403', intrusoDeliver.status === 403, `status=${intrusoDeliver.status}`);
  const intrusoApprove = await req('POST', `/projects/${A.projectId}/deliveries/1/approve`, { token: intruso.token });
  check('Utilizador alheio não aprova → 403', intrusoApprove.status === 403, `status=${intrusoApprove.status}`);
  const intrusoPay = await req('POST', '/payments/pay', { token: intruso.token, body: { projectId: A.projectId, metodo: 'SALDO' } });
  check('Utilizador alheio não paga → 403', intrusoPay.status === 403, `status=${intrusoPay.status}`);

  /* ficheiros grandes / demasiados */
  const grande = Buffer.alloc(21 * 1024 * 1024, 1); // 21 MB > limite 20 MB
  const entregaGrande = await reqForm('POST', `/projects/${A.projectId}/deliveries`, {
    token: fre.token, campos: { mensagem: 'ficheiro grande' },
    ficheiros: [{ campo: 'arquivos', dados: grande, tipo: 'application/zip', nome: 'grande.zip' }],
  });
  check('Ficheiro > 20 MB → 400', entregaGrande.status === 400, `status=${entregaGrande.status} ${entregaGrande.data.message || ''}`);

  const ZIP_OK = Buffer.concat([Buffer.from('PK\x03\x04', 'binary'), Buffer.alloc(64, 1)]);
  const entregaMuitos = await reqForm('POST', `/projects/${A.projectId}/deliveries`, {
    token: fre.token, campos: { mensagem: 'demasiados ficheiros' },
    ficheiros: [1, 2, 3, 4, 5, 6].map((i) => ({ campo: 'arquivos', dados: ZIP_OK, tipo: 'application/zip', nome: `f${i}.zip` })),
  });
  check('Mais de 5 ficheiros → 400', entregaMuitos.status === 400, `status=${entregaMuitos.status}`);

  /* entrega + ajustes de valor (aumentar e diminuir) */
  const entregaA = await reqForm('POST', `/projects/${A.projectId}/deliveries`, {
    token: fre.token,
    campos: { mensagem: 'Entrega do projeto A.', links: JSON.stringify(['https://exemplo.co.mz/demo']) },
    ficheiros: [{ campo: 'arquivos', dados: ZIP_OK, tipo: 'application/zip', nome: 'trabalho.zip' }],
  });
  check('Entrega A com ZIP válido → 201', entregaA.status === 201, `status=${entregaA.status} ${entregaA.data.message || ''}`);

  const saldoCliAntes = await saldoDe(cli.token);
  const ajusteUp = await req('POST', `/projects/${A.projectId}/adjustments`, {
    token: cli.token, body: { valor_novo: 2500, motivo: 'Cliente acrescentou 2 páginas.' },
  });
  check('Ajuste para MAIS (2500) proposto', ajusteUp.status === 201, `status=${ajusteUp.status}`);
  const ajusteDup = await req('POST', `/projects/${A.projectId}/adjustments`, {
    token: cli.token, body: { valor_novo: 3000, motivo: 'outro' },
  });
  check('Segundo ajuste pendente → 409', ajusteDup.status === 409, `status=${ajusteDup.status}`);
  const ajusteSelfResp = await req('POST', `/projects/${A.projectId}/adjustments/${ajusteUp.data.ajuste.id}/respond`, {
    token: cli.token, body: { aceitar: true },
  });
  check('Autor não responde ao próprio ajuste → 403', ajusteSelfResp.status === 403, `status=${ajusteSelfResp.status}`);

  const aceitarUp = await req('POST', `/projects/${A.projectId}/adjustments/${ajusteUp.data.ajuste.id}/respond`, {
    token: fre.token, body: { aceitar: true },
  });
  const projA2 = await req('GET', `/projects/${A.projectId}`, { token: cli.token });
  check('Aumento aceite: escrow 250000 + fee 25000', aceitarUp.status === 200
    && Number(projA2.data.escrow.amount_held) === 250000 && Number(projA2.data.escrow.platform_fee) === 25000,
    `held=${projA2.data.escrow.amount_held} fee=${projA2.data.escrow.platform_fee}`);
  check('Cliente pagou a diferença (500 MT)', saldoCliAntes - (await saldoDe(cli.token)) === 50000,
    `antes=${saldoCliAntes} depois=${await saldoDe(cli.token)}`);

  const ajusteDown = await req('POST', `/projects/${A.projectId}/adjustments`, {
    token: fre.token, body: { valor_novo: 2000, motivo: 'Freelancer reduziu o escopo.' },
  });
  const aceitarDown = await req('POST', `/projects/${A.projectId}/adjustments/${ajusteDown.data.ajuste.id}/respond`, {
    token: cli.token, body: { aceitar: true },
  });
  const projA3 = await req('GET', `/projects/${A.projectId}`, { token: cli.token });
  check('Diminuição aceite: escrow volta a 200000', aceitarDown.status === 200
    && Number(projA3.data.escrow.amount_held) === 200000 && Number(projA3.data.project.valor) === 2000,
    `held=${projA3.data.escrow.amount_held} valor=${projA3.data.project.valor}`);
  check('Diferença devolvida ao cliente (500 MT)', (await saldoDe(cli.token)) === saldoCliAntes,
    `saldo=${await saldoDe(cli.token)}`);

  /* aprovação só de um lado NÃO libera */
  const aprovarA = await req('POST', `/projects/${A.projectId}/deliveries/1/approve`, { token: cli.token });
  check('Cliente aprova → ok mas não libera', aprovarA.status === 200 && aprovarA.data.liberado === false, `status=${aprovarA.status}`);
  const escMeio = await req('GET', `/projects/${A.projectId}`, { token: cli.token });
  check('Escrow continua RETIDO com um lado só', escMeio.data.escrow.status === 'RETIDO', `escrow=${escMeio.data.escrow.status}`);

  /* CONCORRÊNCIA: dois confirms simultâneos → só um libera */
  const saldoFreAntes = await saldoDe(fre.token);
  const [c1, c2] = await Promise.all([
    req('POST', `/projects/${A.projectId}/confirm`, { token: fre.token }),
    req('POST', `/projects/${A.projectId}/confirm`, { token: fre.token }),
  ]);
  const liberados = [c1, c2].filter((r) => r.status === 200 && r.data.liberado === true).length;
  check('Concorrência: exatamente UMA liberação', liberados === 1, `c1=${c1.status} c2=${c2.status} liberados=${liberados}`);
  check('Concorrência: a outra falhou com 409', [c1, c2].some((r) => r.status === 409), `c1=${c1.status} c2=${c2.status}`);

  const projAFim = await req('GET', `/projects/${A.projectId}`, { token: fre.token });
  check('Projeto A CONCLUIDO + escrow LIBERADO', projAFim.data.project.status === 'CONCLUIDO'
    && projAFim.data.escrow.status === 'LIBERADO' && !!projAFim.data.escrow.released_at,
    `proj=${projAFim.data.project.status} escrow=${projAFim.data.escrow.status}`);
  check('Freelancer recebeu líquido de 1800 MT (2000−10%)', (await saldoDe(fre.token)) - saldoFreAntes === 180000,
    `antes=${saldoFreAntes} depois=${await saldoDe(fre.token)}`);

  const livroA = await req('GET', '/payments/wallet/transactions', { token: fre.token });
  const tiposLivro = (livroA.data.transacoes || []).map((t) => t.tipo);
  check('Livro-razão do freelancer tem LIBERACAO_ESCROW', tiposLivro.includes('LIBERACAO_ESCROW'), `tipos=${tiposLivro.join(',')}`);

  /* saque fictício */
  const saque = await req('POST', '/payments/wallet/withdraw', {
    token: fre.token, body: { valor: 500, metodo: 'MPESA', destino: '+258 84 500 0002' },
  });
  check('Saque de 500 MT → PENDENTE', saque.status === 200, `status=${saque.status}`);
  check('Saque debitou o saldo', await saldoDe(fre.token) === saldoFreAntes + 180000 - 50000, `saldo=${await saldoDe(fre.token)}`);
  const saqueMaior = await req('POST', '/payments/wallet/withdraw', {
    token: fre.token, body: { valor: 99999, metodo: 'MPESA', destino: '+258 84 500 0002' },
  });
  check('Saque acima do saldo → 400', saqueMaior.status === 400, `status=${saqueMaior.status}`);

  const saquesAdmin = await req('GET', '/admin/withdrawals?status=PENDENTE', { token: adm.token });
  const meuSaque = (saquesAdmin.data.saques || []).find((s) => s.user_id === fre.id);
  check('Admin vê o saque pendente', !!meuSaque, `total=${(saquesAdmin.data.saques || []).length}`);
  if (meuSaque) {
    const aprovarSaque = await req('PUT', `/admin/withdrawals/${meuSaque.id}`, { token: adm.token, body: { aprovar: true } });
    check('Admin aprova o saque → CONCLUIDO', aprovarSaque.status === 200 && aprovarSaque.data.aprovado === true, `status=${aprovarSaque.status}`);
  }

  /* ---------- 2. Projeto B: saldo insuficiente, M-Pesa simulado, falha, cancelamento ---------- */
  console.log('\n[2] Projeto B — saldo insuficiente, M-Pesa simulado, falha e cancelamento com reembolso');

  const projB = await req('POST', '/projects', {
    token: cli.token, body: { freelancerId: fre.id, servicoId: svcId, valor: 1500, prazo: '3 dias' },
  });
  const projBId = projB.data.project.id;
  const propB = await req('POST', '/proposals', {
    token: fre.token, body: { projeto_id: projBId, preco: 1500, prazo: '3 dias', mensagem: 'Proposta B.' },
  });
  await req('PUT', `/proposals/${propB.data.proposal.id}/status`, { token: cli.token, body: { status: 'ACEITA' } });

  const saldoCliB = await saldoDe(cli.token); // 1000 MT (100000)
  const pagarSemSaldo = await req('POST', '/payments/pay', { token: cli.token, body: { projectId: projBId, metodo: 'SALDO' } });
  check('Saldo insuficiente → 400 (não paga)', pagarSemSaldo.status === 400, `status=${pagarSemSaldo.status} msg=${pagarSemSaldo.data.message || ''}`);
  check('Saldo intacto após recusa', await saldoDe(cli.token) === saldoCliB, `saldo=${await saldoDe(cli.token)}`);

  const falha = await req('POST', '/payments/pay', {
    token: cli.token, body: { projectId: projBId, metodo: 'MPESA', numero: '+258 84 500 0001', simularFalha: true },
  });
  check('Falha simulada do M-Pesa → 402', falha.status === 402, `status=${falha.status} msg=${falha.data.message || ''}`);

  const pagarMpesa = await req('POST', '/payments/pay', {
    token: cli.token, body: { projectId: projBId, metodo: 'MPESA', numero: '+258 84 500 0001' },
  });
  check('M-Pesa simulado com número → 200 RETIDO', pagarMpesa.status === 200 && pagarMpesa.data.escrow.status === 'RETIDO'
    && pagarMpesa.data.charge.provider === 'fake', `status=${pagarMpesa.status} provider=${pagarMpesa.data.charge && pagarMpesa.data.charge.provider}`);
  check('M-Pesa não mexe no saldo da carteira', await saldoDe(cli.token) === saldoCliB, `saldo=${await saldoDe(cli.token)}`);

  /* cancelamento de comum acordo com reembolso */
  const cancelDireto = await req('PUT', `/projects/${projBId}/status`, { token: cli.token, body: { status: 'CANCELADO' } });
  check('Cancelar direto com dinheiro retido → 409 (exige acordo)', cancelDireto.status === 409, `status=${cancelDireto.status}`);
  const cancelPed = await req('POST', `/projects/${projBId}/cancel`, {
    token: fre.token, body: { motivo: 'Cliente desistiu antes de começar.' },
  });
  check('Freelancer pede cancelamento → PENDENTE', cancelPed.status === 200 && !!cancelPed.data.pedido, `status=${cancelPed.status}`);
  const cancelSemAceitar = await req('POST', `/projects/${projBId}/deliveries/1/approve`, { token: cli.token });
  check('Projeto continua EM_ANDAMENTO durante o pedido', cancelSemAceitar.status === 400 || cancelSemAceitar.status === 200, `status=${cancelSemAceitar.status}`);
  const cancelRecusar = await req('POST', `/projects/${projBId}/cancel/${cancelPed.data.pedido.id}/respond`, {
    token: cli.token, body: { aceitar: false },
  });
  const cancelAceitar = await req('POST', `/projects/${projBId}/cancel/${cancelPed.data.pedido.id}/respond`, {
    token: cli.token, body: { aceitar: true },
  });
  check('Pedido já respondido → 409', cancelAceitar.status === 409, `status=${cancelAceitar.status}`);
  const projBFim = await req('GET', `/projects/${projBId}`, { token: cli.token });
  check('Cancelamento recusado mantém projeto', cancelRecusar.status === 200 && projBFim.data.project.status !== 'CANCELADO',
    `status=${cancelRecusar.status} proj=${projBFim.data.project.status}`);

  /* novo pedido, agora aceite → reembolso */
  const cancelPed2 = await req('POST', `/projects/${projBId}/cancel`, {
    token: fre.token, body: { motivo: 'Combinámos cancelar.' },
  });
  const saldoCliAntesReembolso = await saldoDe(cli.token);
  const cancelAceito = await req('POST', `/projects/${projBId}/cancel/${cancelPed2.data.pedido.id}/respond`, {
    token: cli.token, body: { aceitar: true },
  });
  const projBFim2 = await req('GET', `/projects/${projBId}`, { token: cli.token });
  check('Cancelamento aceite → CANCELADO + REEMBOLSADO', cancelAceito.status === 200
    && projBFim2.data.project.status === 'CANCELADO' && projBFim2.data.escrow.status === 'REEMBOLSADO',
    `proj=${projBFim2.data.project.status} escrow=${projBFim2.data.escrow.status}`);
  check('Cliente recebeu 1500 MT de volta', (await saldoDe(cli.token)) - saldoCliAntesReembolso === 150000,
    `antes=${saldoCliAntesReembolso} depois=${await saldoDe(cli.token)}`);

  /* ---------- 3. Projeto C: disputa decidida pelo admin (dividir) ---------- */
  console.log('\n[3] Projeto C — disputa e decisão do admin (dividir 50%)');

  const C = await criarProjetoPago({ tokCli: cli.token, tokFre: fre.token, freId: fre.id, cliId: cli.id, svcId, valor: 1000 });
  check('Projeto C pago com saldo', C.pay.status === 200, `status=${C.pay.status}`);
  const entregaC = await reqForm('POST', `/projects/${C.projectId}/deliveries`, {
    token: fre.token, campos: { mensagem: 'Entrega em disputa.' },
    ficheiros: [{ campo: 'arquivos', dados: ZIP_OK, tipo: 'application/zip', nome: 'parcial.zip' }],
  });
  check('Entrega C criada', entregaC.status === 201, `status=${entregaC.status}`);

  const saldoFreC = await saldoDe(fre.token);
  const saldoCliC = await saldoDe(cli.token);
  const disputa = await req('POST', `/projects/${C.projectId}/dispute`, {
    token: cli.token, body: { motivo: 'Trabalho entregue pela metade.' },
  });
  check('Cliente abre disputa → EM_DISPUTA', disputa.status === 200, `status=${disputa.status}`);
  const projC = await req('GET', `/projects/${C.projectId}`, { token: cli.token });
  check('Projeto C e escrow EM_DISPUTA', projC.data.project.status === 'EM_DISPUTA' && projC.data.escrow.status === 'EM_DISPUTA',
    `proj=${projC.data.project.status} escrow=${projC.data.escrow.status}`);

  const confirmarEmDisputa = await req('POST', `/projects/${C.projectId}/confirm`, { token: fre.token });
  check('Liberar durante disputa → 409 (só admin decide)', confirmarEmDisputa.status === 409, `status=${confirmarEmDisputa.status}`);

  const disputasAdmin = await req('GET', '/admin/disputes', { token: adm.token });
  const minhaDisputa = (disputasAdmin.data.disputas || []).find((d) => d.project_id === Number(C.projectId));
  check('Admin lista a disputa com motivo', !!minhaDisputa && /metade/i.test(minhaDisputa.dispute_reason || ''), `total=${(disputasAdmin.data.disputas || []).length}`);

  const decidir = await req('PUT', `/admin/disputes/${C.projectId}/resolve`, {
    token: adm.token,
    body: { decisao: 'DIVIDIR', percentualFreelancer: 50, motivo: 'Metade do trabalho estava feita e aceitável.' },
  });
  check('Admin decide DIVIDIR 50% → 200', decidir.status === 200, `status=${decidir.status} ${decidir.data.message || ''}`);
  const projCFim = await req('GET', `/projects/${C.projectId}`, { token: cli.token });
  const escC = projCFim.data.escrow;
  check('Escrow C LIBERADO com decisão registada', escC.status === 'LIBERADO'
    && escC.dispute_decision === 'DIVIDIR' && Number(escC.dispute_percent_freelancer) === 50 && !!escC.dispute_decided_by,
    `status=${escC.status} decisao=${escC.dispute_decision} pct=${escC.dispute_percent_freelancer}`);
  check('Projeto C CONCLUIDO', projCFim.data.project.status === 'CONCLUIDO', `proj=${projCFim.data.project.status}`);
  // 1000 MT: 50% bruto ao freelancer = 500, comissão 10% de 500 = 50 → líquido 450; cliente recebe 500
  check('Freelancer +450 MT e cliente +500 MT (divisão)',
    (await saldoDe(fre.token)) - saldoFreC === 45000 && (await saldoDe(cli.token)) - saldoCliC === 50000,
    `fre=${(await saldoDe(fre.token)) - saldoFreC} cli=${(await saldoDe(cli.token)) - saldoCliC}`);

  /* download autorizado */
  const listC = await req('GET', `/projects/${C.projectId}/deliveries`, { token: cli.token });
  const arquivoC = listC.data.deliveries[0] && listC.data.deliveries[0].arquivos[0];
  const dlOk = await req('GET', `/projects/${C.projectId}/deliveries/files/${arquivoC.id}`, { token: cli.token });
  check('Participante descarrega o ficheiro → 200', dlOk.status === 200, `status=${dlOk.status}`);
  const dlIntruso = await req('GET', `/projects/${C.projectId}/deliveries/files/${arquivoC.id}`, { token: intruso.token });
  check('Utilizador alheio NÃO descarrega → 403', dlIntruso.status === 403, `status=${dlIntruso.status}`);

  /* ---------- 4. Painel financeiro do admin ---------- */
  console.log('\n[4] Painel financeiro do admin');
  const fin = await req('GET', '/admin/finance', { token: adm.token });
  const f = fin.data.finance || {};
  check('Admin finance: escrow retido + comissões', fin.status === 200 && f.escrow_retido >= 0
    && f.comissoes_total >= 24500 && f.saques_pendentes_n >= 0,
    `retido=${f.escrow_retido} comissoes=${f.comissoes_total}`);
  check('Admin finance: transações e séries mensais', (f.transacoes_recentes || []).length > 0 && (f.por_mes || []).length >= 1,
    `tx=${(f.transacoes_recentes || []).length} meses=${(f.por_mes || []).length}`);

  const comissao15 = await req('PUT', '/admin/settings', { token: adm.token, body: { chave: 'comissao_percentual', valor: 15 } });
  check('Admin muda comissão para 15%', comissao15.status === 200, `status=${comissao15.status}`);
  const comissaoInvalida = await req('PUT', '/admin/settings', { token: adm.token, body: { chave: 'comissao_percentual', valor: 90 } });
  check('Comissão fora do limite → 400', comissaoInvalida.status === 400, `status=${comissaoInvalida.status}`);
  const voltar10 = await req('PUT', '/admin/settings', { token: adm.token, body: { chave: 'comissao_percentual', valor: 10 } });
  check('Comissão volta a 10%', voltar10.status === 200, `status=${voltar10.status}`);

  /* dashboard com dados financeiros reais */
  const dashFre = await req('GET', '/users/dashboard', { token: fre.token });
  check('Dashboard freelancer tem saldo + a receber', dashFre.status === 200
    && typeof dashFre.data.dashboard.financeiro.saldo === 'number'
    && dashFre.data.dashboard.financeiro.pendente >= 0,
    `saldo=${dashFre.data.dashboard && dashFre.data.dashboard.financeiro.saldo}`);

  /* ---------- 5. Limpeza ---------- */
  console.log('\n[5] Limpeza');
  const delSvc = await req('DELETE', `/admin/services/${svcId}`, { token: adm.token });
  check('Apagar serviço de teste', delSvc.status === 200, `status=${delSvc.status}`);
  for (const u of [cli, fre, intruso]) {
    const del = await req('DELETE', `/admin/users/${u.id}`, { token: adm.token });
    check(`Apagar ${u.email.split('@')[0]}`, del.status === 200, `status=${del.status}`);
  }

  console.log('\n══════════════════════════════════════');
  console.log(`RESULTADO: ${passou} passaram, ${falhou} falharam`);
  if (falhou > 0) {
    console.log('\nFalhas:');
    falhas.forEach((f2) => console.log(`  ✗ ${f2}`));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES DA FASE A PASSARAM');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('Erro fatal do smoke FASE A:', e);
  await limpezaEmergencia();
  process.exit(1);
});
