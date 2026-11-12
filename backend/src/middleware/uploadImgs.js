/* ============================================================
   FreelaMZ — Middleware de upload de imagens (memória)
   A validação real (magic bytes + tamanho) acontece no serviço
   de imagem; aqui configuramos o multer por tipo.
   ============================================================ */
const multer = require('multer');
const { limiteDe } = require('../services/imagem');

const storage = multer.memoryStorage();

const EXTENSIONES_OK = ['.jpg', '.jpeg', '.png', '.webp'];

function criar(tipo) {
  return multer({
    storage,
    limits: { fileSize: limiteDe(tipo) },
    fileFilter: (req, file, cb) => {
      // checagem leve por extensão/mimetype — a validação forte é nos magic bytes
      const ext = (file.originalname || '').toLowerCase().match(/\.[a-z0-9]+$/);
      const extOk = ext && EXTENSIONES_OK.includes(ext[0]);
      const mimeOk = /^image\/(jpeg|png|webp)$/.test(file.mimetype || '');
      if (extOk && mimeOk) return cb(null, true);
      const err = new Error('Apenas imagens JPG, PNG ou WEBP são permitidas');
      err.status = 400;
      cb(err);
    },
  }).single('imagem');
}

/* Upload de várias imagens (portfólio: até 4 por item) */
function criarMulti(tipo, max = 4) {
  return multer({
    storage,
    limits: { fileSize: limiteDe(tipo), files: max },
    fileFilter: (req, file, cb) => {
      const ext = (file.originalname || '').toLowerCase().match(/\.[a-z0-9]+$/);
      const extOk = ext && EXTENSIONES_OK.includes(ext[0]);
      const mimeOk = /^image\/(jpeg|png|webp)$/.test(file.mimetype || '');
      if (extOk && mimeOk) return cb(null, true);
      const err = new Error('Apenas imagens JPG, PNG ou WEBP são permitidas');
      err.status = 400;
      cb(err);
    },
  }).fields([{ name: 'imagens', maxCount: max }]);
}

module.exports = {
  uploadAvatar: criar('avatar'),
  uploadCapa: criar('capa'),
  uploadPortfolio: criarMulti('portfolio', 4),
};
