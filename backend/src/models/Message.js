const db = require('../config/db');

const Message = {
  async send({ remetente_id, destinatario_id, projeto_id, texto, tipo = 'TEXTO', extra = null }) {
    const sql = `
      INSERT INTO messages (remetente_id, destinatario_id, projeto_id, mensagem, lida, tipo, extra)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `;
    const extraStr = extra && typeof extra === 'object' ? JSON.stringify(extra) : (extra || null);
    const [result] = await db.query(sql, [remetente_id, destinatario_id, projeto_id, texto, tipo, extraStr]);
    return this.getById(result.insertId);
  },

  async getById(id) {
    const sql = `
      SELECT m.*, m.mensagem AS texto, u.nome as remetente_nome, u.foto as remetente_foto
      FROM messages m
      JOIN users u ON m.remetente_id = u.id
      WHERE m.id = ?
    `;
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
  },

  async conversation(usuarioA, usuarioB, projetoId, { page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT m.*, m.mensagem AS texto, u.nome as remetente_nome, u.foto as remetente_foto
      FROM messages m
      JOIN users u ON m.remetente_id = u.id
      WHERE ((m.remetente_id = ? AND m.destinatario_id = ?)
         OR (m.remetente_id = ? AND m.destinatario_id = ?))
    `;
    const values = [usuarioA, usuarioB, usuarioB, usuarioA];
    if (projetoId) { sql += ' AND m.projeto_id = ?'; values.push(projetoId); }
    sql += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    values.push(parseInt(limit, 10), parseInt(offset, 10));
    const [rows] = await db.query(sql, values);
    return rows.reverse();
  },

  async markAsRead(destinatarioId, remetenteId) {
    const sql = `
      UPDATE messages SET lida = 1
      WHERE destinatario_id = ? AND remetente_id = ? AND lida = 0
    `;
    await db.query(sql, [destinatarioId, remetenteId]);
  },

  async unreadCount(userId) {
    const sql = `SELECT COUNT(*) as total FROM messages WHERE destinatario_id = ? AND lida = 0`;
    const [rows] = await db.query(sql, [userId]);
    return rows[0].total;
  },

  async listConversations(userId) {
    // Última mensagem por parceiro (subquery em vez de GROUP BY, compatível com only_full_group_by)
    const sql = `
      SELECT m.id, m.remetente_id, m.destinatario_id, m.projeto_id,
             m.mensagem AS texto, m.lida, m.created_at,
             u.id as outro_id, u.nome as outro_nome, u.foto as outro_foto, u.tipo_usuario as outro_tipo
      FROM messages m
      JOIN users u ON (m.remetente_id = u.id OR m.destinatario_id = u.id)
      WHERE (m.remetente_id = ? OR m.destinatario_id = ?) AND u.id != ?
        AND m.id = (
          SELECT MAX(m2.id) FROM messages m2
          WHERE (m2.remetente_id = u.id AND m2.destinatario_id = ?)
             OR (m2.destinatario_id = u.id AND m2.remetente_id = ?)
        )
      ORDER BY m.created_at DESC
    `;
    const [rows] = await db.query(sql, [userId, userId, userId, userId, userId]);
    return rows;
  },
};

module.exports = Message;
