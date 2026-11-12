/**
 * Gerenciamento de autenticação no cliente.
 * O token JWT é armazenado em localStorage (persistência entre recarregamentos).
 * Observação de segurança: localStorage é vulnerável a XSS. Para produção,
 * recomenda-se HttpOnly cookies ou memory storage + refresh token.
 */
const TOKEN_KEY = 'freelamz_token';
const USER_KEY = 'freelamz_user';

export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);
  return { token: token || null, user: user ? JSON.parse(user) : null };
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return !!localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
