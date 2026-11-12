/**
 * Camada de requisições à API REST do FreelaMZ.
 * Em desenvolvimento usa o proxy do Vite (/api -> http://localhost:3000).
 * No APK usa VITE_API_URL (ex.: https://api.exemplo.com/api).
 * Em caso de 401 (token inválido/expirado), faz logout automático.
 */
import { loadAuth, clearAuth, saveAuth } from './auth.js';
import { caminhoAtual, redirecionar } from './nav.js';

/* Remove barras finais para evitar "//" nos endpoints. */
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

/* Origem do backend (sem o sufixo /api). Vazia quando usamos o proxy. */
const API_ORIGIN = /^https?:\/\//i.test(API_BASE) ? API_BASE.replace(/\/api$/i, '') : '';

/* Constrói a URL completa de um recurso servido pelo backend
   (avatares, capas, portfólio, imagens de serviços, anexos...).
   Aceita caminhos relativos ("/uploads/..."), absolutos ("https://...")
   e valores vazios. No proxy devolve o caminho relativo. */
export function assetUrl(path) {
  if (!path) return '';
  const p = String(path);
  if (/^(https?:|data:|blob:)/i.test(p)) return p;
  const caminho = p.startsWith('/') ? p : `/${p}`;
  return API_ORIGIN ? `${API_ORIGIN}${caminho}` : caminho;
}

/* URL completa de um endpoint da API (para fetch fora do helper). */
export function apiUrl(endpoint) {
  const e = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}${e}`;
}

export function getApiBase() {
  return API_BASE;
}

/* Avisa o app quando a API não responde (overlay "Sem conexão"). */
function avisarSemConexao() {
  try {
    window.dispatchEvent(new CustomEvent('freelamz:sem-conexao'));
  } catch (e) { /* ignorar */ }
}

function avisarOnline() {
  try {
    window.dispatchEvent(new CustomEvent('freelamz:online'));
  } catch (e) { /* ignorar */ }
}

let token = loadAuth().token || '';

export function setToken(t) {
  token = t;
}

export function getToken() {
  return token;
}

export function clearToken() {
  token = '';
}

function sessaoExpirada() {
  clearAuth();
  clearToken();
  if (!caminhoAtual().startsWith('/login')) {
    redirecionar('/login?expirada=1');
  }
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(apiUrl(endpoint), {
      ...options,
      headers,
    });
  } catch (e) {
    avisarSemConexao();
    const err = new Error('Sem ligação ao servidor. Verifique a sua internet ou se o backend está a rodar.');
    err.network = true;
    throw err;
  }
  avisarOnline();

  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = {};
  }

  if (res.status === 401) {
    /* Só termina a sessão se havia mesmo uma sessão iniciada.
       Numa página pública (sem token) um 401 não deve expulsar o visitante. */
    if (token) {
      sessaoExpirada();
      const err = new Error(data.message || 'Sessão expirada. Faça login novamente.');
      err.status = 401;
      throw err;
    }
    const err = new Error(data.message || 'Precisa de iniciar sessão para continuar.');
    err.status = 401;
    err.data = data;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(data.message || 'Erro na requisição');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint, body) => request(endpoint, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
  postForm: async (endpoint, formData) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(apiUrl(endpoint), { method: 'POST', headers, body: formData });
    } catch (e) {
      avisarSemConexao();
      const err = new Error('Sem ligação ao servidor.');
      err.network = true;
      throw err;
    }
    avisarOnline();
    let data;
    try { data = await res.json(); } catch (e) { data = {}; }
    if (res.status === 401) { if (token) sessaoExpirada(); }
    if (!res.ok) { const err = new Error(data.message || 'Erro no upload'); err.status = res.status; throw err; }
    return data;
  },
  putForm: async (endpoint, formData) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(apiUrl(endpoint), { method: 'PUT', headers, body: formData });
    } catch (e) {
      avisarSemConexao();
      const err = new Error('Sem ligação ao servidor.');
      err.network = true;
      throw err;
    }
    avisarOnline();
    let data;
    try { data = await res.json(); } catch (e) { data = {}; }
    if (res.status === 401) { if (token) sessaoExpirada(); }
    if (!res.ok) { const err = new Error(data.message || 'Erro no upload'); err.status = res.status; throw err; }
    return data;
  },
};
