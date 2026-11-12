const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const reviewController = require('../controllers/reviewController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');

router.post('/', authenticateToken, [
  body('projeto_id').isInt().withMessage('Projeto é obrigatório'),
  body('avaliado_id').isInt().withMessage('Avaliado é obrigatório'),
  body('nota').isInt({ min: 1, max: 5 }).withMessage('Nota deve ser entre 1 e 5'),
  validate,
], reviewController.create);

router.get('/user/:userId', reviewController.listByUser);
router.get('/rating/:userId', reviewController.averageRating);

module.exports = router;
