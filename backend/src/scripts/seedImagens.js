/* ============================================================
   FreelaMZ — Geração LOCAL de imagens para o seed
   Cria avatares (400x400), capas (1500x500) e imagens de
   portfólio (1200x900) diretamente com sharp + SVG embutido.
   Nenhum link externo — tudo gerado em uploads/seed.
   ============================================================ */
const fs = require('fs');
const path = require('path');

let sharp = null;
try { sharp = require('sharp'); } catch (e) {
  throw new Error('sharp é necessário para gerar as imagens do seed (npm i sharp)');
}

const PASTA = path.join(__dirname, '..', '..', 'uploads', 'seed');

/* Paletas por categoria de freelancer (gradiente + cor de acento) */
const PALETAS = [
  ['#2563eb', '#4f46e5', '#dbeafe'], // azul
  ['#7c3aed', '#a855f7', '#ede9fe'], // violeta
  ['#10b981', '#14b8a6', '#d1fae5'], // verde
  ['#f43f5e', '#ec4899', '#ffe4e6'], // coral
  ['#f59e0b', '#fbbf24', '#fef3c7'], // âmbar
  ['#06b6d4', '#0ea5e9', '#cffafe'], // ciano
];

function corDeterministica(semente) {
  let h = 0;
  for (const ch of String(semente)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return PALETAS[h % PALETAS.length];
}

/* Escapa entidades XML para texto embutido no SVG */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const svg = (w, h, corpo) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${corpo}</svg>`;

/* Avatar: fundo gradiente + iniciais brancas */
function avatarSvg(nome) {
  const [c1, c2] = corDeterministica(nome);
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  const iniciais = esc((partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase());
  return svg(400, 400, `
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="400" height="400" fill="url(#g)"/>
    <circle cx="200" cy="170" r="78" fill="rgba(255,255,255,0.16)"/>
    <circle cx="330" cy="90" r="30" fill="rgba(255,255,255,0.10)"/>
    <circle cx="60" cy="330" r="44" fill="rgba(255,255,255,0.08)"/>
    <text x="200" y="240" font-family="Segoe UI, Arial, sans-serif" font-size="150" font-weight="800"
      fill="rgba(255,255,255,0.94)" text-anchor="middle">${iniciais}</text>
  `);
}

/* Capa: gradiente escuro + padrão geométrico + nome da área */
function capaSvg(tema) {
  const [c1, c2, claro] = corDeterministica(tema);
  const rotulo = esc(String(tema || 'FreelaMZ').toUpperCase().slice(0, 24));
  const chips = Array.from({ length: 10 }, (_, i) => {
    const x = 30 + (i * 150) % 1400;
    const y = 60 + ((i * 97) % 320);
    const r = 8 + (i % 4) * 6;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${claro}" opacity="0.28"/>`;
  }).join('');
  const barras = Array.from({ length: 7 }, (_, i) => {
    const x = 60 + i * 200;
    const h = 60 + ((i * 83) % 220);
    return `<rect x="${x}" y="${500 - h}" width="14" height="${h}" rx="7" fill="${claro}" opacity="0.22"/>`;
  }).join('');
  return svg(1500, 500, `
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="1500" height="500" fill="url(#g)"/>
    <rect width="1500" height="500" fill="rgba(11,27,63,0.25)"/>
    ${chips}${barras}
    <text x="70" y="80" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800"
      fill="rgba(255,255,255,0.85)" letter-spacing="6">${rotulo}</text>
    <text x="70" y="440" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="600"
      fill="rgba(255,255,255,0.5)">freelamz.co.mz</text>
  `);
}

/* Imagem de portfólio: mockup abstrato do tipo de trabalho */
function portfolioSvg(tema, variante) {
  const [c1, c2, claro] = corDeterministica(tema + variante);
  const v = Number(variante) % 3;
  let corpo;
  if (v === 0) {
    // mock de website
    corpo = `
      <rect x="80" y="120" width="1040" height="660" rx="18" fill="#ffffff" opacity="0.96"/>
      <rect x="80" y="120" width="1040" height="72" rx="18" fill="${claro}"/>
      <circle cx="120" cy="156" r="10" fill="${c1}"/><circle cx="150" cy="156" r="10" fill="${c2}"/><circle cx="180" cy="156" r="10" fill="#94a3b8"/>
      <rect x="110" y="220" width="300" height="26" rx="6" fill="${c1}" opacity="0.85"/>
      <rect x="110" y="270" width="460" height="14" rx="4" fill="#cbd5e1"/>
      <rect x="110" y="296" width="400" height="14" rx="4" fill="#cbd5e1"/>
      <rect x="640" y="220" width="450" height="300" rx="12" fill="${claro}"/>
      <rect x="110" y="560" width="204" height="110" rx="10" fill="${c2}" opacity="0.3"/>
      <rect x="340" y="560" width="204" height="110" rx="10" fill="${c1}" opacity="0.25"/>
      <rect x="570" y="560" width="204" height="110" rx="10" fill="${c2}" opacity="0.2"/>
    `;
  } else if (v === 1) {
    // mock de brand/marketing
    corpo = `
      <rect x="140" y="120" width="920" height="660" rx="24" fill="#ffffff" opacity="0.95"/>
      <circle cx="600" cy="330" r="120" fill="${c1}"/>
      <circle cx="600" cy="330" r="80" fill="${c2}"/>
      <circle cx="600" cy="330" r="44" fill="${claro}"/>
      <rect x="430" y="500" width="340" height="24" rx="8" fill="${c1}" opacity="0.8"/>
      <rect x="480" y="545" width="240" height="14" rx="5" fill="#cbd5e1"/>
      <rect x="230" y="620" width="120" height="44" rx="22" fill="${claro}"/>
      <rect x="370" y="620" width="120" height="44" rx="22" fill="${c1}" opacity="0.7"/>
      <rect x="510" y="620" width="120" height="44" rx="22" fill="${c2}" opacity="0.7"/>
      <rect x="650" y="620" width="120" height="44" rx="22" fill="${claro}"/>
    `;
  } else {
    // mock de conteúdo/vídeo/foto
    corpo = `
      <rect x="110" y="140" width="560" height="420" rx="16" fill="${c1}" opacity="0.92"/>
      <circle cx="390" cy="350" r="60" fill="rgba(255,255,255,0.9)"/>
      <polygon points="378,320 378,380 424,350" fill="${c1}"/>
      <rect x="700" y="140" width="400" height="190" rx="14" fill="${c2}" opacity="0.9"/>
      <rect x="700" y="360" width="400" height="190" rx="14" fill="${claro}"/>
      <rect x="110" y="600" width="990" height="16" rx="6" fill="${claro}"/>
      <rect x="110" y="640" width="700" height="16" rx="6" fill="${claro}" opacity="0.7"/>
    `;
  }
  return svg(1200, 900, `
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${claro}"/><stop offset="1" stop-color="#f8fafc"/>
    </linearGradient></defs>
    <rect width="1200" height="900" fill="url(#bg)"/>
    ${corpo}
  `);
}

async function gerar(tipo, chave, tema, variante = 0) {
  fs.mkdirSync(PASTA, { recursive: true });
  const nomeArquivo = `${tipo}-${chave}${variante ? '-' + variante : ''}.webp`;
  const destino = path.join(PASTA, nomeArquivo);
  const buf = tipo === 'avatar' ? avatarSvg(chave)
    : tipo === 'capa' ? capaSvg(tema || chave)
    : portfolioSvg(tema || chave, variante);
  await sharp(Buffer.from(buf)).webp({ quality: 85 }).toFile(destino);
  return `/uploads/seed/${nomeArquivo}`;
}

/* Apaga todas as imagens de seed (para regenerar) */
function limpar() {
  if (fs.existsSync(PASTA)) {
    for (const f of fs.readdirSync(PASTA)) {
      if (f.endsWith('.webp')) fs.unlinkSync(path.join(PASTA, f));
    }
  }
}

module.exports = { gerar, limpar };
