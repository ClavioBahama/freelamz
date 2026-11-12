/* ============================================================
   FreelaMZ — Sanitização e validação de campos de perfil
   Tudo validado no backend (nunca confiar só no frontend).
   ============================================================ */

/* Remove tags HTML de texto livre (evita XSS armazenado) */
function limparTexto(v, maxLen = 1000) {
  if (v == null) return null;
  let s = String(v);
  s = s.replace(/<[^>]*>/g, '');            // tags
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); // controlo
  s = s.trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

/* Lista de strings curtas (habilidades, idiomas) — sanitizadas, sem duplicados */
function limparLista(v, maxItens = 15, maxLen = 40) {
  let arr = [];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === 'string') arr = v.split(',');
  const vistas = new Set();
  const out = [];
  for (const item of arr) {
    const s = limparTexto(item, maxLen);
    if (!s) continue;
    const chave = s.toLowerCase();
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    out.push(s);
    if (out.length >= maxItens) break;
  }
  return out.join(', ');
}

/* Telefone moçambicano: +258 8X XXX XXXX (espaços opcionais) */
const RE_TELEFONE = /^\+?258\s?8\d\s?\d{3}\s?\d{4}$|^8\d{8}$/;
function telefoneOk(v) {
  if (!v) return true; // opcional
  return RE_TELEFONE.test(String(v).trim());
}

/* URL http(s) válida */
function urlOk(v) {
  if (!v) return true;
  try {
    const u = new URL(String(v));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/* Username: 3-40, letras/números/ponto/underline */
const RE_USERNAME = /^[A-Za-z0-9._]{3,40}$/;

const PROVINCIAS = [
  'Maputo Cidade', 'Maputo', 'Gaza', 'Inhambane', 'Sofala',
  'Manica', 'Tete', 'Zambézia', 'Nampula', 'Cabo Delgado', 'Niassa',
];

const IDIOMAS_SUGERIDOS = [
  'Português', 'Inglês', 'Changana', 'Emakhuwa', 'Xitswa', 'Cisena',
  'Elomwe', 'Chope', 'Ronga', 'Koti', 'Bitonga', 'Suaíli', 'Francês', 'Espanhol', 'Chinês',
];

/* Registros estruturados (educação/experiência/certificações) */
function limparRegistros(v, maxItens = 20) {
  let arr = [];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === 'string') { try { arr = JSON.parse(v); } catch (e) { return []; } }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((r) => r && typeof r === 'object')
    .slice(0, maxItens)
    .map((r) => ({
      titulo: limparTexto(r.titulo, 120) || '',
      local: limparTexto(r.local, 120) || '',
      periodo: limparTexto(r.periodo, 60) || '',
      descricao: limparTexto(r.descricao, 400) || '',
    }));
}

/* Métodos de recebimento — só strings curtas */
function limparMetodos(v) {
  const base = (v && typeof v === 'object') ? v : {};
  const out = {};
  const campos = ['mpesa', 'emola', 'mkesh', 'banco'];
  for (const c of campos) {
    if (base[c]) out[c] = limparTexto(base[c], 80);
  }
  return out;
}

module.exports = {
  limparTexto, limparLista, limparRegistros, limparMetodos,
  telefoneOk, urlOk, RE_USERNAME, PROVINCIAS, IDIOMAS_SUGERIDOS,
};
