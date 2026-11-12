const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const categoryController = require('../controllers/categoryController');
const { authenticateToken, allowRoles } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');

router.get('/', categoryController.list);
router.post('/', authenticateToken, allowRoles('ADMIN'), [
  body('nome').notEmpty(),
  body('icone').notEmpty(),
  body('cor').notEmpty(),
  validate,
], categoryController.create);
router.put('/:id', authenticateToken, allowRoles('ADMIN'), categoryController.update);
router.delete('/:id', authenticateToken, allowRoles('ADMIN'), categoryController.delete);

module.exports = router;
