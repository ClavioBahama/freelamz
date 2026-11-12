/* ============================================================
   FreelaMZ — Auditoria de UI (todas as rotas × 4 larguras)
   Executar: node tests/ui-audit.js  (backend :3000 + vite :5173)
   O que verifica em CADA rota em 360/768/1024/1440 px:
     a) sem scroll horizontal (scrollWidth <= clientWidth + 1)
     b) nenhum "&nbsp;"/"&amp;" literal nem nome de ícone visível
        como texto (contra a lista real de ícones do pacote f7)
     c) sem erros de console (exceções JS + erros não-recursos)
     d) cartões do mesmo grid sem sobreposição (getBoundingClientRect)
     e) recarga (F5) não deixa tela branca
   Screenshots: tests/screenshots/<rota>-<largura>.png
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const API = 'http://localhost:3000/api';
const BASE = 'http://localhost:5173';
const LARGURAS = [360, 768, 1024, 1440];
const SHOTS = path.join(__dirname, 'screenshots');

/* Nomes reais de ícones do pacote framework7-icons */
const NOMES_ICONES = new Set(
  fs.readdirSync(path.join(__dirname, '..', 'node_modules', 'framework7-icons', 'svg'))
    .map((f) => f.replace(/\.svg$/, ''))
);

let passou = 0;
let falhou = 0;
const falhas = [];

function check(nome, cond, detalhe = '') {
  if (cond) { passou += 1; }
  else {
    falhou += 1;
    falhas.push(`${nome}${detalhe ? ` — ${detalhe}` : ''}`);
    console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

async function apiLogin(email, senha) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  }).then((x) => x.json());
  if (!r.token) throw new Error(`login falhou para ${email}`);
  return r;
}

async function entrar(page, token, user) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.evaluate(([t, u]) => {
    localStorage.setItem('freelamz_token', t);
    localStorage.setItem('freelamz_user', u);
  }, [token, JSON.stringify(user)]);
}

async function visitar(page, rota, largura, slug) {
  const errosConsole = [];
  const onConsole = (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource/i.test(msg.text())) {
      errosConsole.push(msg.text().slice(0, 100));
    }
  };
  const onPageError = (e) => errosConsole.push(String(e.message || e).slice(0, 100));
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  await page.setViewportSize({ width: largura, height: 820 });
  let carregou = true;
  try {
    await page.goto(`${BASE}${rota}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('.page-current', { timeout: 15000 });
    await page.waitForTimeout(1600); /* asyncComponents + fetches */
  } catch (e) {
    carregou = false;
  }

  const chave = `${rota} @${largura}`;
  check(`carrega: ${chave}`, carregou, 'página não montou em 20 s');

  let res = null;
  if (carregou) {
    res = await page.evaluate((nomes) => {
      const nomesSet = new Set(nomes);
      const doc = document.documentElement;
      const achados = { nbsp: [], iconeTexto: [], sobreposicao: [] };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = (n.textContent || '').trim();
        if (!t) continue;
        if (/&nbsp;|&amp;nbsp;|&amp;|&#\d+;/i.test(t)) achados.nbsp.push(t.slice(0, 60));
        const dentroIcone = !!(n.parentElement && n.parentElement.closest('.f7-icons'));
        if (!dentroIcone && nomesSet.has(t)) achados.iconeTexto.push(t);
      }
      document.querySelectorAll('.mz-grid, .mz-grid-4').forEach((grid) => {
        const cards = [...grid.children].map((el) => el.getBoundingClientRect());
        for (let i = 0; i < cards.length; i++) {
          for (let j = i + 1; j < cards.length; j++) {
            const a = cards[i]; const b = cards[j];
            const ow = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const oh = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (ow > 4 && oh > 4) achados.sobreposicao.push(`cartão ${i} sobrepõe ${j} (${Math.round(ow)}x${Math.round(oh)}px)`);
          }
        }
      });
      return {
        scrollW: doc.scrollWidth,
        clientW: doc.clientWidth,
        achados,
      };
    }, [...NOMES_ICONES]);

    if (res) {
      check(`sem scroll horizontal: ${chave}`, res.scrollW <= res.clientW + 1, `scrollW=${res.scrollW} clientW=${res.clientW}`);
      check(`sem "&nbsp;"/entidades: ${chave}`, res.achados.nbsp.length === 0, JSON.stringify(res.achados.nbsp.slice(0, 3)));
      check(`sem nome de ícone como texto: ${chave}`, res.achados.iconeTexto.length === 0, JSON.stringify(res.achados.iconeTexto.slice(0, 3)));
      check(`sem sobreposição de cartões: ${chave}`, res.achados.sobreposicao.length === 0, res.achados.sobreposicao.slice(0, 2).join('; '));
    }

    /* F5 não pode deixar tela branca */
    let recarregou = true;
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('.page-current', { timeout: 12000 });
      await page.waitForTimeout(800);
    } catch (e) {
      recarregou = false;
    }
    check(`F5 sem tela branca: ${chave}`, recarregou);

    await page.screenshot({ path: path.join(SHOTS, `${slug}-${largura}.png`) });
  }

  check(`sem erros de console: ${chave}`, errosConsole.length === 0, errosConsole.slice(0, 2).join(' | '));
  page.off('console', onConsole);
  page.off('pageerror', onPageError);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  /* limpar screenshots antigos */
  for (const f of fs.readdirSync(SHOTS)) {
    if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOTS, f));
  }

  /* Sessões */
  const freela = await apiLogin('freela@freelamz.com', 'Freela@123');
  const admin = await apiLogin('admin@freelamz.com', 'Admin@12345');

  /* IDs dinâmicos via API */
  const [fl, sv, pr, conv] = await Promise.all([
    fetch(`${API}/users/freelancers?limit=5`, { headers: { Authorization: `Bearer ${freela.token}` } }).then((r) => r.json()),
    fetch(`${API}/services?limit=5`, { headers: { Authorization: `Bearer ${freela.token}` } }).then((r) => r.json()),
    fetch(`${API}/projects`, { headers: { Authorization: `Bearer ${freela.token}` } }).then((r) => r.json()),
    fetch(`${API}/messages/conversations`, { headers: { Authorization: `Bearer ${freela.token}` } }).then((r) => r.json()),
  ]);
  const idFreelancer = (fl.freelancers && fl.freelancers[0] && fl.freelancers[0].user_id) || null;
  const idServico = (sv.services && sv.services[0] && sv.services[0].id) || null;
  const idProjeto = (pr.projects && pr.projects[0] && pr.projects[0].id) || null;
  const idConversa = (conv.conversas && conv.conversas[0] && conv.conversas[0].outro_id) || null;

  const rotasFreela = [
    ['/home', 'home'], ['/dashboard', 'dashboard'],
    ['/freelancers', 'freelancers'],
    ...(idFreelancer ? [[`/freelancers/${idFreelancer}`, 'freelancer-detalhe']] : []),
    ['/services', 'services'],
    ...(idServico ? [[`/services/${idServico}`, 'service-detalhe']] : []),
    ['/services/create', 'service-create'],
    ['/projects', 'projects'],
    ...(idProjeto ? [[`/projects/${idProjeto}`, 'project-detalhe']] : []),
    ['/proposals', 'proposals'],
    ['/messages', 'messages'],
    ...(idConversa ? [[`/messages/${idConversa}`, 'message-conversa']] : []),
    ['/notifications', 'notifications'],
    ['/favorites', 'favorites'],
    ['/wallet', 'wallet'],
    ['/profile', 'profile'],
    ['/settings', 'settings'],
  ];

  const browser = await chromium.launch({ headless: true });
  console.log('\n════════ FREELAMZ — AUDITORIA DE UI ════════');
  console.log(`Rotas × larguras: ${(rotasFreela.length + 3)} × ${LARGURAS.length} = ${(rotasFreela.length + 3) * LARGURAS.length} páginas`);
  console.log(`IDs: freelancer=${idFreelancer} serviço=${idServico} projeto=${idProjeto} conversa=${idConversa}\n`);

  /* Sessão freelancer (a maioria das rotas) */
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(page, freela.token, freela.user);
  for (const [rota, slug] of rotasFreela) {
    console.log(`▸ ${rota}`);
    for (const largura of LARGURAS) {
      await visitar(page, rota, largura, slug);
    }
  }

  /* Sessão admin */
  const pageAdm = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(pageAdm, admin.token, admin.user);
  console.log('▸ /admin');
  for (const largura of LARGURAS) {
    await visitar(pageAdm, '/admin', largura, 'admin');
  }

  /* Rotas públicas (sem token) */
  const pagePub = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await pagePub.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await pagePub.evaluate(() => { localStorage.removeItem('freelamz_token'); localStorage.removeItem('freelamz_user'); });
  console.log('▸ /login (público)');
  for (const largura of LARGURAS) {
    await visitar(pagePub, '/login', largura, 'login');
  }
  console.log('▸ /register (público)');
  for (const largura of LARGURAS) {
    await visitar(pagePub, '/register', largura, 'register');
  }

  await browser.close();

  console.log('\n══════════════════════════════════════');
  console.log(`RESULTADO: ${passou} passaram, ${falhou} falharam`);
  if (falhou > 0) {
    console.log('\nFalhas:');
    falhas.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
  console.log('✅ AUDITORIA DE UI LIMPA');
  console.log(`Screenshots: ${SHOTS}`);
  process.exit(0);
})().catch((e) => {
  console.error('Erro fatal da auditoria:', e);
  process.exit(1);
});
