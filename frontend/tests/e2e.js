/* ============================================================
   FreelaMZ — Teste E2E da UI (Playwright, Chromium headless)
   Executar (com backend :3000 e frontend :5173 a rodar):
     npm run e2e
   Cobre: login/logout, F5 sem tela branca, 401 → logout automático,
   CRUD de serviço pela UI (criar/editar/apagar), painel admin e o
   fluxo FASE A completo: recarga fictícia → pagamento com escrow →
   entrega com ficheiro → aprovação dos dois lados → liberação +
   comissão no admin (utilizador descartável a9.*).
   ============================================================ */
const { chromium } = require('playwright');

const BASE = process.env.UI_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:3000/api';
const TS = Date.now();

let passou = 0;
let falhou = 0;
const falhas = [];
const errosConsole = [];

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

/* Pedido direto à API a partir do Node (criar sessões/utilizadores descartáveis) */
async function apiNode(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = {};
    try { data = await res.json(); } catch (e) { /* resposta vazia */ }
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: { message: e.message } };
  }
}

/* PNG 1x1 válido (magic bytes reais) para upload pela UI */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/* ZIP válido (magic bytes PK\x03\x04 + conteúdo) para a entrega pela UI */
const ZIP_E2E = Buffer.concat([Buffer.from('PK\x03\x04', 'binary'), Buffer.alloc(64, 7)]);

(async () => {
  console.log('\n════════ FREELAMZ — E2E DA UI (PLAYWRIGHT) ════════');
  console.log(`Alvo: ${BASE}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error') errosConsole.push(m.text()); });
  // aceitar dialogs (confirm do apagar serviço)
  page.on('dialog', (d) => { d.accept().catch(() => {}); });

  /* espera por condição no DOM; evaluate + mouse.wheel forçam frames.
     Importante: fn é serializada — variáveis externas devem vir por args */
  const esperar = async (fn, timeoutMs = 20000, ...args) => {
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      try {
        const v = await page.evaluate(fn, ...args);
        if (v) return v;
      } catch (e) { /* página em transição */ }
      await page.mouse.wheel(0, 60);
      await page.waitForTimeout(300);
    }
    return null;
  };

  /* ---------- 1. Login do freelancer ---------- */
  console.log('[1] Login do freelancer');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await esperar(() => document.querySelectorAll('input[type=email]').length > 0);
  await page.fill('input[type=email]', 'freela@freelamz.com');
  await page.fill('input[type=password]', 'Freela@123');
  await page.click('button[type=submit]');
  const dashOk = await esperar(() => {
    const m = document.querySelectorAll('.page-current .metric-card').length;
    const s = document.querySelectorAll('.page-current .skeleton').length;
    return m >= 4 && s === 0 ? m : null;
  });
  check('Login freela → dashboard com métricas (sem skeletons)', !!dashOk, `metricas=${dashOk}`);
  const token = await page.evaluate(() => localStorage.getItem('freelamz_token'));
  check('Token gravado no localStorage', !!token && token.length > 20);

  /* ---------- 2. F5 em rota de detalhe sem tela branca ---------- */
  console.log('\n[2] F5 (reload) em rotas principais');
  await page.goto(`${BASE}/services/6`, { waitUntil: 'domcontentloaded' });
  const detServ = await esperar(() => {
    const c = document.querySelector('.page-current .page-content');
    return c && c.textContent && c.textContent.includes('Crio o seu website institucional em React') ? 1 : null;
  });
  check('F5 em /services/6 renderiza o detalhe', !!detServ);

  await page.goto(`${BASE}/freelancers/10`, { waitUntil: 'domcontentloaded' });
  const detFre = await esperar(() => {
    const c = document.querySelector('.page-current .page-content');
    return c && c.textContent && c.textContent.includes('Isabel Sitoe') ? 1 : null;
  });
  check('F5 em /freelancers/10 renderiza o perfil', !!detFre);

  /* ---------- 3. Token inválido → 401 → logout automático ---------- */
  console.log('\n[3] Sessão expirada (401 → logout automático)');
  await page.evaluate(() => localStorage.setItem('freelamz_token', 'token_invalido_e2e'));
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  const redirecionado = await esperar(() =>
    location.pathname === '/login' && location.search.includes('expirada') ? 1 : null, 20000);
  const tokenLimpo = await page.evaluate(() => !localStorage.getItem('freelamz_token'));
  check('401 redireciona para /login?expirada=1', !!redirecionado, `path=${await page.evaluate(() => location.pathname + location.search)}`);
  check('Token inválido foi limpo', tokenLimpo);
  // os erros de rede 401 desta secção são intencionais — limpar para a análise do console
  errosConsole.length = 0;

  /* ---------- 4. CRUD de serviço pela UI (login freela) ---------- */
  console.log('\n[4] CRUD de serviço pela UI');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await esperar(() => document.querySelectorAll('input[type=email]').length > 0);
  await page.fill('input[type=email]', 'freela@freelamz.com');
  await page.fill('input[type=password]', 'Freela@123');
  await page.click('button[type=submit]');
  await esperar(() => document.querySelectorAll('.page-current .metric-card').length >= 4);

  // 4a. criar
  const TITULO = `Serviço E2E Playwright ${TS}`;
  await page.goto(`${BASE}/services/create`, { waitUntil: 'domcontentloaded' });
  await esperar(() => document.querySelectorAll('.page-current input[type=text]').length > 0);
  await page.fill('.page-current input[type=text]', TITULO);
  await page.fill('.page-current textarea', 'Serviço criado pelo teste E2E automatizado com Playwright.');
  const preco = page.locator('.page-current input[type=number]');
  await preco.fill('9000');
  await page.locator('.page-current input[type=text]').nth(1).fill('2 dias');
  await page.selectOption('.page-current select', { index: 2 });
  await page.click('button[type=submit]');
  const criado = await esperar(([titulo]) => {
    const c = document.querySelector('.page-current .page-content');
    return c && c.textContent && c.textContent.includes(titulo) ? 1 : null;
  }, 25000, [TITULO]);
  check('Criar serviço pela UI → visível na lista', !!criado);
  const urlDetalhe = await page.evaluate(() => location.pathname);
  check('Navegou para o detalhe/lista após criar', /\/services/.test(urlDetalhe), urlDetalhe);

  // 4b. detalhe do dono tem botões Editar + Apagar (regresso do bug ehMeu)
  await page.goto(`${BASE}/services`, { waitUntil: 'domcontentloaded' });
  await esperar(() => document.querySelectorAll('.page-current .service-card').length > 0);
  // abrir o detalhe clicando no card
  await page.evaluate((titulo) => {
    const card = [...document.querySelectorAll('.page-current .service-card')].find((c) => c.textContent.includes(titulo));
    if (card) card.click();
  }, TITULO);
  const noDetalhe = await esperar(([titulo]) => {
    const c = document.querySelector('.page-current .page-content');
    return c && c.textContent && c.textContent.includes(titulo) && /\/services\/\d+/.test(location.pathname) ? 1 : null;
  }, 20000, [TITULO]);
  check('Detalhe do serviço criado abre', !!noDetalhe);
  const pathDetalhe = await page.evaluate(() => location.pathname);
  const acoesDono = await esperar(() => {
    const btns = [...document.querySelectorAll('.page-current .detail-actions .btn')].map((b) => b.textContent.trim());
    const editar = btns.some((t) => /editar servi/i.test(t));
    const apagar = btns.some((t) => /apagar servi/i.test(t));
    return editar && apagar ? btns : null;
  });
  check('Dono vê "Editar serviço" (bug ehMeu corrigido)', !!acoesDono, `path=${pathDetalhe}`);
  check('Dono vê "Apagar serviço"', !!acoesDono);

  // 4c. editar o preço
  const precoAntes = await page.evaluate(() => (document.querySelector('.page-current .price-tag b') || {}).textContent || '');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.page-current .detail-actions .btn')].find((b) => /editar servi/i.test(b.textContent || ''));
    if (btn) btn.click();
  });
  await esperar(() => document.querySelectorAll('.page-current input[type=number]').length > 0, 20000);
  const inputPreco = page.locator('.page-current input[type=number]');
  await inputPreco.fill('9500');
  await page.click('.page-current button[type=submit]');
  const precoDepois = await esperar(() => {
    const t = (document.querySelector('.page-current .price-tag b') || {}).textContent || '';
    return t.replace(/\D/g, '').includes('9500') ? t : null;
  }, 25000);
  check('Editar preço pela UI → 9500 MT no detalhe', !!precoDepois, `antes=${precoAntes} depois=${precoDepois}`);

  // 4d. apagar (confirm é aceite automaticamente pelo page.on('dialog'))
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.page-current .detail-actions .btn')].find((b) => /apagar servi/i.test(b.textContent || ''));
    if (btn) btn.click();
  });
  const apagado = await esperar(() => {
    if (!/\/services\/\d+/.test(location.pathname)) return 1; // saiu do detalhe
    return null;
  }, 20000);
  await page.goto(`${BASE}/services`, { waitUntil: 'domcontentloaded' });
  await esperar(() => document.querySelectorAll('.page-current .service-card').length > 0);
  const sumiu = await page.evaluate((titulo) =>
    ![...document.querySelectorAll('.page-current .service-card')].some((c) => c.textContent.includes(titulo)), TITULO);
  check('Apagar pela UI (confirm aceite) → serviço desaparece da lista', !!apagado && sumiu);

  /* ---------- 5. Painel admin ---------- */
  console.log('\n[5] Painel admin');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await esperar(() => document.querySelectorAll('input[type=email]').length > 0);
  await page.fill('input[type=email]', 'admin@freelamz.com');
  await page.fill('input[type=password]', 'Admin@12345');
  await page.click('button[type=submit]');
  await esperar(() => document.querySelectorAll('.page-current .metric-card').length >= 4);
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  const adminOk = await esperar(() => {
    const abas = [...document.querySelectorAll('.page-current .filter-pill')].map((a) => a.textContent.trim());
    const metricas = document.querySelectorAll('.page-current .metric-card').length;
    return abas.length >= 7 && metricas >= 8 ? { abas, metricas } : null;
  }, 25000);
  check('Admin: 7 abas + 8 métricas', !!adminOk,
    adminOk ? `abas=${adminOk.abas.length} metricas=${adminOk.metricas}` : 'não carregou');
  // aba utilizadores
  await page.evaluate(() => {
    const aba = [...document.querySelectorAll('.page-current .filter-pill')].find((a) => a.textContent.trim() === 'Utilizadores');
    if (aba) aba.click();
  });
  const linhasUsers = await esperar(() => document.querySelectorAll('.page-current .admin-user-row').length >= 10
    ? document.querySelectorAll('.page-current .admin-user-row').length : null, 20000);
  check('Admin: aba Utilizadores lista contas (10+)', !!linhasUsers, `linhas=${linhasUsers}`);
  // aba denúncias
  await page.evaluate(() => {
    const aba = [...document.querySelectorAll('.page-current .filter-pill')].find((a) => a.textContent.trim() === 'Denúncias');
    if (aba) aba.click();
  });
  const denuncias = await esperar(() => document.querySelectorAll('.page-current .admin-user-row').length >= 1
    ? document.querySelectorAll('.page-current .admin-user-row').length : null, 20000);
  check('Admin: aba Denúncias lista denúncias do seed', !!denuncias, `linhas=${denuncias}`);

  /* ---------- 6. Contas ricas: perfil, avatares, portfólio e perfis públicos ---------- */
  console.log('\n[6] Contas ricas — avatar, portfólio e perfis públicos');

  // sessão freela criada direto da API (Isabel tem foto/capa do seed)
  const loginFre = await apiNode('POST', '/auth/login', {
    body: { email: 'freela@freelamz.com', senha: 'Freela@123' },
  });
  check('Login freela via API (sessão p/ perfil)', loginFre.status === 200 && !!loginFre.data.token,
    `status=${loginFre.status}`);
  await page.evaluate(([t, u]) => {
    localStorage.setItem('freelamz_token', t);
    localStorage.setItem('freelamz_user', u);
  }, [loginFre.data.token, JSON.stringify(loginFre.data.user)]);

  // 6a. /profile: foto do seed na navbar, no topo e no painel lateral + completude
  await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
  const perfilCarregou = await esperar(() =>
    document.querySelector('.page-current .perfil-topo') ? 1 : null, 25000);
  check('/profile carrega (aba Geral)', !!perfilCarregou);
  const avFoto = await esperar(() => {
    const nav = document.querySelector('#nav-avatar img');
    const topo = document.querySelector('.page-current .perfil-topo .avatar-xl img');
    return nav && topo ? { nav: nav.src, topo: topo.getAttribute('src') } : null;
  }, 20000);
  check('Foto real na navbar e no topo do perfil', !!avFoto
    && /\/uploads\//.test(avFoto.nav) && /\/uploads\//.test(avFoto.topo),
    avFoto ? `nav=${String(avFoto.nav).slice(-32)}` : 'sem foto');
  const compPct = await esperar(() => {
    const el = document.querySelector('.page-current .completude-pct');
    const pct = el ? parseInt(el.textContent, 10) : 0;
    return pct > 0 ? pct : null;
  }, 20000);
  check('Completude visível no /profile', !!compPct, `pct=${compPct}`);

  // painel lateral: a 1280px de viewport está sempre visível (visibleBreakpoint 1200)
  const panelFoto = await esperar(() => {
    const img = document.querySelector('#panel-avatar img');
    return img && /\/uploads\//.test(img.src) ? img.src : null;
  }, 15000);
  check('Foto real no painel lateral', !!panelFoto);

  // 6b. perfil público do freelancer: capa, avatar sobreposto, selos, stats e abas
  await page.goto(`${BASE}/freelancers/10`, { waitUntil: 'domcontentloaded' });
  const pubFre = await esperar(() => {
    const capa = document.querySelector('.page-current .perfil-capa img');
    const av = document.querySelector('.page-current .perfil-topo .avatar-xl img');
    const selos = document.querySelectorAll('.page-current .selos .selo').length;
    const stats = document.querySelectorAll('.page-current .perfil-stats .stat').length;
    const abas = document.querySelectorAll('.page-current .abas-perfil .aba-perfil').length;
    return capa && av && selos >= 3 && stats === 4 && abas === 4 ? { selos, stats, abas } : null;
  }, 25000);
  check('Perfil público: capa + avatar sobreposto com foto', !!pubFre);
  check('Perfil público: 3+ selos de verificação e 4 estatísticas', !!pubFre,
    pubFre ? `selos=${pubFre.selos} stats=${pubFre.stats}` : 'faltam elementos');
  check('Perfil público: 4 abas (Sobre/Portfólio/Serviços/Avaliações)', !!pubFre && pubFre.abas === 4);

  // 6c. aba Portfólio + photo browser
  await page.evaluate(() => {
    const aba = [...document.querySelectorAll('.page-current .abas-perfil .aba-perfil')]
      .find((a) => /portfólio/i.test(a.textContent));
    if (aba) aba.click();
  });
  const gridPort = await esperar(() => {
    const itens = document.querySelectorAll('.page-current .portfolio-grid .portfolio-item').length;
    return itens >= 3 ? itens : null;
  }, 20000);
  check('Aba Portfólio lista itens do seed (3+)', !!gridPort, `itens=${gridPort}`);

  await page.evaluate(() => {
    const thumb = document.querySelector('.page-current .portfolio-thumb-multi');
    if (thumb) thumb.click();
  });
  const pbAberto = await esperar(() => {
    const foto = document.querySelector('.photo-browser-overlay .pb-foto');
    const contador = document.querySelector('.photo-browser-overlay .pb-controles span');
    return foto && contador ? contador.textContent.trim() : null;
  }, 15000);
  check('Photo browser abre com foto e contador', !!pbAberto, `contador=${pbAberto}`);

  await page.evaluate(() => {
    const btns = document.querySelectorAll('.photo-browser-overlay .pb-controles button');
    if (btns[1]) btns[1].click();
  });
  const pbAvancou = await esperar((antes) => {
    const contador = document.querySelector('.photo-browser-overlay .pb-controles span');
    const txt = contador ? contador.textContent.trim() : '';
    return txt && txt !== antes ? txt : null;
  }, 15000, pbAberto);
  check('Photo browser navega para a próxima foto', !!pbAvancou, `contador=${pbAvancou}`);

  await page.evaluate(() => {
    const fechar = document.querySelector('.photo-browser-overlay .pb-close');
    if (fechar) fechar.click();
  });
  const pbFechou = await esperar(() =>
    document.querySelector('.photo-browser-overlay') ? null : 1, 10000);
  check('Photo browser fecha', !!pbFechou);

  // 6d. trocar foto de perfil pela UI (utilizador descartável criado via API)
  const EMAIL_UP = `e2e.upload.${TS}@freelamz.com`;
  const telUp = `+258 84 ${String(TS).slice(-3)} ${String(TS).slice(-4)}`;
  const regUp = await apiNode('POST', '/auth/register', {
    body: { nome: 'E2e Upload', email: EMAIL_UP, telefone: telUp, senha: 'E2eUp@12345', tipoUsuario: 'FREELANCER' },
  });
  check('Registo de utilizador descartável via API', regUp.status === 201 && !!regUp.data.token,
    `status=${regUp.status} ${regUp.data.message || ''}`);
  if (regUp.data.token) {
    await page.evaluate(([t, u]) => {
      localStorage.setItem('freelamz_token', t);
      localStorage.setItem('freelamz_user', u);
    }, [regUp.data.token, JSON.stringify(regUp.data.user)]);
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    const semFoto = await esperar(() =>
      document.querySelector('.page-current .perfil-topo .avatar-initials') ? 1 : null, 25000);
    check('Novo utilizador vê iniciais (sem foto)', !!semFoto);
    await page.setInputFiles('#input-avatar', { name: 'avatar-e2e.png', mimeType: 'image/png', buffer: PNG_1PX });
    const fotoTrocada = await esperar(() => {
      const topo = document.querySelector('.page-current .perfil-topo .avatar-xl img');
      const nav = document.querySelector('#nav-avatar img');
      const src = topo ? topo.getAttribute('src') : '';
      return topo && nav && /\/uploads\/avatars\//.test(src) ? src : null;
    }, 25000);
    check('Upload de avatar pela UI troca a foto (topo + navbar)', !!fotoTrocada, `src=${fotoTrocada}`);
  }

  // 6e. perfil público de cliente (empresa)
  await page.goto(`${BASE}/clientes/22`, { waitUntil: 'domcontentloaded' });
  const cliPub = await esperar(() => {
    const nome = document.querySelector('.page-current .perfil-nome');
    const stats = document.querySelectorAll('.page-current .perfil-stats .stat').length;
    const capa = document.querySelector('.page-current .perfil-capa');
    return nome && /kahango/i.test(nome.textContent) && stats === 4 && capa ? nome.textContent.trim() : null;
  }, 25000);
  check('Perfil público de cliente empresa (Kahango) renderiza', !!cliPub, `nome=${cliPub}`);

  /* ---------- 6f. Limpeza: utilizadores descartáveis do E2E ---------- */
  const loginAdm = await apiNode('POST', '/auth/login', {
    body: { email: 'admin@freelamz.com', senha: 'Admin@12345' },
  });
  if (loginAdm.data.token) {
    const lista = await apiNode('GET', '/admin/users?busca=e2e.upload&limit=100', { token: loginAdm.data.token });
    const descartaveis = ((lista.data && lista.data.users) || [])
      .filter((u) => /^e2e\.upload\.\d+@freelamz\.com$/.test(u.email));
    let limpos = 0;
    for (const u of descartaveis) {
      const del = await apiNode('DELETE', `/admin/users/${u.id}`, { token: loginAdm.data.token });
      if (del.status === 200) limpos += 1;
    }
    check('Limpeza: utilizadores descartáveis do E2E removidos', limpos === descartaveis.length && descartaveis.length >= 1,
      `removidos=${limpos}/${descartaveis.length}`);
  }

  /* ---------- 7. FASE A: pagamento com escrow pela UI ---------- */
  console.log('\n[7] FASE A — escrow pela UI: pagar → entregar → aprovar → liberar');

  // trocar de sessão sem passar pelo ecrã de login (token + user no localStorage)
  const entrarComo = async (u) => {
    await page.evaluate(([t, usr]) => {
      localStorage.setItem('freelamz_token', t);
      localStorage.setItem('freelamz_user', usr);
    }, [u.token, JSON.stringify(u.user)]);
  };

  // 8a. Setup via API: cliente + freela descartáveis, serviço, projeto com proposta aceite
  const regA9 = (nome, tipo, tel) => apiNode('POST', '/auth/register', {
    body: {
      nome: `A9 ${nome}`, email: `a9.${nome}.${TS}@freelamz.com`, telefone: tel,
      senha: 'A9test@123', tipoUsuario: tipo, cidade: 'Maputo', provincia: 'Maputo',
    },
  });
  const suf = String(TS).slice(-4);
  const a9cli = await regA9('cliente', 'CLIENTE', `+258 85 ${suf} ${String(TS + 1).slice(-4)}`);
  const a9fre = await regA9('freela', 'FREELANCER', `+258 86 ${suf} ${String(TS + 2).slice(-4)}`);
  check('A9: cliente e freelancer descartáveis registados via API',
    a9cli.status === 201 && !!a9cli.data.token && a9fre.status === 201 && !!a9fre.data.token,
    `cli=${a9cli.status} fre=${a9fre.status}`);
  const tokCli = a9cli.data.token;
  const tokFre = a9fre.data.token;
  const cliId = a9cli.data.user.id;
  const freId = a9fre.data.user.id;

  const svcA9 = await apiNode('POST', '/services', {
    token: tokFre,
    body: {
      titulo: `Serviço A9 ${TS}`, descricao: 'Serviço do fluxo E2E de pagamentos (FASE A).',
      categoria_id: 1, preco: 800, prazo_entrega: '3 dias', status: 'ativo',
    },
  });
  check('A9: serviço do freelancer criado', svcA9.status === 201 && !!svcA9.data.service, `status=${svcA9.status}`);

  const projA9 = await apiNode('POST', '/projects', {
    token: tokCli, body: { freelancerId: freId, servicoId: svcA9.data.service.id, valor: 800, prazo: '5 dias' },
  });
  const projId = projA9.data.project.id;
  const propA9 = await apiNode('POST', '/proposals', {
    token: tokFre, body: { projeto_id: projId, preco: 800, prazo: '4 dias', mensagem: 'Proposta do fluxo E2E.' },
  });
  const aceitaA9 = await apiNode('PUT', `/proposals/${propA9.data.proposal.id}/status`, {
    token: tokCli, body: { status: 'ACEITA' },
  });
  const projAntes = await apiNode('GET', `/projects/${projId}`, { token: tokCli });
  check('A9: proposta aceite → projeto AGUARDANDO_PAGAMENTO',
    aceitaA9.status === 200 && projAntes.data.project.status === 'AGUARDANDO_PAGAMENTO',
    `status=${(projAntes.data.project || {}).status}`);

  // baseline da comissão para o delta no fim do fluxo
  const admA9 = await apiNode('POST', '/auth/login', {
    body: { email: 'admin@freelamz.com', senha: 'Admin@12345' },
  });
  const finAntes = await apiNode('GET', '/admin/finance', { token: admA9.data.token });
  const comissaoAntes = Number((finAntes.data.finance || {}).comissoes_total || 0);

  // 8b. Cliente: carteira nova + recarga fictícia de 2000
  await entrarComo(a9cli.data);
  await page.goto(`${BASE}/wallet`, { waitUntil: 'domcontentloaded' });
  const heroZero = await esperar(() => {
    const el = document.querySelector('.page-current .wallet-saldo');
    return el && el.textContent.replace(/\D/g, '') === '0' ? 1 : null;
  }, 20000);
  check('Carteira nova do cliente: saldo 0', !!heroZero);
  const bannerTeste = await esperar(() => document.getElementById('mz-modo-teste') ? 1 : null, 15000);
  check('Banner "MODO DE TESTE" visível (pagamentos fictícios)', !!bannerTeste);

  await page.locator('.page-current input[type=number]').first().fill('2000');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.page-current button[type=submit]')]
      .find((b) => /adicionar saldo/i.test(b.textContent || ''));
    if (btn) btn.click();
  });
  const saldo2000 = await esperar(() => {
    const el = document.querySelector('.page-current .wallet-saldo');
    return el && el.textContent.replace(/\D/g, '') === '2000' ? 1 : null;
  }, 25000);
  check('Recarga fictícia de 2000 MT pela UI', !!saldo2000);

  // 8c. Cliente: chat do projeto → pagar com Saldo
  const chatCli = `${BASE}/messages/${freId}?projeto=${projId}`;
  await page.goto(chatCli, { waitUntil: 'domcontentloaded' });
  const barraCli = await esperar(() => document.querySelector('.page-current .chat-projeto-bar') ? 1 : null, 20000);
  check('Chat com ?projeto= mostra a barra de estado', !!barraCli);
  const passo1 = await esperar(() => {
    const on = document.querySelectorAll('.page-current .chat-step.on').length;
    const pagar = [...document.querySelectorAll('.page-current .chat-acoes button')]
      .some((b) => /pagar/i.test(b.textContent || ''));
    return on === 1 && pagar ? on : null;
  }, 20000);
  check('Estado inicial: passo 1/4 + botão Pagar (cliente)', !!passo1, `passos=${passo1}`);

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.page-current .chat-acoes button')]
      .find((b) => /pagar/i.test(b.textContent || ''));
    if (btn) btn.click();
  });
  const modalPag = await esperar(() => document.querySelector('.mz-modal') ? 1 : null, 10000);
  check('Modal de pagamento abre (4 métodos)', !!modalPag
    && (await page.evaluate(() => document.querySelectorAll('.mz-modal .metodo-pill').length)) === 4);
  await page.evaluate(() => {
    const pill = [...document.querySelectorAll('.mz-modal .metodo-pill')]
      .find((p) => /^saldo$/i.test(p.textContent.trim()));
    if (pill) pill.click();
  });
  const saldoModal = await esperar(() => {
    const info = document.querySelector('.mz-modal .mz-modal-info');
    return info && info.textContent.replace(/\D/g, '') === '2000' ? 1 : null;
  }, 10000);
  check('Método Saldo mostra o saldo disponível (2000)', !!saldoModal);
  await page.evaluate(() => {
    const btn = document.querySelector('.mz-modal button[type=submit]');
    if (btn) btn.click();
  });
  const pago = await esperar(() => {
    if (document.querySelector('.mz-modal')) return null;
    const on = document.querySelectorAll('.page-current .chat-step.on').length;
    const sist = [...document.querySelectorAll('.page-current .msg-sistema')]
      .some((s) => /RETIDO/i.test(s.textContent));
    return on === 2 && sist ? on : null;
  }, 30000);
  check('Pagamento com Saldo → passo 2/4 + msg de sistema "RETIDO"', !!pago, `passos=${pago}`);

  // 8d. Freelancer: entregar com ficheiro .zip (magic bytes reais)
  await entrarComo(a9fre.data);
  await page.goto(`${BASE}/messages/${cliId}?projeto=${projId}`, { waitUntil: 'domcontentloaded' });
  const btnEntregar = await esperar(() => {
    const btn = [...document.querySelectorAll('.page-current .chat-acoes button')]
      .find((b) => /entregar/i.test(b.textContent || ''));
    return btn ? 1 : null;
  }, 20000);
  check('Freelancer vê o botão "Entregar projeto"', !!btnEntregar);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.page-current .chat-acoes button')]
      .find((b) => /entregar/i.test(b.textContent || ''));
    if (btn) btn.click();
  });
  const modalEnt = await esperar(() => document.querySelector('.mz-modal textarea') ? 1 : null, 10000);
  check('Modal de entrega abre (mensagem/ficheiros/links)', !!modalEnt);
  await page.fill('.mz-modal textarea', 'Entrega E2E: website completo dentro do zip.');
  await page.setInputFiles('.mz-modal input[type=file]', {
    name: 'entrega-e2e.zip', mimeType: 'application/zip', buffer: ZIP_E2E,
  });
  const zipNoModal = await esperar(() => {
    const el = document.querySelector('.mz-modal .msg-arquivo');
    return el && /entrega-e2e\.zip/.test(el.textContent) ? 1 : null;
  }, 10000);
  check('Ficheiro .zip aceito no form (validação client)', !!zipNoModal);
  await page.evaluate(() => {
    const btn = document.querySelector('.mz-modal button[type=submit]');
    if (btn) btn.click();
  });
  const entregue = await esperar(() => {
    if (document.querySelector('.mz-modal')) return null;
    const card = document.querySelector('.page-current .msg-card-entrega');
    const on = document.querySelectorAll('.page-current .chat-step.on').length;
    return card && /entrega #1/i.test(card.textContent) && on === 3 ? on : null;
  }, 30000);
  check('Entrega enviada → card "Entrega #1" no chat + passo 3/4', !!entregue, `passos=${entregue}`);

  // 8e. Cliente: ver a entrega + aprovar
  await entrarComo(a9cli.data);
  await page.goto(chatCli, { waitUntil: 'domcontentloaded' });
  const cardCli = await esperar(() => {
    const card = document.querySelector('.page-current .msg-card-entrega');
    return card && /entrega #1/i.test(card.textContent) ? 1 : null;
  }, 20000);
  check('Cliente vê a Entrega #1 no chat', !!cardCli);
  const btnDownload = await esperar(() => {
    const b = [...document.querySelectorAll('.page-current .msg-card-entrega button')]
      .find((x) => /descarregar/i.test(x.textContent || ''));
    return b ? 1 : null;
  }, 20000);
  check('Card de entrega tem botão Descarregar (id real via /deliveries)', !!btnDownload);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.page-current .chat-acoes button')]
      .find((b) => /aprovar entrega/i.test(b.textContent || ''));
    if (btn) btn.click();
  });
  const aprovado = await esperar(() => {
    const sist = [...document.querySelectorAll('.page-current .msg-sistema')]
      .some((s) => /cliente aprovou/i.test(s.textContent));
    const nota = document.querySelector('.page-current .chat-projeto-bar');
    return sist && nota && /falta (o|confirmar)/i.test(nota.textContent) ? 1 : null;
  }, 30000);
  check('Cliente aprova → msg de sistema + nota "falta o freelancer confirmar"', !!aprovado);

  // 8f. Freelancer: confirmar a conclusão → liberação
  await entrarComo(a9fre.data);
  await page.goto(`${BASE}/messages/${cliId}?projeto=${projId}`, { waitUntil: 'domcontentloaded' });
  const btnConfirmar = await esperar(() => {
    const btn = [...document.querySelectorAll('.page-current .chat-acoes button')]
      .find((b) => /confirmar conclus/i.test(b.textContent || ''));
    return btn ? 1 : null;
  }, 20000);
  check('Freelancer vê "Confirmar conclusão e valor"', !!btnConfirmar);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.page-current .chat-acoes button')]
      .find((b) => /confirmar conclus/i.test(b.textContent || ''));
    if (btn) btn.click();
  });
  const concluido = await esperar(() => {
    const on = document.querySelectorAll('.page-current .chat-step.on').length;
    const sist = [...document.querySelectorAll('.page-current .msg-sistema')]
      .some((s) => /LIBERADO/i.test(s.textContent));
    return on === 4 && sist ? on : null;
  }, 30000);
  check('Freelancer confirma → 4/4 passos + msg "LIBERADO"', !!concluido, `passos=${concluido}`);

  // 8g. Carteira do freelancer: 720 MT líquidos (800 − 10%)
  await page.goto(`${BASE}/wallet`, { waitUntil: 'domcontentloaded' });
  const saldo720 = await esperar(() => {
    const el = document.querySelector('.page-current .wallet-saldo');
    return el && el.textContent.replace(/\D/g, '') === '720' ? 1 : null;
  }, 20000);
  check('Carteira do freelancer: 720 MT (800 − 10% de comissão)', !!saldo720);
  const extratoLib = await esperar(() => {
    const linhas = [...document.querySelectorAll('.page-current .mz-list-item')];
    return linhas.some((l) => /liberação de escrow/i.test(l.textContent)
      && l.textContent.replace(/\D/g, '').includes('720')) ? 1 : null;
  }, 15000);
  check('Extrato do freelancer: "Liberação de escrow +720"', !!extratoLib);

  // 8h. Cliente: linha do tempo do projeto com o fluxo completo
  await entrarComo(a9cli.data);
  await page.goto(`${BASE}/projects/${projId}`, { waitUntil: 'domcontentloaded' });
  const tlOk = await esperar(() => {
    const rots = [...document.querySelectorAll('.page-current .tl-item .tl-rot')].map((e) => e.textContent.trim());
    const pagoT = rots.some((t) => /pago e retido/i.test(t));
    const entregueT = rots.some((t) => /entrega #1/i.test(t));
    const aprovouT = rots.some((t) => /cliente aprovou/i.test(t));
    const liberadoT = rots.some((t) => /liberado ao freelancer/i.test(t));
    return pagoT && entregueT && aprovouT && liberadoT ? rots.length : null;
  }, 25000);
  check('Timeline do projeto: pago → entrega → aprovação → liberação', !!tlOk, `itens=${tlOk}`);

  // 8i. Admin: comissão contabilizada + aba Financeiro na UI
  const finDepois = await apiNode('GET', '/admin/finance', { token: admA9.data.token });
  check('Admin: comissão de 80 MT contabilizada no painel',
    Number(finDepois.data.finance.comissoes_total) - comissaoAntes === 8000,
    `delta=${Number(finDepois.data.finance.comissoes_total) - comissaoAntes}`);
  await entrarComo(admA9.data);
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await esperar(() => document.querySelectorAll('.page-current .filter-pill').length >= 7, 25000);
  await page.evaluate(() => {
    const aba = [...document.querySelectorAll('.page-current .filter-pill')]
      .find((a) => /financeiro/i.test(a.textContent.trim()));
    if (aba) aba.click();
  });
  const finTab = await esperar(() => {
    const metricas = document.querySelectorAll('.page-current .metric-card').length;
    const canvas = document.getElementById('admin-chart-fin');
    const tx = [...document.querySelectorAll('.page-current .section-title')]
      .some((s) => /transa\u00e7\u00f5es recentes/i.test(s.textContent));
    return metricas >= 6 && canvas && tx ? metricas : null;
  }, 25000);
  check('Admin: aba Financeiro (6 métricas + gráfico Chart.js + transações)', !!finTab, `metricas=${finTab}`);

  // 8j. Limpeza: serviço ANTES dos utilizadores (cascade), padrão do smoke
  const delSvc = await apiNode('DELETE', `/admin/services/${svcA9.data.service.id}`, { token: admA9.data.token });
  const listaA9 = await apiNode('GET', '/admin/users?busca=a9.&limit=100', { token: admA9.data.token });
  const descartaveisA9 = ((listaA9.data && listaA9.data.users) || [])
    .filter((u) => /^a9\.(cliente|freela)\.\d+@freelamz\.com$/.test(u.email));
  let limposA9 = 0;
  for (const u of descartaveisA9) {
    const del = await apiNode('DELETE', `/admin/users/${u.id}`, { token: admA9.data.token });
    if (del.status === 200) limposA9 += 1;
  }
  check('Limpeza A9: serviço + utilizadores removidos',
    delSvc.status === 200 && limposA9 === descartaveisA9.length && descartaveisA9.length >= 2,
    `svc=${delSvc.status} users=${limposA9}/${descartaveisA9.length}`);

  /* ---------- 8. Console ---------- */
  console.log('\n[8] Console do browser');
  const errosRelevantes = errosConsole.filter((t) => !/favicon|Download the Vue Devtools/i.test(t));
  check('Sem erros no console', errosRelevantes.length === 0, errosRelevantes.slice(0, 3).join(' | ').slice(0, 200));

  await browser.close();

  console.log('\n══════════════════════════════════════');
  console.log(`RESULTADO: ${passou} passaram, ${falhou} falharam`);
  if (falhou > 0) {
    console.log('\nFalhas:');
    falhas.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES E2E PASSARAM');
  process.exit(0);
})().catch((e) => {
  console.error('Erro fatal do teste E2E:', e);
  process.exit(1);
});
