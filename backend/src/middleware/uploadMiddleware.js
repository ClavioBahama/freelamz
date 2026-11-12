const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { UPLOADS_DIR } = require('../config/paths');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tipo = req.query.tipo || 'profiles';
    const dir = path.join(UPLOADS_DIR, tipo);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype);
  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error('Apenas imagens (jpg, jpeg, png, gif, webp) são permitidas'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880 },
});

module.exports = { upload };
