/* ============================================================
   FreelaMZ — Smoke do BUILD (dist via vite preview :4173)
   Valida o bundle de produção: /wallet e chat ?projeto= com
   F5 (reload) sem tela branca e sem erros de console.
   Requer: backend :3000 a rodar e `npm run preview` de pé.
   ============================================================ */
const { chromium } = require('playwright');

const BASE = process.env.PREVIEW_URL || 'http://localhost:4173';
const API = 'http://localhost:3000/api';

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

(async () => {
  console.log('\n════════ FREELAMZ — SMOKE DO BUILD (vite preview) ════════');
  console.log(`Alvo: ${BASE}\n`);

  /* aguardar o preview subir (máx. 30 s) */
  let up = false;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) { up = true; break; }
    } catch (e) { /* ainda a subir */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  check('Preview do build de pé (:4173)', up);
  if (!up) {
    console.log('✗ Preview não subiu — correr npm run preview primeiro');
    process.exit(1);
  }

  /* sessão freela via API + um projeto real para o chat */
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'freela@freelamz.com', senha: 'Freela@123' }),
  }).then((r) => r.json());
  check('Login freela via API', !!login.token);
  const projs = await fetch(`${API}/projects?limit=50`, {
    headers: { Authorization: `Bearer ${login.token}` },
  }).then((r) => r.json()).catch(() => ({}));
  const lista = projs.projects || [];
  const proj = lista.find((p) => p.cliente_id && p.freelancer_id) || lista[0] || null;
  check('Freela tem projeto do seed para o chat', !!proj, `projetos=${lista.length}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error') errosConsole.push(m.text()); });

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

  /* sessão direto no localStorage (contexto novo, sem corridas de 401) */
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await esperar(() => document.querySelectorAll('input[type=email]').length > 0);
  await page.evaluate(([t, u]) => {
    localStorage.setItem('freelamz_token', t);
    localStorage.setItem('freelamz_user', u);
  }, [login.token, JSON.stringify(login.user)]);

  /* /wallet + F5 */
  await page.goto(`${BASE}/wallet`, { waitUntil: 'domcontentloaded' });
  const hero = await esperar(() => document.querySelector('.page-current .wallet-hero') ? 1 : null);
  check('Build: /wallet renderiza (hero da carteira)', !!hero);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const hero2 = await esperar(() => document.querySelector('.page-current .wallet-hero') ? 1 : null);
  check('Build: F5 em /wallet sem tela branca', !!hero2);

  /* chat com ?projeto= + F5 */
  if (proj) {
    const outro = login.user.id === proj.cliente_id ? proj.freelancer_id : proj.cliente_id;
    const url = `${BASE}/messages/${outro}?projeto=${proj.id}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const barra = await esperar(() => document.querySelector('.page-current .chat-projeto-bar') ? 1 : null);
    check('Build: chat ?projeto= renderiza a barra de estado', !!barra);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const barra2 = await esperar(() => document.querySelector('.page-current .chat-projeto-bar') ? 1 : null);
    check('Build: F5 no chat com ?projeto= sem tela branca', !!barra2);
  }

  /* dashboard (tira de carteira FASE A) */
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  const strip = await esperar(() => document.querySelector('.page-current .wallet-strip') ? 1 : null);
  check('Build: dashboard com a tira da carteira (FASE A)', !!strip);

  const errosRelevantes = errosConsole.filter((t) => !/favicon|gstatic|ERR_ABORTED/i.test(t));
  check('Build: sem erros no console', errosRelevantes.length === 0,
    errosRelevantes.slice(0, 3).join(' | ').slice(0, 200));

  await browser.close();

  console.log('\n══════════════════════════════════════');
  console.log(`RESULTADO: ${passou} passaram, ${falhou} falharam`);
  if (falhou > 0) {
    console.log('\nFalhas:');
    falhas.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
  console.log('✅ BUILD OK — ROTAS FASE A RENDERIZAM NO BUNDLE DE PRODUÇÃO');
  process.exit(0);
})().catch((e) => {
  console.error('Erro fatal do smoke do build:', e);
  process.exit(1);
});
