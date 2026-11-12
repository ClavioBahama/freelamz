const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const proposalController = require('../controllers/proposalController');
const { authenticateToken, allowRoles } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');

router.post('/', authenticateToken, allowRoles('FREELANCER'), [
  body('projeto_id').isInt().withMessage('Projeto é obrigatório'),
  body('preco').isNumeric().withMessage('Preço é obrigatório'),
  body('prazo').notEmpty().withMessage('Prazo é obrigatório'),
  validate,
], proposalController.create);

router.get('/projeto/:projetoId', authenticateToken, proposalController.listByProject);
router.get('/me/freelancer', authenticateToken, allowRoles('FREELANCER'), proposalController.listByFreelancer);
router.get('/me/cliente', authenticateToken, allowRoles('CLIENTE'), proposalController.listByCliente);

router.put('/:id/status', authenticateToken, [
  body('status').isIn(['PENDENTE', 'ACEITA', 'RECUSADA', 'CANCELADA']).withMessage('Status inválido'),
  validate,
], proposalController.updateStatus);

module.exports = router;
