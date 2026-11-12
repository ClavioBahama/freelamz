const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');

router.get('/config', authenticateToken, paymentController.config);

router.post('/pay', authenticateToken, [
  body('projectId').isInt({ min: 1 }).withMessage('Projeto inválido'),
  body('metodo').isIn(['SALDO', 'MPESA', 'EMOLA', 'CARTAO']).withMessage('Método inválido'),
  validate,
], paymentController.pay);

router.get('/wallet', authenticateToken, paymentController.wallet);
router.get('/wallet/transactions', authenticateToken, paymentController.transactions);

router.post('/wallet/recharge', authenticateToken, [
  body('valor').isFloat({ min: 1, max: 10000 }).withMessage('Valor entre 1 e 10.000 MT'),
  validate,
], paymentController.recharge);

router.post('/wallet/withdraw', authenticateToken, [
  body('valor').isFloat({ min: 1 }).withMessage('Valor de saque inválido'),
  body('metodo').isIn(['MPESA', 'EMOLA', 'BANCO']).withMessage('Método de saque inválido'),
  body('destino').notEmpty().withMessage('Destino é obrigatório'),
  validate,
], paymentController.withdraw);

router.get('/withdrawals', authenticateToken, paymentController.myWithdrawals);

module.exports = router;
