const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const portfolioController = require('../controllers/portfolioController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { uploadAvatar, uploadCapa, uploadPortfolio } = require('../middleware/uploadImgs');

router.get('/dashboard', authenticateToken, userController.getDashboard);
/* Listagem e perfil de freelancer são públicos (visitantes sem conta
   também precisam de os ver na página inicial). O modelo remove os
   campos privados antes de responder. */
router.get('/freelancers', userController.listFreelancers);
router.get('/freelancers/:id', userController.getFreelancerById);
router.get('/clientes/:id/publico', authenticateToken, userController.getClientePublico);
router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);
router.put('/me', authenticateToken, userController.updateMe);
router.get('/me/completude', authenticateToken, userController.getCompletude);
router.put('/me/password', authenticateToken, userController.alterarSenha);
router.post('/me/avatar', authenticateToken, uploadAvatar, userController.uploadAvatar);
router.delete('/me/avatar', authenticateToken, userController.removerAvatar);
router.post('/me/cover', authenticateToken, uploadCapa, userController.uploadCapa);
router.delete('/me/cover', authenticateToken, userController.removerCapa);
router.post('/me/phone/request-code', authenticateToken, userController.pedirCodigoTelefone);
router.post('/me/phone/verify', authenticateToken, userController.verificarTelefone);

/* Portfólio */
router.get('/:id/portfolio', authenticateToken, portfolioController.listar);
router.post('/portfolio', authenticateToken, uploadPortfolio, portfolioController.criar);
router.put('/portfolio/:id', authenticateToken, uploadPortfolio, portfolioController.atualizar);
router.delete('/portfolio/:id', authenticateToken, portfolioController.apagar);

module.exports = router;
