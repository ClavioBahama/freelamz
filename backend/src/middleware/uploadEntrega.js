/* ============================================================
   FreelaMZ — Middleware de upload de ficheiros de entrega
   Multer em memória; a validação forte (magic bytes + tamanho)
   acontece no serviço arquivo.js. Máx: 5 ficheiros de 20 MB.
   ============================================================ */
const multer = require('multer');
const { LIMITE_BYTES, MAX_FICHEIROS, EXTENSOES_OK } = require('../services/arquivo');

const storage = multer.memoryStorage();

function extOk(nome) {
  const ext = (nome || '').toLowerCase().match(/\.[a-z0-9]+$/);
  return ext && EXTENSOES_OK.includes(ext[0]);
}

const uploadEntrega = multer({
  storage,
  limits: { fileSize: LIMITE_BYTES, files: MAX_FICHEIROS },
  fileFilter: (req, file, cb) => {
    if (extOk(file.originalname)) return cb(null, true);
    const err = new Error('Apenas PDF, ZIP, DOCX, XLSX, MP4 e imagens são permitidos');
    err.status = 400;
    cb(err);
  },
}).array('arquivos', MAX_FICHEIROS);

module.exports = { uploadEntrega };
