/* ============================================================
   FreelaMZ — Aplicação Framework7 v8 (Vanilla JS + Vite)
   ============================================================ */
import Framework7 from 'framework7/bundle';
import 'framework7/css/bundle';
import 'framework7-icons/css/framework7-icons.css';
import './css/app.css';

import routes from './routes.js';
import { loadAuth, saveAuth } from './js/auth.js';
import { api, setToken, getApiBase, apiUrl } from './js/api.js';
import { rotaAtual, caminhoAtual, normalizarUrl, redirecionar, separadorAtual } from './js/nav.js';
import {
  atualizarPanel, atualizarTabbar, atualizarBadges,
  aplicarNavbarAvatar, ligarNavegacaoGlobal, toast,
} from './js/layout.js';

/* ============================================================
   Guard de autenticação — executado ANTES do Framework7.
   Com navegação por HASH (compatível com o APK), a rota atual
   vem de nav.js (hash primeiro, pathname para URLs antigas).
   ============================================================ */
const ROTAS_PUBLICAS = ['/login', '/register', '/splash', '/not-found', '/sobre'];

/* Converte URLs antigas (/home) para /#!/home antes de decidir. */
normalizarUrl();

const pathAtual = caminhoAtual();
const temToken = !!localStorage.getItem('freelamz_token');
const ehPublica = ROTAS_PUBLICAS.some((p) => pathAtual === p || pathAtual.startsWith(p + '/'));

if (!temToken && !ehPublica) {
  redirecionar('/login');
} else if (temToken && (pathAtual === '/login' || pathAtual === '/register')) {
  redirecionar('/dashboard');
} else {
  boot();
}

/* ============================================================
   Overlay "Sem conexão" (mostrado quando a API não responde)
   ============================================================ */
let overlaySemConexao = null;

function mostrarSemConexao() {
  if (!overlaySemConexao) {
    const el = document.createElement('div');
    el.id = 'mz-sem-conexao';
    el.className = 'sem-conexao-overlay';
    el.innerHTML = `
      <div class="sem-conexao-box">
        <i class="f7-icons">wifi_exclamationmark</i>
        <h3>Sem conexão</h3>
        <p>Não foi possível contactar o servidor. Verifique a sua internet e tente novamente.</p>
        <button type="button" class="btn btn-primary">Tentar novamente</button>
      </div>`;
    const btn = el.querySelector('button');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'A tentar…';
      try {
        const res = await fetch(apiUrl('/health'), { cache: 'no-store' });
        if (res.ok) { location.reload(); return; }
      } catch (e) { /* continua offline */ }
      btn.disabled = false;
      btn.textContent = 'Tentar novamente';
      toast('Ainda sem ligação ao servidor.', 'error');
    });
    document.body.appendChild(el);
    overlaySemConexao = el;
  }
  overlaySemConexao.classList.add('show');
}

function esconderSemConexao() {
  if (overlaySemConexao) overlaySemConexao.classList.remove('show');
}

/* ============================================================
   Integração nativa (só no APK via Capacitor)
   ============================================================ */
async function configurarNativo(app) {
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  /* Botão "voltar" físico: volta uma página; na raiz minimiza o app. */
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', () => {
      const router = app.views.main.router;
      const rota = caminhoAtual();
      const raiz = ['/dashboard', '/home', '/splash', '/login', '/register'];
      if (router.history && router.history.length > 1 && !raiz.includes(rota)) {
        router.back();
      } else if (!raiz.includes(rota)) {
        router.navigate('/dashboard');
      } else {
        App.minimizeApp();
      }
    });
  } catch (e) { console.warn('[nativo] botão voltar indisponível', e); }

  /* Barra de estado azul-marinho com texto claro. */
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#0B1B3F' });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (e) { console.warn('[nativo] barra de estado indisponível', e); }

  /* Esconde a splash nativa quando o app já arrancou. */
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (e) { /* splash já escondida automaticamente */ }
}

function boot() {
  /* Estado global */
  const auth = loadAuth();
  if (auth.token) setToken(auth.token);

  window.freelaMZ = {
    apiBase: getApiBase(),
    usuario: auth.user,
    token: auth.token,
  };

  /* Eventos de conectividade emitidos por api.js */
  window.addEventListener('freelamz:sem-conexao', mostrarSemConexao);
  window.addEventListener('freelamz:online', esconderSemConexao);

  /* A view main deve arrancar já na rota atual (F5/recarregar em rota profunda).
     Sem isto o F7 arranca em '/', monta o splash e o browserHistory
     só depois empurra a rota real — o splash fica page-previous e o
     seu timer de 1,2s redirecionaria tudo para /dashboard. */
  const rota = rotaAtual();
  const viewEl = document.querySelector('.view-main');
  if (viewEl && rota && rota !== '/' && !viewEl.hasAttribute('data-url')) {
    viewEl.setAttribute('data-url', rota);
  }

  /* ---------- Inicialização do Framework7 (v8: opção é "el") ---------- */
  const app = new Framework7({
    el: '#app',
    name: 'FreelaMZ',
    id: 'mz.freelamz.app',
    theme: 'md',
    language: 'pt-MZ',
    routes,
    panel: {
      swipe: 'left',
      visibleBreakpoint: 1200, // ≥1200px: panel fixo sempre visível (F7 gere classe + margem da view)
    },
    view: {
      browserHistory: true,
      browserHistorySeparator: separadorAtual(), // APK: /#!/home · Web: /home
    },
    dialog: {
      buttonOk: 'Confirmar',
      buttonCancel: 'Cancelar',
    },
  });

  window.f7app = app;

  /* ---------- Classe de rota pública (esconde panel/tabbar no login etc.) ---------- */
  app.on('pageBeforeIn', (page) => {
    const path = (page.route && page.route.path) || '';
    document.body.classList.toggle('rota-publica', ROTAS_PUBLICAS.includes(path));
  });

  /* ---------- A cada página que entra: atualizar UI global ---------- */
  app.on('pageAfterIn', (page) => {
    const path = (page.route && page.route.path) || '';
    atualizarTabbar(path);
    aplicarNavbarAvatar();
    atualizarPanel(window.freelaMZ.usuario);
    atualizarBadges();
  });

  /* ---------- Navegação global (panel, tabbar, logout) ---------- */
  ligarNavegacaoGlobal(app);

  /* ---------- Integração nativa (Capacitor) ---------- */
  configurarNativo(app);

  /* ---------- Recarregar dados do utilizador se o token existir ---------- */
  (async () => {
    if (!auth.token) return;
    try {
      const me = await api.get('/auth/me');
      if (me && me.user) {
        saveAuth(auth.token, me.user);
        window.freelaMZ.usuario = me.user;
        atualizarPanel(me.user);
      }
    } catch (e) {
      /* api.js já trata do 401 (logout automático) */
    }
  })();

  /* ---------- FASE A: banner "MODO DE TESTE" (pagamentos fictícios) ---------- */
  (async () => {
    if (!auth.token) return;
    try {
      const c = await api.get('/payments/config');
      if (!(c && c.config && c.config.modo_teste)) return;
      if (document.getElementById('mz-modo-teste')) return;
      const el = document.createElement('div');
      el.id = 'mz-modo-teste';
      el.className = 'modo-teste-banner';
      el.innerHTML = '🧪 <b>MODO DE TESTE</b> — pagamentos fictícios (M-Pesa/e-Mola/cartão simulados)';
      document.getElementById('app').appendChild(el);
    } catch (e) { /* silencioso */ }
  })();
}

/* Boot: com browserHistory ativo, o Framework7 carrega a rota do hash
   automaticamente. A rota "/" redireciona para /splash, que decide
   entre /login e /dashboard após a animação (~1,2s). */
export default window.f7app;
