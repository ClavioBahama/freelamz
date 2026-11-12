const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const serviceController = require('../controllers/serviceController');
const { authenticateToken, allowRoles } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');

router.get('/', serviceController.list);
router.get('/:id', serviceController.getById);
router.post('/', authenticateToken, allowRoles('FREELANCER'), [
  body('titulo').notEmpty().withMessage('Título é obrigatório'),
  body('descricao').notEmpty().withMessage('Descrição é obrigatória'),
  body('categoria_id').isInt().withMessage('Categoria é obrigatória'),
  body('preco').isNumeric().withMessage('Preço é obrigatório'),
  body('prazo_entrega').notEmpty().withMessage('Prazo de entrega é obrigatório'),
  validate,
], serviceController.create);
router.put('/:id', authenticateToken, allowRoles('FREELANCER'), serviceController.update);
router.delete('/:id', authenticateToken, allowRoles('FREELANCER'), serviceController.delete);

module.exports = router;
