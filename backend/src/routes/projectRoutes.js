const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const projectController = require('../controllers/projectController');
const deliveryController = require('../controllers/deliveryController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { uploadEntrega } = require('../middleware/uploadEntrega');

router.post('/', authenticateToken, [
  body('freelancerId').isInt().withMessage('Freelancer é obrigatório'),
  body('valor').isNumeric().withMessage('Valor é obrigatório'),
  body('prazo').notEmpty().withMessage('Prazo é obrigatório'),
  validate,
], projectController.create);

router.get('/', authenticateToken, projectController.list);
router.get('/:id', authenticateToken, projectController.getById);
router.put('/:id/status', authenticateToken, [
  body('status').isIn(['PENDENTE', 'AGUARDANDO_PAGAMENTO', 'EM_ANDAMENTO', 'ENTREGUE', 'CONCLUIDO', 'CANCELADO', 'EM_DISPUTA']).withMessage('Status inválido'),
  validate,
], projectController.updateStatus);

/* ---------- FASE A: entregas pelo chat ---------- */
router.post('/:id/deliveries', authenticateToken, uploadEntrega, deliveryController.create);
router.get('/:id/deliveries', authenticateToken, deliveryController.list);
router.get('/:id/deliveries/files/:fileId', authenticateToken, deliveryController.download);
router.post('/:id/deliveries/:deliveryId/approve', authenticateToken, deliveryController.approve);
router.post('/:id/deliveries/:deliveryId/revision', authenticateToken, [
  body('motivo').notEmpty().withMessage('Motivo da revisão é obrigatório'),
  validate,
], deliveryController.revision);
router.post('/:id/dispute', authenticateToken, [
  body('motivo').notEmpty().withMessage('Motivo da disputa é obrigatório'),
  validate,
], deliveryController.dispute);
router.post('/:id/confirm', authenticateToken, deliveryController.confirm);

/* ---------- Ajuste de valor (valor travado após pagamento) ---------- */
router.post('/:id/adjustments', authenticateToken, [
  body('valor_novo').isFloat({ min: 1 }).withMessage('Novo valor inválido'),
  validate,
], deliveryController.proposeAdjustment);
router.post('/:id/adjustments/:adjustmentId/respond', authenticateToken, [
  body('aceitar').isBoolean().withMessage('Responda com aceitar=true ou false'),
  validate,
], deliveryController.respondAdjustment);

/* ---------- Cancelamento de comum acordo ---------- */
router.post('/:id/cancel', authenticateToken, [
  body('motivo').notEmpty().withMessage('Motivo é obrigatório'),
  validate,
], deliveryController.requestCancel);
router.post('/:id/cancel/:reqId/respond', authenticateToken, [
  body('aceitar').isBoolean().withMessage('Responda com aceitar=true ou false'),
  validate,
], deliveryController.respondCancel);

module.exports = router;
