const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const favoriteController = require('../controllers/favoriteController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');

router.post('/', authenticateToken, [
  body('tipo').isIn(['freelancer', 'servico']).withMessage('Tipo inválido'),
  body('alvo_id').isInt().withMessage('Alvo é obrigatório'),
  validate,
], favoriteController.add);

router.delete('/', authenticateToken, [
  body('tipo').isIn(['freelancer', 'servico']).withMessage('Tipo inválido'),
  body('alvo_id').isInt().withMessage('Alvo é obrigatório'),
  validate,
], favoriteController.remove);

router.get('/is-favorite', authenticateToken, favoriteController.isFavorite);
router.get('/', authenticateToken, favoriteController.list);

module.exports = router;
