const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');
const { authenticateToken, allowRoles } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');

const admin = [authenticateToken, allowRoles('ADMIN')];

router.get('/stats', admin, adminController.stats);
router.get('/users', admin, adminController.listUsers);
router.put('/users/:id', admin, [
  body('nome').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('tipo_usuario').optional().isIn(['CLIENTE', 'FREELANCER', 'ADMIN']).withMessage('Tipo inválido'),
  body('status').optional().isIn(['ativo', 'bloqueado', 'inativo']).withMessage('Status inválido'),
  validate,
], adminController.updateUser);
router.delete('/users/:id', admin, adminController.deleteUser);
router.put('/users/:id/verify', admin, [
  body('verificado').isBoolean().withMessage('verificado deve ser booleano'),
  validate,
], adminController.verifyUser);
router.delete('/users/:id/avatar', admin, adminController.removerFoto);
router.put('/users/:id/block', admin, adminController.blockUser);
router.put('/users/:id/unblock', admin, adminController.unblockUser);
router.get('/services', admin, adminController.listServices);
router.delete('/services/:id', admin, adminController.deleteService);
router.get('/projects', admin, adminController.listProjects);
router.get('/proposals', admin, adminController.listProposals);
router.put('/proposals/:id/status', admin, [
  body('status').isIn(['PENDENTE', 'ACEITA', 'RECUSADA', 'CANCELADA']).withMessage('Status inválido'),
  validate,
], adminController.updateProposalStatus);
router.get('/reviews', admin, adminController.listReviews);
router.delete('/reviews/:id', admin, adminController.deleteReview);
router.get('/reports', admin, adminController.listReports);
router.put('/reports/:id', admin, [
  body('status').isIn(['PENDENTE', 'RESOLVIDA', 'REJEITADA']).withMessage('Status inválido'),
  validate,
], adminController.updateReport);

/* ---------- FASE A: painel financeiro ---------- */
router.get('/finance', admin, adminController.financeStats);
router.put('/settings', admin, [
  body('chave').isIn(['comissao_percentual', 'max_revisoes', 'dias_liberacao_automatica']).withMessage('Chave inválida'),
  body('valor').isFloat().withMessage('Valor numérico obrigatório'),
  validate,
], adminController.updateSetting);
router.get('/withdrawals', admin, adminController.listWithdrawals);
router.put('/withdrawals/:id', admin, [
  body('aprovar').isBoolean().withMessage('aprovar deve ser booleano'),
  validate,
], adminController.processWithdrawal);
router.get('/disputes', admin, adminController.listDisputes);
router.put('/disputes/:projectId/resolve', admin, [
  body('decisao').isIn(['LIBERAR_FREELANCER', 'REEMBOLSAR_CLIENTE', 'DIVIDIR']).withMessage('Decisão inválida'),
  body('motivo').notEmpty().withMessage('Motivo é obrigatório (auditoria)'),
  validate,
], adminController.resolveDispute);

module.exports = router;
