const db = require('../config/db');

const Notification = {
  async create(userId, tipo, titulo, mensagem, dados) {
    const sql = `
      INSERT INTO notifications (user_id, tipo, titulo, mensagem, dados, lida)
      VALUES (?, ?, ?, ?, ?, 0)
    `;
    await db.query(sql, [userId, tipo, titulo, mensagem, dados || null]);
  },

  async listByUser(userId, { page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const sql = `
      SELECT * FROM notifications WHERE user_id = ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(sql, [userId, parseInt(limit, 10), parseInt(offset, 10)]);
    return rows;
  },

  async unreadCount(userId) {
    const sql = `SELECT COUNT(*) as total FROM notifications WHERE user_id = ? AND lida = 0`;
    const [rows] = await db.query(sql, [userId]);
    return rows[0].total;
  },

  async markAsRead(id, userId) {
    const sql = `UPDATE notifications SET lida = 1 WHERE id = ? AND user_id = ?`;
    const [result] = await db.query(sql, [id, userId]);
    return result.affectedRows > 0;
  },

  async markAllAsRead(userId) {
    const sql = `UPDATE notifications SET lida = 1 WHERE user_id = ? AND lida = 0`;
    await db.query(sql, [userId]);
  },
};

module.exports = Notification;
