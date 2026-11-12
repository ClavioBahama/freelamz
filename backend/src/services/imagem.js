/* ============================================================
   FreelaMZ — Serviço de imagens (avatar / capa / portfólio)
   - Valida o tipo REAL do ficheiro (magic bytes), não a extensão
   - JPEG, PNG e WEBP apenas (SVG e GIF rejeitados)
   - Nome aleatório (uuid) + redimensionamento com sharp (se disponível):
       avatar    → 400x400 crop centralizado, WEBP
       capa      → 1500x500 crop centralizado, WEBP
       portfólio → máx. 1200x1200 (sem upscale), WEBP
   - Limites: avatar 2 MB, capa 4 MB, portfólio 4 MB
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ_UPLOADS = path.join(__dirname, '..', '..', 'uploads');

let sharp = null;
try {
  // opcional — o app degrada com graciosidade se não existir
  sharp = require('sharp');
} catch (e) {
  console.warn('[IMAGEM] sharp indisponível — imagens guardadas sem redimensionar');
}

/* ---------- Rate limit simples (em memória) ---------- */
const janelas = new Map();
const LIMITE_ENVIOS = 10;        // por minuto
function verificarRateLimit(userId) {
  const agora = Date.now();
  const lista = (janelas.get(userId) || []).filter((t) => agora - t < 60_000);
  if (lista.length >= LIMITE_ENVIOS) {
    return false;
  }
  lista.push(agora);
  janelas.set(userId, lista);
  return true;
}

/* ---------- Magic bytes ---------- */
function detectarTipo(buf) {
  if (!buf || buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return 'png';
  // WEBP: "RIFF" .... "WEBP"
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/* ---------- Guardar ---------- */
const CONFIG = {
  avatar: { limite: 2 * 1024 * 1024, pasta: 'avatars', sharp: { w: 400, h: 400, fit: 'cover' } },
  capa: { limite: 4 * 1024 * 1024, pasta: 'covers', sharp: { w: 1500, h: 500, fit: 'cover' } },
  portfolio: { limite: 4 * 1024 * 1024, pasta: 'portfolio', sharp: { w: 1200, h: 1200, fit: 'inside', withoutEnlargement: true } },
};

async function salvarImagem(buffer, tipo) {
  const cfg = CONFIG[tipo];
  if (!cfg) throw new Error('Tipo de imagem inválido');

  const real = detectarTipo(buffer);
  if (!real) {
    const err = new Error('Ficheiro inválido: apenas imagens JPG, PNG ou WEBP são aceites');
    err.status = 400;
    throw err;
  }
  if (buffer.length > cfg.limite) {
    const err = new Error(`Imagem demasiado grande (máx. ${Math.round(cfg.limite / 1024 / 1024)} MB)`);
    err.status = 400;
    throw err;
  }

  const nome = `${crypto.randomUUID()}`;
  fs.mkdirSync(path.join(RAIZ_UPLOADS, cfg.pasta), { recursive: true });

  let destino;
  if (sharp) {
    // converter sempre para WEBP otimizado
    destino = path.join(RAIZ_UPLOADS, cfg.pasta, `${nome}.webp`);
    await sharp(buffer).rotate().resize(cfg.sharp).webp({ quality: 82 }).toFile(destino);
  } else {
    destino = path.join(RAIZ_UPLOADS, cfg.pasta, `${nome}.${real === 'jpeg' ? 'jpg' : real}`);
    fs.writeFileSync(destino, buffer);
  }
  return `/uploads/${cfg.pasta}/${path.basename(destino)}`;
}

/* ---------- Apagar (com proteção contra path traversal) ---------- */
function apagarArquivo(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('/uploads/')) return false;
  const rel = url.replace('/uploads/', '');
  const destino = path.resolve(RAIZ_UPLOADS, rel);
  if (!destino.startsWith(path.resolve(RAIZ_UPLOADS))) return false;
  try {
    fs.unlinkSync(destino);
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------- Limites expostos (para o multer) ---------- */
function limiteDe(tipo) {
  return CONFIG[tipo] ? CONFIG[tipo].limite : 2 * 1024 * 1024;
}

module.exports = { salvarImagem, apagarArquivo, verificarRateLimit, limiteDe, detectarTipo };
