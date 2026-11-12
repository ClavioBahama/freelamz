const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/uploadMiddleware');
const uploadController = require('../controllers/uploadController');

router.post('/', upload.single('arquivo'), uploadController.uploadFile);

module.exports = router;
