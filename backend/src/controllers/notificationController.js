const Notification = require('../models/Notification');

const notificationController = {
  async list(req, res) {
    try {
      const notifications = await Notification.listByUser(req.user.id, { page: req.query.page, limit: req.query.limit });
      res.json({ success: true, notifications });
    } catch (err) {
      console.error('[NOTIF] Erro ao listar notificações:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async unreadCount(req, res) {
    try {
      const total = await Notification.unreadCount(req.user.id);
      res.json({ success: true, total });
    } catch (err) {
      console.error('[NOTIF] Erro ao contar não lidas:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async markAsRead(req, res) {
    try {
      const ok = await Notification.markAsRead(req.params.id, req.user.id);
      res.json({ success: true, marked: ok });
    } catch (err) {
      console.error('[NOTIF] Erro ao marcar como lida:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async markAllAsRead(req, res) {
    try {
      await Notification.markAllAsRead(req.user.id);
      res.json({ success: true, message: 'Todas marcadas como lidas' });
    } catch (err) {
      console.error('[NOTIF] Erro ao marcar todas:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },
};

module.exports = notificationController;
