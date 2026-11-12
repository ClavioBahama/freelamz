const path = require('path');

const uploadController = {
  uploadFile(req, res) {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });
    }
    const url = `/uploads/${req.query.tipo || 'profiles'}/${req.file.filename}`;
    res.json({ success: true, url, filename: req.file.filename });
  },
};

module.exports = uploadController;
