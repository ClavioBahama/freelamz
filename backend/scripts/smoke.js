/* ============================================================
   FreelaMZ — Smoke test da API (fluxo completo C + permissões)
   Executar: npm run smoke   (backend precisa de estar a rodar)
   Cria utilizadores de teste únicos (email com timestamp) e
   limpa-os no fim — pode ser executado repetidamente.
   ============================================================ */
const BASE = process.env.API_URL || 'http://localhost:3000/api';
const TS = Date.now();

let passou = 0;
let falhou = 0;
const falhas = [];

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
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* resposta vazia */ }
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: { message: e.message } };
  }
}

/* Pedido multipart (uploads de imagem) */
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
    try { data = await res.json(); } catch (e) { /* resposta vazia */ }
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: { message: e.message } };
  }
}

/* PNG 1x1 válido (magic bytes reais) para testes de upload */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/* Limpeza de EMERGÊNCIA: se o teste morrer a meio (exceção antes da
   secção de limpeza), apaga as contas criadas para não ficarem na BD.
   Tenta entrar como admin (credenciais de dev conhecidas do .env). */
const CRIADOS = [];
async function limpezaEmergencia() {
  if (!CRIADOS.length) return;
  try {
    const adm = await req('POST', '/auth/login', {
      body: {
        email: process.env.ADMIN_EMAIL || 'admin@freelamz.com',
        senha: process.env.ADMIN_SENHA || 'Admin@12345',
      },
    });
    const tok = adm.data && adm.data.token;
    if (!tok) return;
    for (const id of CRIADOS) {
      await req('DELETE', `/admin/users/${id}`, { token: tok });
    }
    console.log(`[limpeza] ${CRIADOS.length} conta(s) de teste removida(s) após falha`);
  } catch (e) { /* melhor esforço */ }
}

async function main() {
  console.log('\n════════ FREELAMZ — SMOKE TEST DA API ════════');
  console.log(`Alvo: ${BASE}\n`);

  /* ---------- 0. Saúde ---------- */
  console.log('[0] Saúde da API');
  const health = await req('GET', '/health');
  check('GET /health responde ok', health.status === 200 && health.data.success === true,
    `status=${health.status}`);

  /* ---------- 1. Registo e login (fluxo C) ---------- */
  console.log('\n[1] Registo e autenticação');
  const EMAIL_CLI = `smoke.cliente.${TS}@freelamz.com`;
  const EMAIL_FRE = `smoke.freela.${TS}@freelamz.com`;
  const SENHA = 'Smoke@123';

  const regCli = await req('POST', '/auth/register', {
    body: {
      nome: 'Cliente Smoke', email: EMAIL_CLI, telefone: '+258 84 000 0001',
      senha: SENHA, tipoUsuario: 'CLIENTE', cidade: 'Maputo', provincia: 'Maputo',
    },
  });
  check('Registo de cliente → 201 + token', regCli.status === 201 && !!regCli.data.token, `status=${regCli.status} ${regCli.data.message || ''}`);

  const regFre = await req('POST', '/auth/register', {
    body: {
      nome: 'Freelancer Smoke', email: EMAIL_FRE, telefone: '+258 84 000 0002',
      senha: SENHA, tipoUsuario: 'FREELANCER', cidade: 'Maputo', provincia: 'Maputo',
    },
  });
  check('Registo de freelancer → 201 + token', regFre.status === 201 && !!regFre.data.token, `status=${regFre.status} ${regFre.data.message || ''}`);

  const regDup = await req('POST', '/auth/register', {
    body: { nome: 'Dup', email: EMAIL_CLI, senha: SENHA, tipoUsuario: 'CLIENTE' },
  });
  check('Email duplicado → 409', regDup.status === 409, `status=${regDup.status}`);

  const loginErrado = await req('POST', '/auth/login', { body: { email: EMAIL_CLI, senha: 'errada' } });
  check('Senha errada → 401', loginErrado.status === 401, `status=${loginErrado.status}`);

  const loginCli = await req('POST', '/auth/login', { body: { email: EMAIL_CLI, senha: SENHA } });
  check('Login do cliente', loginCli.status === 200 && !!loginCli.data.token, `status=${loginCli.status}`);
  const loginFre = await req('POST', '/auth/login', { body: { email: EMAIL_FRE, senha: SENHA } });
  check('Login do freelancer', loginFre.status === 200 && !!loginFre.data.token, `status=${loginFre.status}`);

  const tokCli = loginCli.data.token;
  const tokFre = loginFre.data.token;
  const cliId = loginCli.data.user.id;
  const freId = loginFre.data.user.id;
  CRIADOS.push(cliId, freId); /* para a limpeza de emergência */

  const semToken = await req('GET', '/users/dashboard');
  check('Sem token → 401', semToken.status === 401, `status=${semToken.status}`);

  /* ---------- 2. Explorar (freelancers, categorias, serviços, busca) ---------- */
  console.log('\n[2] Explorar o marketplace');
  const freelancers = await req('GET', '/users/freelancers', { token: tokCli });
  check('GET /users/freelancers → 10+ freelancers', freelancers.status === 200 && (freelancers.data.freelancers || []).length >= 10,
    `status=${freelancers.status} total=${(freelancers.data.freelancers || []).length}`);
  const freelaSeed = (freelancers.data.freelancers || []).find((f) => f.email === 'freela@freelamz.com');
  check('Seed: freela@freelamz.com visível com perfil', !!freelaSeed && !!freelaSeed.titulo, freelaSeed ? 'sem titulo' : 'não encontrado');

  const cats = await req('GET', '/categories');
  check('GET /categories → 10+ categorias', cats.status === 200 && (cats.data.categories || []).length >= 10,
    `total=${(cats.data.categories || []).length}`);
  const catWeb = (cats.data.categories || []).find((c) => c.nome === 'Desenvolvimento Web');

  const servicos = await req('GET', '/services', { token: tokCli });
  check('GET /services → 15+ serviços', servicos.status === 200 && (servicos.data.services || []).length >= 15,
    `total=${(servicos.data.services || []).length}`);

  const porCat = await req('GET', `/services?categoria=${catWeb.id}`, { token: tokCli });
  const todosDaCat = (porCat.data.services || []).every((s) => s.categoria_id === catWeb.id);
  check('Filtro por categoria funciona', porCat.status === 200 && (porCat.data.services || []).length > 0 && todosDaCat,
    `total=${(porCat.data.services || []).length}`);

  const busca = await req('GET', '/services?busca=loja', { token: tokCli });
  const achouLoja = (busca.data.services || []).some((s) => (s.titulo || '').toLowerCase().includes('loja'));
  check('Busca por texto funciona', busca.status === 200 && achouLoja, `total=${(busca.data.services || []).length}`);

  const svcSeed = (servicos.data.services || []).find((s) => s.freelancer_id === freelaSeed.user_id);
  const det = await req('GET', `/services/${svcSeed.id}`, { token: tokCli });
  check('GET /services/:id → detalhe', det.status === 200 && det.data.service && det.data.service.id === svcSeed.id, `status=${det.status}`);

  const detFreelancer = await req('GET', `/users/freelancers/${freelaSeed.user_id}`, { token: tokCli });
  check('GET /users/freelancers/:id → perfil', detFreelancer.status === 200 && !!detFreelancer.data.profile, `status=${detFreelancer.status}`);

  /* ---------- 3. Favoritos ---------- */
  console.log('\n[3] Favoritos');
  const addFav = await req('POST', '/favorites', { token: tokCli, body: { tipo: 'freelancer', alvo_id: freelaSeed.user_id } });
  check('Favoritar freelancer', addFav.status === 200 && addFav.data.success === true, `status=${addFav.status}`);

  const isFav = await req('GET', `/favorites/is-favorite?tipo=freelancer&alvo_id=${freelaSeed.user_id}`, { token: tokCli });
  check('is-favorite confirma', isFav.status === 200 && isFav.data.favorito === true, `status=${isFav.status} favorito=${isFav.data.favorito}`);

  const listaFav = await req('GET', '/favorites?tipo=freelancer', { token: tokCli });
  const contemFav = (listaFav.data.itens || []).some((i) => Number(i.id) === Number(freelaSeed.user_id));
  check('GET /favorites lista o favorito', listaFav.status === 200 && contemFav, `status=${listaFav.status}`);

  /* ---------- 4. Freelancer prepara perfil e serviço ---------- */
  console.log('\n[4] Perfil e serviço do freelancer');
  const perfil = await req('PUT', '/users/profile', {
    token: tokFre,
    body: {
      titulo: 'Dev de Testes Smoke', descricao: 'Crio testes automatizados e sites.',
      habilidades: 'Node.js,Testing', experiencia: '2 anos', idiomas: 'Português', preco_por_hora: 800,
    },
  });
  check('PUT /users/profile → 200', perfil.status === 200, `status=${perfil.status} ${perfil.data.message || ''}`);

  const svcBody = {
    titulo: `Serviço Smoke ${TS}`, descricao: 'Serviço criado pelo teste automatizado.',
    categoria_id: catWeb.id, preco: 5000, prazo_entrega: '3 dias',
  };
  const svcNovo = await req('POST', '/services', { token: tokFre, body: svcBody });
  check('POST /services (freelancer) → 201', svcNovo.status === 201 && !!svcNovo.data.service, `status=${svcNovo.status}`);
  const svcId = svcNovo.data.service && svcNovo.data.service.id;

  const svcCliente = await req('POST', '/services', { token: tokCli, body: svcBody });
  check('Cliente não publica serviço → 403', svcCliente.status === 403, `status=${svcCliente.status}`);

  const svcEdit = await req('PUT', `/services/${svcId}`, { token: tokFre, body: { ...svcBody, preco: 5500, status: 'ativo' } });
  check('PUT /services/:id (dono) → 200', svcEdit.status === 200, `status=${svcEdit.status}`);

  const svcEditOutro = await req('PUT', `/services/${svcSeed.id}`, { token: tokFre, body: { titulo: 'x', descricao: 'x', categoria_id: catWeb.id, preco: 1, prazo_entrega: '1 dia', status: 'ativo' } });
  check('Editar serviço alheio → 404', svcEditOutro.status === 404, `status=${svcEditOutro.status}`);

  /* ---------- 5. Cliente cria projeto; freelancer propõe ---------- */
  console.log('\n[5] Projeto → proposta → aceitação');
  const projNovo = await req('POST', '/projects', {
    token: tokCli,
    body: { freelancerId: freId, servicoId: svcId, valor: 5000, prazo: '5 dias' },
  });
  check('POST /projects (cliente) → 201 PENDENTE', projNovo.status === 201 && projNovo.data.project.status === 'PENDENTE', `status=${projNovo.status}`);
  const projId = projNovo.data.project && projNovo.data.project.id;

  const propCliente = await req('POST', '/proposals', { token: tokCli, body: { projeto_id: projId, preco: 100, prazo: '1 dia' } });
  check('Cliente não envia proposta → 403', propCliente.status === 403, `status=${propCliente.status}`);

  const propNova = await req('POST', '/proposals', {
    token: tokFre,
    body: { projeto_id: projId, preco: 4500, prazo: '4 dias', mensagem: 'Proposta do teste smoke.' },
  });
  check('POST /proposals (freelancer) → 201', propNova.status === 201 && !!propNova.data.proposal, `status=${propNova.status}`);
  const propId = propNova.data.proposal && propNova.data.proposal.id;

  const listaCli = await req('GET', '/proposals/me/cliente', { token: tokCli });
  const listaFre = await req('GET', '/proposals/me/freelancer', { token: tokFre });
  check('GET /proposals/me/cliente (era 500) → contém proposta', listaCli.status === 200 && (listaCli.data.proposals || []).some((p) => p.id === propId), `status=${listaCli.status}`);
  check('GET /proposals/me/freelancer (era 500) → contém proposta', listaFre.status === 200 && (listaFre.data.proposals || []).some((p) => p.id === propId), `status=${listaFre.status}`);

  /* ---------- 6. Permissões da proposta ---------- */
  const aceitarComoFre = await req('PUT', `/proposals/${propId}/status`, { token: tokFre, body: { status: 'ACEITA' } });
  check('Freelancer não aceita a própria proposta → 403', aceitarComoFre.status === 403, `status=${aceitarComoFre.status}`);

  const cancelarComoCli = await req('PUT', `/proposals/${propId}/status`, { token: tokCli, body: { status: 'CANCELADA' } });
  check('Cliente não cancela proposta alheia → 403', cancelarComoCli.status === 403, `status=${cancelarComoCli.status}`);

  /* ---------- 7. Aceitar proposta → projeto AGUARDA PAGAMENTO ---------- */
  const projsAntes = (await req('GET', '/projects', { token: tokCli })).data.projects || [];
  const aceitar = await req('PUT', `/proposals/${propId}/status`, { token: tokCli, body: { status: 'ACEITA' } });
  check('Cliente aceita proposta → 200', aceitar.status === 200 && aceitar.data.proposal.status === 'ACEITA', `status=${aceitar.status}`);

  const projDepois = await req('GET', `/projects/${projId}`, { token: tokCli });
  const p = projDepois.data.project || {};
  check('Projeto ficou AGUARDANDO_PAGAMENTO (FASE A)', p.status === 'AGUARDANDO_PAGAMENTO', `status=${p.status}`);
  check('Escrow criado como AGUARDANDO_PAGAMENTO', projDepois.data.escrow && projDepois.data.escrow.status === 'AGUARDANDO_PAGAMENTO',
    `escrow=${projDepois.data.escrow && projDepois.data.escrow.status}`);
  check('Projeto vinculado à proposta (proposta_id)', Number(p.proposta_id) === Number(propId), `proposta_id=${p.proposta_id}`);
  check('Projeto assumiu valor da proposta', Number(p.valor) === 4500, `valor=${p.valor}`);
  const projsNovos = (await req('GET', '/projects', { token: tokCli })).data.projects || [];
  check('Não duplicou projeto', projsNovos.length === projsAntes.length, `antes=${projsAntes.length} depois=${projsNovos.length}`);

  /* ---------- 8. Mensagens ---------- */
  console.log('\n[6] Mensagens');
  const msg1 = await req('POST', '/messages', {
    token: tokCli, body: { destinatario_id: freId, projeto_id: projId, texto: 'Olá! Vamos começar?' },
  });
  check('Cliente envia mensagem', msg1.status === 201, `status=${msg1.status}`);
  const msg2 = await req('POST', '/messages', {
    token: tokFre, body: { destinatario_id: cliId, projeto_id: projId, texto: 'Claro! Começo hoje.' },
  });
  check('Freelancer responde', msg2.status === 201, `status=${msg2.status}`);

  const conv = await req('GET', `/messages/conversation?destinatario_id=${freId}&projeto_id=${projId}`, { token: tokCli });
  check('GET /messages/conversation → 2 mensagens', conv.status === 200 && (conv.data.mensagens || []).length >= 2, `status=${conv.status} total=${(conv.data.mensagens || []).length}`);

  const convs = await req('GET', '/messages/conversations', { token: tokCli });
  check('GET /messages/conversations → 1 conversa', convs.status === 200 && (convs.data.conversas || []).length >= 1, `status=${convs.status}`);

  /* ---------- 9. Pagar, entregar, aprovar dos dois lados (FASE A) ---------- */
  console.log('\n[7] Pagamento com escrow, entrega e aprovação dos dois lados');

  // Freelancer NÃO consegue entregar sem pagamento
  const entregarSemPagar = await reqForm('POST', `/projects/${projId}/deliveries`, {
    token: tokFre, campos: { mensagem: 'entrega antes do pagamento' },
  });
  check('Freelancer não entrega sem pagamento → 403', entregarSemPagar.status === 403, `status=${entregarSemPagar.status}`);

  // recarregar saldo fictício e pagar com saldo
  const recarga = await req('POST', '/payments/wallet/recharge', { token: tokCli, body: { valor: 10000 } });
  check('Recarga fictícia da carteira → 200', recarga.status === 200 && recarga.data.saldo >= 1000000, `status=${recarga.status}`);
  const saldosAntes = (await req('GET', '/payments/wallet', { token: tokCli })).data.wallet.saldo;

  const pagar = await req('POST', '/payments/pay', { token: tokCli, body: { projectId: projId, metodo: 'SALDO' } });
  check('Cliente paga com saldo → 200', pagar.status === 200 && pagar.data.escrow.status === 'RETIDO', `status=${pagar.status}`);
  const projPago = await req('GET', `/projects/${projId}`, { token: tokCli });
  check('Projeto passou a EM_ANDAMENTO', projPago.data.project.status === 'EM_ANDAMENTO', `status=${projPago.data.project.status}`);
  check('Escrow RETIDO com valor e comissão', projPago.data.escrow.status === 'RETIDO'
    && Number(projPago.data.escrow.amount_held) === 450000
    && Number(projPago.data.escrow.platform_fee) === 45000,
    `held=${projPago.data.escrow.amount_held} fee=${projPago.data.escrow.platform_fee}`);
  const saldosDepois = (await req('GET', '/payments/wallet', { token: tokCli })).data.wallet.saldo;
  check('Saldo do cliente debitado (4500 MT)', saldosAntes - saldosDepois === 450000, `antes=${saldosAntes} depois=${saldosDepois}`);

  const pagar2x = await req('POST', '/payments/pay', { token: tokCli, body: { projectId: projId, metodo: 'SALDO' } });
  check('Pagar duas vezes → 409 (idempotência)', pagar2x.status === 409, `status=${pagar2x.status}`);

  const convPago = await req('GET', `/messages/conversation?destinatario_id=${freId}&projeto_id=${projId}`, { token: tokCli });
  const temMsgSistema = (convPago.data.mensagens || []).some((m) => m.tipo === 'SISTEMA' && /retido/i.test(m.texto || ''));
  check('Mensagem de sistema sobre pagamento no chat', temMsgSistema, `total=${(convPago.data.mensagens || []).length}`);

  // PDF de teste (magic bytes %PDF-)
  const PDF_TESTE = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n', 'utf-8');

  const entrega1 = await reqForm('POST', `/projects/${projId}/deliveries`, {
    token: tokFre,
    campos: { mensagem: 'Primeira entrega do projeto.', links: JSON.stringify(['https://exemplo.mz/entrega']) },
    ficheiros: [{ campo: 'arquivos', dados: PDF_TESTE, tipo: 'application/pdf', nome: 'entrega.pdf' }],
  });
  check('Freelancer entrega com ficheiro → 201 ENTREGUE', entrega1.status === 201 && entrega1.data.project.status === 'ENTREGUE',
    `status=${entrega1.status} ${entrega1.data.message || ''}`);
  check('Entrega numerada #1', entrega1.data.delivery && entrega1.data.delivery.numero === 1, `numero=${entrega1.data.delivery && entrega1.data.delivery.numero}`);

  const arquivoExe = Buffer.concat([Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00'), Buffer.alloc(64, 7)]);
  const entregaExe = await reqForm('POST', `/projects/${projId}/deliveries`, {
    token: tokFre, campos: { mensagem: 'tentativa exe' },
    ficheiros: [{ campo: 'arquivos', dados: arquivoExe, tipo: 'application/x-msdownload', nome: 'virus.pdf' }],
  });
  check('EXE renomeado .pdf → 400 (magic bytes)', entregaExe.status === 400, `status=${entregaExe.status}`);

  // cliente pede revisão (motivo obrigatório)
  const revisaoSemMotivo = await req('POST', `/projects/${projId}/deliveries/1/revision`, { token: tokCli, body: {} });
  check('Revisão sem motivo → 400', revisaoSemMotivo.status === 400, `status=${revisaoSemMotivo.status}`);
  const revisao = await req('POST', `/projects/${projId}/deliveries/1/revision`, {
    token: tokCli, body: { motivo: 'Falta a página de contactos.' },
  });
  check('Cliente pede revisão → EM_ANDAMENTO', revisao.status === 200 && revisao.data.status === 'EM_ANDAMENTO', `status=${revisao.status}`);

  const entrega2 = await reqForm('POST', `/projects/${projId}/deliveries`, {
    token: tokFre, campos: { mensagem: 'Segunda entrega com a correção.' },
    ficheiros: [{ campo: 'arquivos', dados: PDF_TESTE, tipo: 'application/pdf', nome: 'entrega-v2.pdf' }],
  });
  check('Segunda entrega numerada #2', entrega2.status === 201 && entrega2.data.delivery.numero === 2, `status=${entrega2.status}`);

  // aprovação dos dois lados
  const aprovar = await req('POST', `/projects/${projId}/deliveries/2/approve`, { token: tokCli });
  check('Cliente aprova a entrega', aprovar.status === 200 && aprovar.data.aprovado === true, `status=${aprovar.status}`);
  const escAposCliente = await req('GET', `/projects/${projId}`, { token: tokCli });
  check('Só o cliente aprovou → escrow AINDA RETIDO', escAposCliente.data.escrow.status === 'RETIDO'
    && escAposCliente.data.project.status === 'ENTREGUE',
    `escrow=${escAposCliente.data.escrow.status}`);

  const saldoFreAntes = (await req('GET', '/payments/wallet', { token: tokFre })).data.wallet.saldo;
  const confirmar = await req('POST', `/projects/${projId}/confirm`, { token: tokFre });
  check('Freelancer confirma → LIBERADO', confirmar.status === 200 && confirmar.data.liberado === true, `status=${confirmar.status} ${confirmar.data.message || ''}`);
  const projFim = await req('GET', `/projects/${projId}`, { token: tokFre });
  check('Projeto CONCLUIDO + escrow LIBERADO', projFim.data.project.status === 'CONCLUIDO' && projFim.data.escrow.status === 'LIBERADO',
    `proj=${projFim.data.project.status} escrow=${projFim.data.escrow.status}`);
  const saldoFreDepois = (await req('GET', '/payments/wallet', { token: tokFre })).data.wallet.saldo;
  check('Freelancer recebeu líquido de 4050 MT (4500 − 10%)', saldoFreDepois - saldoFreAntes === 405000,
    `antes=${saldoFreAntes} depois=${saldoFreDepois}`);
  const extratoFre = await req('GET', '/payments/wallet/transactions?tipo=LIBERACAO_ESCROW', { token: tokFre });
  check('Livro-razão tem a liberação', extratoFre.status === 200 && (extratoFre.data.transacoes || []).length >= 1
    && Number(extratoFre.data.transacoes[0].valor) === 405000, `total=${(extratoFre.data.transacoes || []).length}`);

  const confirmar2x = await req('POST', `/projects/${projId}/confirm`, { token: tokFre });
  check('Liberar duas vezes → 409', confirmar2x.status === 409, `status=${confirmar2x.status}`);

  const avaliarAntes = await req('POST', '/reviews', { token: tokCli, body: { projeto_id: projId, avaliado_id: freId, nota: 5, comentario: 'Excelente trabalho!' } });
  check('Avaliação após conclusão → 201', avaliarAntes.status === 201, `status=${avaliarAntes.status} ${avaliarAntes.data.message || ''}`);

  const avaliarDup = await req('POST', '/reviews', { token: tokCli, body: { projeto_id: projId, avaliado_id: freId, nota: 4, comentario: 'dup' } });
  check('Avaliação duplicada → 409', avaliarDup.status === 409, `status=${avaliarDup.status}`);

  const reviewsFre = await req('GET', `/reviews/user/${freId}`);
  check('GET /reviews/user/:id lista a avaliação', reviewsFre.status === 200 && (reviewsFre.data.reviews || []).some((r) => r.projeto_id === projId), `status=${reviewsFre.status}`);

  const ratingFre = await req('GET', `/reviews/rating/${freId}`);
  check('Média de avaliações = 5', ratingFre.status === 200 && Number(ratingFre.data.rating.media) === 5, `media=${ratingFre.data.rating && ratingFre.data.rating.media}`);

  const perfilFre = await req('GET', `/users/freelancers/${freId}`, { token: tokCli });
  check('Perfil do freelancer reflete a nota', perfilFre.status === 200 && Number(perfilFre.data.profile.classificacao) === 5,
    `classificacao=${perfilFre.data.profile && perfilFre.data.profile.classificacao}`);

  /* ---------- 10. Notificações ---------- */
  console.log('\n[8] Notificações');
  const notifs = await req('GET', '/notifications', { token: tokFre });
  const tipos = (notifs.data.notifications || []).map((n) => n.tipo);
  check('Freelancer tem notificações do fluxo', notifs.status === 200
    && tipos.includes('proposta_aceita') && tipos.includes('nova_avaliacao'), `tipos=${tipos.slice(0, 6).join(',')}`);

  const naoLidas = await req('GET', '/notifications/unread-count', { token: tokFre });
  check('unread-count > 0', naoLidas.status === 200 && naoLidas.data.total > 0, `total=${naoLidas.data.total}`);

  const lerTodas = await req('PUT', '/notifications/read-all', { token: tokFre });
  const naoLidas2 = await req('GET', '/notifications/unread-count', { token: tokFre });
  check('read-all zera não lidas', lerTodas.status === 200 && naoLidas2.data.total === 0, `restantes=${naoLidas2.data.total}`);

  /* ---------- 11. Dashboards ---------- */
  console.log('\n[9] Dashboards');
  const dashFre = await req('GET', '/users/dashboard', { token: tokFre });
  check('Dashboard freelancer: ganhos > 0', dashFre.status === 200 && dashFre.data.dashboard.valor_total_concluido > 0,
    `ganhos=${dashFre.data.dashboard && dashFre.data.dashboard.valor_total_concluido}`);
  check('Dashboard freelancer: 1 concluído, rating 5',
    dashFre.data.dashboard.projetos_concluidos === 1 && Number(dashFre.data.dashboard.rating.media) === 5,
    `concluidos=${dashFre.data.dashboard.projetos_concluidos} rating=${dashFre.data.dashboard.rating.media}`);

  const dashCli = await req('GET', '/users/dashboard', { token: tokCli });
  check('Dashboard cliente: gastos > 0', dashCli.status === 200 && dashCli.data.dashboard.valor_total_concluido > 0,
    `gastos=${dashCli.data.dashboard && dashCli.data.dashboard.valor_total_concluido}`);

  /* ---------- 12. Permissões de admin ---------- */
  console.log('\n[10] Permissões de administrador');
  const adminCli = await req('GET', '/admin/stats', { token: tokCli });
  check('Cliente em /admin → 403', adminCli.status === 403, `status=${adminCli.status}`);
  const adminFre = await req('GET', '/admin/stats', { token: tokFre });
  check('Freelancer em /admin → 403', adminFre.status === 403, `status=${adminFre.status}`);

  /* ---------- 13. Painel admin ---------- */
  const loginAdmin = await req('POST', '/auth/login', {
    body: { email: process.env.ADMIN_EMAIL || 'admin@freelamz.com', senha: process.env.ADMIN_PASSWORD || 'Admin@12345' },
  });
  check('Login do admin', loginAdmin.status === 200 && loginAdmin.data.user.tipo_usuario === 'ADMIN', `status=${loginAdmin.status}`);
  const tokAdm = loginAdmin.data.token;

  const statsAdm = await req('GET', '/admin/stats', { token: tokAdm });
  const st = statsAdm.data.stats || {};
  check('Admin stats globais', statsAdm.status === 200 && st.total_usuarios > 0 && st.denuncias_pendentes >= 0
    && typeof st.total_propostas === 'number' && typeof st.total_avaliacoes === 'number',
    `usuarios=${st.total_usuarios} propostas=${st.total_propostas}`);

  const usersAdm = await req('GET', '/admin/users?limit=100', { token: tokAdm });
  const achouCli = (usersAdm.data.users || []).some((u) => u.id === cliId);
  const achouFre = (usersAdm.data.users || []).some((u) => u.id === freId);
  check('Admin lista utilizadores (inclui testes)', usersAdm.status === 200 && achouCli && achouFre, `status=${usersAdm.status}`);

  const editAdm = await req('PUT', `/admin/users/${cliId}`, { token: tokAdm, body: { cidade: 'Beira' } });
  check('Admin edita utilizador', editAdm.status === 200 && editAdm.data.user.cidade === 'Beira', `status=${editAdm.status}`);

  const editTipo = await req('PUT', `/admin/users/${cliId}`, { token: tokAdm, body: { tipo_usuario: 'FREELANCER' } });
  check('Admin muda tipo do utilizador', editTipo.status === 200 && editTipo.data.user.tipo_usuario === 'FREELANCER', `status=${editTipo.status}`);
  const editVolta = await req('PUT', `/admin/users/${cliId}`, { token: tokAdm, body: { tipo_usuario: 'CLIENTE' } });
  check('Admin muda tipo de volta', editVolta.status === 200 && editVolta.data.user.tipo_usuario === 'CLIENTE', `status=${editVolta.status}`);

  const propsAdm = await req('GET', '/admin/proposals', { token: tokAdm });
  const revsAdm = await req('GET', '/admin/reviews', { token: tokAdm });
  const projsAdm = await req('GET', '/admin/projects', { token: tokAdm });
  check('Admin lista propostas/avaliações/projetos', propsAdm.status === 200 && revsAdm.status === 200 && projsAdm.status === 200,
    `p=${propsAdm.status} r=${revsAdm.status} pr=${projsAdm.status}`);

  const relatorios = await req('GET', '/admin/reports', { token: tokAdm });
  const pendente = (relatorios.data.reports || []).find((r) => r.status === 'PENDENTE');
  check('Admin lista denúncias (com pendentes do seed)', relatorios.status === 200 && !!pendente, `status=${relatorios.status} pendentes=${(relatorios.data.reports || []).filter((r) => r.status === 'PENDENTE').length}`);

  if (pendente) {
    const resolver = await req('PUT', `/admin/reports/${pendente.id}`, { token: tokAdm, body: { status: 'RESOLVIDA' } });
    check('Admin resolve denúncia', resolver.status === 200 && resolver.data.report.status === 'RESOLVIDA', `status=${resolver.status}`);
    const reverter = await req('PUT', `/admin/reports/${pendente.id}`, { token: tokAdm, body: { status: 'PENDENTE' } });
    check('Denúncia revertida para PENDENTE (seed intacto)', reverter.status === 200 && reverter.data.report.status === 'PENDENTE', `status=${reverter.status}`);
  }

  // Admin recusa uma proposta de teste (novo par projeto+proposta)
  const proj2 = await req('POST', '/projects', {
    token: tokCli, body: { freelancerId: freId, servicoId: svcId, valor: 1200, prazo: '2 dias' },
  });
  const prop2 = await req('POST', '/proposals', {
    token: tokFre, body: { projeto_id: proj2.data.project.id, preco: 1000, prazo: '2 dias', mensagem: 'Segunda proposta smoke' },
  });
  const recusar = await req('PUT', `/admin/proposals/${prop2.data.proposal.id}/status`, { token: tokAdm, body: { status: 'RECUSADA' } });
  check('Admin altera status de proposta', recusar.status === 200 && recusar.data.proposal.status === 'RECUSADA', `status=${recusar.status}`);

  /* ---------- 14. Bloqueio ---------- */
  console.log('\n[11] Bloqueio de utilizador');
  const bloquear = await req('PUT', `/admin/users/${cliId}/block`, { token: tokAdm });
  check('Admin bloqueia utilizador', bloquear.status === 200, `status=${bloquear.status}`);
  const loginBloqueado = await req('POST', '/auth/login', { body: { email: EMAIL_CLI, senha: SENHA } });
  check('Utilizador bloqueado não entra → 403', loginBloqueado.status === 403, `status=${loginBloqueado.status}`);
  const desbloquear = await req('PUT', `/admin/users/${cliId}/unblock`, { token: tokAdm });
  const loginVoltou = await req('POST', '/auth/login', { body: { email: EMAIL_CLI, senha: SENHA } });
  check('Desbloqueado volta a entrar', desbloquear.status === 200 && loginVoltou.status === 200, `login=${loginVoltou.status}`);

  /* ---------- 16. Contas ricas: perfil, uploads, portfólio, selos ---------- */
  console.log('\n[12] Contas ricas — dados, uploads, portfólio e selos');

  // dados gerais + sanitização XSS
  const meUp = await req('PUT', '/users/me', {
    token: tokFre,
    body: {
      nome: 'Freelancer Smoke', nome_utilizador: `smoke.freela.${TS}`,
      bio: 'Bio <script>alert(1)</script>do smoke',
      sobre_mim: 'Sobre <b>com tags</b> do smoke',
      whatsapp: '+258 84 000 0002', idiomas: 'Português, Inglês, Português',
      linkedin: 'https://linkedin.com/in/smoke',
    },
  });
  check('PUT /users/me dados gerais → 200', meUp.status === 200, `status=${meUp.status} ${meUp.data.message || ''}`);
  check('Bio sanitizada (sem <script>)', !(meUp.data.user && (meUp.data.user.bio || '').includes('<script')),
    `bio=${meUp.data.user && meUp.data.user.bio}`);
  check('Sobre sanitizado (tags removidas)', !(meUp.data.user && (meUp.data.user.sobre_mim || '').includes('<b>')),
    `sobre=${meUp.data.user && meUp.data.user.sobre_mim}`);
  check('Idiomas sem duplicados', (meUp.data.user.idiomas || '').split(',').length === 2, `idiomas=${meUp.data.user.idiomas}`);

  // validações que devem falhar
  const usernameDup = await req('PUT', '/users/me', { token: tokFre, body: { nome_utilizador: 'isabel.sitoe' } });
  check('Username já em uso → 409', usernameDup.status === 409, `status=${usernameDup.status}`);
  const telInvalido = await req('PUT', '/users/me', { token: tokFre, body: { telefone: '12345' } });
  check('Telefone inválido → 400', telInvalido.status === 400, `status=${telInvalido.status}`);
  const urlInvalida = await req('PUT', '/users/me', { token: tokFre, body: { site_pessoal: 'ftp://invalido.co.mz' } });
  check('URL não http(s) → 400', urlInvalida.status === 400, `status=${urlInvalida.status}`);

  // senha
  const senhaErrada = await req('PUT', '/users/me/password', { token: tokFre, body: { senhaAtual: 'errada', novaSenha: 'NovaSenha@123' } });
  check('Senha atual errada → 403', senhaErrada.status === 403, `status=${senhaErrada.status}`);
  const senhaCurta = await req('PUT', '/users/me/password', { token: tokFre, body: { senhaAtual: SENHA, novaSenha: 'curta' } });
  check('Nova senha curta → 400', senhaCurta.status === 400, `status=${senhaCurta.status}`);
  const senhaOk = await req('PUT', '/users/me/password', { token: tokFre, body: { senhaAtual: SENHA, novaSenha: 'NovaSmoke@123' } });
  check('Alterar senha → 200', senhaOk.status === 200, `status=${senhaOk.status}`);

  // uploads de avatar
  const avatarOk = await reqForm('POST', '/users/me/avatar', {
    token: tokFre,
    ficheiros: [{ campo: 'imagem', nome: 'foto.png', tipo: 'image/png', dados: PNG_1PX }],
  });
  check('Upload de avatar válido → 200 + WEBP', avatarOk.status === 200
    && typeof avatarOk.data.url === 'string' && avatarOk.data.url.startsWith('/uploads/avatars/'),
    `status=${avatarOk.status} url=${avatarOk.data.url || ''}`);

  const avatarGrande = await reqForm('POST', '/users/me/avatar', {
    token: tokFre,
    ficheiros: [{ campo: 'imagem', nome: 'grande.png', tipo: 'image/png', dados: Buffer.alloc(3 * 1024 * 1024, 1) }],
  });
  check('Avatar > 2 MB → 400', avatarGrande.status === 400, `status=${avatarGrande.status} msg=${avatarGrande.data.message || ''}`);

  const avatarExe = await reqForm('POST', '/users/me/avatar', {
    token: tokFre,
    ficheiros: [{ campo: 'imagem', nome: 'malicioso.png', tipo: 'image/png', dados: Buffer.from('MZ...isto não é uma imagem, é um EXE renomeado') }],
  });
  check('EXE renomeado .png → 400 (magic bytes)', avatarExe.status === 400, `status=${avatarExe.status} msg=${avatarExe.data.message || ''}`);

  const capaOk = await reqForm('POST', '/users/me/cover', {
    token: tokFre,
    ficheiros: [{ campo: 'imagem', nome: 'capa.png', tipo: 'image/png', dados: PNG_1PX }],
  });
  check('Upload de capa → 200 + /uploads/covers/', capaOk.status === 200
    && typeof capaOk.data.url === 'string' && capaOk.data.url.startsWith('/uploads/covers/'),
    `status=${capaOk.status} url=${capaOk.data.url || ''}`);

  const meDepois = await req('GET', '/auth/me', { token: tokFre });
  check('GET /auth/me devolve foto e capa', meDepois.status === 200 && !!meDepois.data.user.foto && !!meDepois.data.user.capa,
    `foto=${meDepois.data.user && meDepois.data.user.foto}`);
  check('auth/me não devolve senha_hash', !(meDepois.data.user && ('senha_hash' in meDepois.data.user)), 'senha_hash presente!');

  // verificação de telefone (DEV: 123456)
  const codigo = await req('POST', '/users/me/phone/request-code', { token: tokFre });
  check('Pedir código de telefone → 200 + codigo_dev', codigo.status === 200 && codigo.data.codigo_dev === '123456', `status=${codigo.status}`);
  const codigoErrado = await req('POST', '/users/me/phone/verify', { token: tokFre, body: { codigo: '000000' } });
  check('Código errado → 400', codigoErrado.status === 400, `status=${codigoErrado.status}`);
  const codigoOk = await req('POST', '/users/me/phone/verify', { token: tokFre, body: { codigo: '123456' } });
  check('Código 123456 → telefone verificado', codigoOk.status === 200 && codigoOk.data.user.telefone_verificado === 1,
    `status=${codigoOk.status}`);

  // perfil profissional rico
  const perfilRico = await req('PUT', '/users/profile', {
    token: tokFre,
    body: {
      titulo: 'Dev de Testes Smoke', descricao: 'Crio testes automatizados e sites.',
      habilidades: 'Node.js,Testing', experiencia: '2 anos', idiomas: 'Português',
      preco_por_hora: 800, nivel: 'especialista', anos_experiencia: 6,
      educacao: [{ titulo: 'Engenharia Informática', local: 'UEM', periodo: '2015-2019', descricao: 'Testes de software' }],
      experiencia_prof: [{ titulo: 'QA Engineer', local: 'TechMZ', periodo: '2020-atual' }],
      certificacoes: [{ titulo: 'ISTQB Foundation', local: 'ISTQB', periodo: '2022' }],
      metodos_recebimento: { mpesa: '+258 84 000 0002', banco: 'BCI 12345' },
    },
  });
  check('PUT /users/profile rico → 200', perfilRico.status === 200, `status=${perfilRico.status} ${perfilRico.data.message || ''}`);
  const pr = perfilRico.data.profile || {};
  check('Perfil reflete nível/anos/JSONs', pr.nivel === 'especialista' && Number(pr.anos_experiencia) === 6
    && (pr.educacao || []).length === 1 && (pr.metodos_recebimento || {}).mpesa,
    `nivel=${pr.nivel} anos=${pr.anos_experiencia} educ=${(pr.educacao || []).length}`);

  const perfilCliente = await req('PUT', '/users/profile', { token: tokCli, body: { nome: 'Cliente Smoke Rico' } });
  check('PUT /users/profile (cliente) → 200 user', perfilCliente.status === 200 && !!perfilCliente.data.user, `status=${perfilCliente.status}`);

  const nivelInvalido = await req('PUT', '/users/profile', { token: tokFre, body: { nivel: 'guru' } });
  check('Nível inválido → 400', nivelInvalido.status === 400, `status=${nivelInvalido.status}`);

  // completude
  const comp = await req('GET', '/users/me/completude', { token: tokFre });
  check('Completude calculada com itens', comp.status === 200 && comp.data.completude.percentual > 0
    && (comp.data.completude.itens || []).length > 0, `pct=${comp.data.completude && comp.data.completude.percentual}`);

  // portfólio
  const portSemImg = await reqForm('POST', '/users/portfolio', {
    token: tokFre,
    campos: { titulo: 'Item sem imagem' },
    ficheiros: [],
  });
  check('Portfólio sem imagens → 400', portSemImg.status === 400, `status=${portSemImg.status}`);

  const portNovo = await reqForm('POST', '/users/portfolio', {
    token: tokFre,
    campos: { titulo: 'Trabalho Smoke', descricao: 'Feito pelo teste automatizado', link: 'https://exemplo.co.mz' },
    ficheiros: [
      { campo: 'imagens', nome: 'p1.png', tipo: 'image/png', dados: PNG_1PX },
      { campo: 'imagens', nome: 'p2.png', tipo: 'image/png', dados: PNG_1PX },
    ],
  });
  check('POST /users/portfolio com 2 imagens → 201', portNovo.status === 201 && (portNovo.data.item.imagens || []).length === 2,
    `status=${portNovo.status} imgs=${portNovo.data.item && portNovo.data.item.imagens && portNovo.data.item.imagens.length}`);
  const portId = portNovo.data.item && portNovo.data.item.id;

  const portCli = await reqForm('PUT', `/users/portfolio/${portId}`, {
    token: tokCli,
    campos: { titulo: 'Roubado' },
    ficheiros: [],
  });
  check('Editar portfólio alheio → 403', portCli.status === 403, `status=${portCli.status}`);
  const portCliDel = await req('DELETE', `/users/portfolio/${portId}`, { token: tokCli });
  check('Apagar portfólio alheio → 403', portCliDel.status === 403, `status=${portCliDel.status}`);

  const portLista = await req('GET', `/users/${freId}/portfolio`, { token: tokCli });
  check('GET /users/:id/portfolio lista o item', portLista.status === 200 && (portLista.data.itens || []).some((i) => i.id === portId),
    `status=${portLista.status} total=${(portLista.data.itens || []).length}`);

  const portEdit = await reqForm('PUT', `/users/portfolio/${portId}`, {
    token: tokFre,
    campos: { titulo: 'Trabalho Smoke Editado', link: 'https://exemplo.co.mz/editado' },
    ficheiros: [],
  });
  check('PUT portfólio (dono, sem novas imagens) → 200 mantém imagens', portEdit.status === 200
    && portEdit.data.item.titulo === 'Trabalho Smoke Editado' && (portEdit.data.item.imagens || []).length === 2,
    `status=${portEdit.status}`);

  // selo de plataforma pelo admin
  const verifyAdm = await req('PUT', `/admin/users/${freId}/verify`, { token: tokAdm, body: { verificado: true } });
  check('Admin verifica utilizador (selo plataforma)', verifyAdm.status === 200 && verifyAdm.data.user.verificado_plataforma === 1,
    `status=${verifyAdm.status}`);

  // perfil público: dados sensíveis nunca expostos
  const pubFre = await req('GET', `/users/freelancers/${freId}`, { token: tokCli });
  const pubTexto = JSON.stringify(pubFre.data || {});
  check('Perfil público sem senha_hash', !pubTexto.includes('senha_hash'), 'senha_hash exposto!');
  check('Perfil público sem metodos_recebimento', !pubTexto.includes('metodos_recebimento'), 'metodos_recebimento exposto!');
  check('Perfil público com selos e portfólio', pubFre.status === 200
    && pubFre.data.profile.verificado_plataforma === 1 && pubFre.data.profile.telefone_verificado === 1
    && (pubFre.data.profile.portfolio || []).some((i) => i.id === portId),
    `selos=${pubFre.data.profile && pubFre.data.profile.verificado_plataforma}/${pubFre.data.profile && pubFre.data.profile.telefone_verificado}`);

  const cliPub = await req('GET', `/users/clientes/${cliId}/publico`, { token: tokFre });
  const cliPubTexto = JSON.stringify(cliPub.data || {});
  check('Perfil público de cliente sem dados sensíveis', cliPub.status === 200 && !cliPubTexto.includes('senha_hash') && !cliPubTexto.includes('metodos_recebimento'),
    `status=${cliPub.status}`);

  // admin remove foto do utilizador
  const fotoAdm = await req('DELETE', `/admin/users/${freId}/avatar`, { token: tokAdm });
  check('Admin remove foto de utilizador', fotoAdm.status === 200 && !fotoAdm.data.user.foto, `status=${fotoAdm.status}`);

  const portDel = await req('DELETE', `/users/portfolio/${portId}`, { token: tokFre });
  check('DELETE portfólio (dono) → 200', portDel.status === 200, `status=${portDel.status}`);

  /* ---------- 17. Apagar serviço e utilizadores de teste ---------- */
  console.log('\n[13] Limpeza (apagar serviço e utilizadores de teste)');
  const apagarSvc = await req('DELETE', `/admin/services/${svcId}`, { token: tokAdm });
  check('Admin apaga serviço', apagarSvc.status === 200, `status=${apagarSvc.status}`);

  const apagarCli = await req('DELETE', `/admin/users/${cliId}`, { token: tokAdm });
  check('Admin apaga cliente de teste', apagarCli.status === 200, `status=${apagarCli.status}`);
  const apagarFre = await req('DELETE', `/admin/users/${freId}`, { token: tokAdm });
  check('Admin apaga freelancer de teste', apagarFre.status === 200, `status=${apagarFre.status}`);

  const loginCliFim = await req('POST', '/auth/login', { body: { email: EMAIL_CLI, senha: SENHA } });
  check('Utilizador apagado não entra mais → 401', loginCliFim.status === 401, `status=${loginCliFim.status}`);

  /* ---------- Resultado ---------- */
  console.log('\n══════════════════════════════════════');
  console.log(`RESULTADO: ${passou} passaram, ${falhou} falharam`);
  if (falhou > 0) {
    console.log('\nFalhas:');
    falhas.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  } else {
    console.log('✅ TODOS OS TESTES PASSARAM');
    process.exit(0);
  }
}

main().catch(async (e) => {
  console.error('Erro fatal do smoke test:', e);
  await limpezaEmergencia();
  process.exit(1);
});
