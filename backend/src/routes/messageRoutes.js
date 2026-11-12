const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/', authenticateToken, messageController.send);
router.get('/conversation', authenticateToken, messageController.conversation);
router.get('/conversations', authenticateToken, messageController.listConversations);
router.get('/unread-count', authenticateToken, messageController.unreadCount);

module.exports = router;
