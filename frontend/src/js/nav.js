/* ============================================================
   FreelaMZ — Navegação compatível com Web e APK (Capacitor)

   Web: mantém browserHistory normal (/home).
   APK: os ficheiros são servidos a partir de "/" e NÃO existe
   fallback de SPA (uma rota /home daria 404 ao recarregar), por
   isso as rotas vivem no HASH: /#!/home
   O Framework7 lê o hash ao arrancar (browserHistorySeparator '#!').
   ============================================================ */

export const SEPARADOR = '#!';

/* Estamos dentro do APK (Capacitor)? */
export function ehNativo() {
  const cap = window.Capacitor;
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

/* Separador de histórico a usar na configuração do Framework7. */
export function separadorAtual() {
  return ehNativo() ? SEPARADOR : '';
}

/* Rota atual: no APK vem do hash; na web vem do pathname.
   O hash também serve de compatibilidade se existir. */
export function rotaAtual() {
  const h = location.hash || '';
  if (h.startsWith(SEPARADOR)) {
    let p = h.slice(SEPARADOR.length);
    if (p.startsWith(' ')) p = p.slice(1); // tolera "#! /home"
    return p || '/';
  }
  return location.pathname || '/';
}

/* Rota sem query string. */
export function caminhoAtual() {
  const r = rotaAtual();
  const i = r.indexOf('?');
  return i >= 0 ? r.slice(0, i) : r;
}

/* URL com hash (usada apenas no APK). */
export function urlRota(path) {
  return `/${SEPARADOR}${path}`;
}

/* Normaliza URLs antigas sem hash (/home) para /#!/home.
   Só no APK e sem recarregar a página (replaceState). */
export function normalizarUrl() {
  if (!ehNativo()) return;
  const path = location.pathname;
  if (location.hash || !path || path === '/') return;
  const destino = `/${SEPARADOR}${path}${location.search}`;
  try {
    history.replaceState(history.state, '', destino);
  } catch (e) {
    /* ignorar (ambiente sem history) */
  }
}

/* Navega para uma rota. Usa o router do F7 quando já existe;
   caso contrário recarrega a página com o hash (no APK) ou
   navega normalmente (na web). */
export function navegar(path, { recarregar = false } = {}) {
  const app = window.f7app;
  if (!recarregar && app && app.views && app.views.main && app.views.main.router) {
    app.views.main.router.navigate(path);
    return;
  }
  if (ehNativo()) {
    location.replace(urlRota(path));
    location.reload();
  } else {
    location.replace(path);
  }
}

/* Redireciona no arranque (antes do Framework7 existir). */
export function redirecionar(path) {
  navegar(path, { recarregar: true });
}
