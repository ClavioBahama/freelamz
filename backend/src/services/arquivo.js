/* ============================================================
   FreelaMZ — Ficheiros de entrega (uploads_private/deliveries)
   - Até 5 ficheiros por entrega, 20 MB cada
   - Tipos: PDF, ZIP, JPG, PNG, WEBP, DOCX, XLSX, MP4
   - Validação REAL por magic bytes (não pela extensão)
   - Nome aleatório (uuid); guardado FORA de /uploads público —
     o download passa sempre pelo endpoint autorizado
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.join(__dirname, '..', '..', 'uploads_private', 'deliveries');

const LIMITE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_FICHEIROS = 5;

const EXTENSOES_OK = ['.pdf', '.zip', '.jpg', '.jpeg', '.png', '.webp', '.docx', '.xlsx', '.mp4'];

/* ---------- Magic bytes ---------- */
function detectarTipo(buf, nomeOriginal) {
  if (!buf || buf.length < 8) return null;
  const ext = (nomeOriginal || '').toLowerCase().match(/\.[a-z0-9]+$/);
  const extOk = ext ? ext[0] : null;

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return extOk === '.jpg' || extOk === '.jpeg' ? 'imagem' : null;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return extOk === '.png' ? 'imagem' : null;
  // WEBP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return extOk === '.webp' ? 'imagem' : null;
  // PDF
  if (buf.toString('ascii', 0, 5) === '%PDF-') return extOk === '.pdf' ? 'pdf' : null;
  // ZIP / OOXML (docx, xlsx são pacotes ZIP)
  const ehZip = buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07);
  if (ehZip) {
    if (extOk === '.docx') return 'docx';
    if (extOk === '.xlsx') return 'xlsx';
    if (extOk === '.zip') return 'zip';
    return null;
  }
  // MP4 (caixa ftyp nos primeiros bytes)
  if (buf.toString('ascii', 4, 8) === 'ftyp') return extOk === '.mp4' ? 'video' : null;
  return null;
}

/* ---------- Guardar (com validação completa) ---------- */
function salvarArquivoEntrega(buffer, nomeOriginal) {
  const ext = (nomeOriginal || '').toLowerCase().match(/\.[a-z0-9]+$/);
  const extOk = ext && EXTENSOES_OK.includes(ext[0]);
  const real = detectarTipo(buffer, nomeOriginal);
  if (!extOk || !real) {
    const err = new Error('Ficheiro inválido: apenas PDF, ZIP, DOCX, XLSX, MP4 e imagens JPG/PNG/WEBP são aceites');
    err.status = 400;
    throw err;
  }
  if (buffer.length > LIMITE_BYTES) {
    const err = new Error('Ficheiro demasiado grande (máx. 20 MB por ficheiro)');
    err.status = 400;
    throw err;
  }
  fs.mkdirSync(RAIZ, { recursive: true });
  const nome = `${crypto.randomUUID()}${ext[0]}`;
  fs.writeFileSync(path.join(RAIZ, nome), buffer);
  return {
    url: `deliveries/${nome}`,             // caminho relativo à pasta privada
    nome_original: String(nomeOriginal).slice(0, 255),
    tipo: real,
    tamanho: buffer.length,
    caminho: path.join(RAIZ, nome),
  };
}

/* ---------- Ler para download (protegido contra path traversal) ---------- */
function caminhoArquivo(urlRelativa) {
  if (!urlRelativa || typeof urlRelativa !== 'string' || !urlRelativa.startsWith('deliveries/')) return null;
  const destino = path.resolve(RAIZ, urlRelativa.replace('deliveries/', ''));
  if (!destino.startsWith(path.resolve(RAIZ))) return null;
  return fs.existsSync(destino) ? destino : null;
}

/* ---------- Apagar (rollback de entrega que falhou) ---------- */
function apagarArquivo(urlRelativa) {
  try {
    const destino = caminhoArquivo(urlRelativa);
    if (destino) fs.unlinkSync(destino);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { salvarArquivoEntrega, caminhoArquivo, apagarArquivo, LIMITE_BYTES, MAX_FICHEIROS, EXTENSOES_OK };
