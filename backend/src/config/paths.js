/* ============================================================
   FreelaMZ — Caminhos de armazenamento configuráveis

   UPLOADS_DIR          pasta dos ficheiros públicos (/uploads)
                        por omissão: backend/uploads
   UPLOADS_PRIVATE_DIR  pasta privada das entregas
                        por omissão: <UPLOADS_DIR>/../uploads_private

   No Railway, monte um Volume em /app/uploads e defina
   UPLOADS_DIR=/app/uploads (assim as imagens sobrevivem a deploys).
   ============================================================ */
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(BACKEND_ROOT, 'uploads');

const UPLOADS_PRIVATE_DIR = process.env.UPLOADS_PRIVATE_DIR
  ? path.resolve(process.env.UPLOADS_PRIVATE_DIR)
  : path.join(path.dirname(UPLOADS_DIR), 'uploads_private');

const DELIVERIES_DIR = path.join(UPLOADS_PRIVATE_DIR, 'deliveries');

/* Garante que as pastas existem (idempotente). */
function garantirPastas() {
  const fs = require('fs');
  for (const dir of [
    UPLOADS_DIR,
    path.join(UPLOADS_DIR, 'avatars'),
    path.join(UPLOADS_DIR, 'covers'),
    path.join(UPLOADS_DIR, 'portfolio'),
    path.join(UPLOADS_DIR, 'services'),
    path.join(UPLOADS_DIR, 'profiles'),
    path.join(UPLOADS_DIR, 'seed'),
    DELIVERIES_DIR,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = {
  BACKEND_ROOT,
  UPLOADS_DIR,
  UPLOADS_PRIVATE_DIR,
  DELIVERIES_DIR,
  garantirPastas,
};
