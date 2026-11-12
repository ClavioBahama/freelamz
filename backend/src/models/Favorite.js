const db = require('../config/db');

const Favorite = {
  async add(userId, tipo, alvoId) {
    const sql = `INSERT IGNORE INTO favorites (user_id, tipo, alvo_id) VALUES (?, ?, ?)`;
    const [result] = await db.query(sql, [userId, tipo, alvoId]);
    return result.affectedRows > 0;
  },

  async remove(userId, tipo, alvoId) {
    const sql = `DELETE FROM favorites WHERE user_id = ? AND tipo = ? AND alvo_id = ?`;
    const [result] = await db.query(sql, [userId, tipo, alvoId]);
    return result.affectedRows > 0;
  },

  async isFavorite(userId, tipo, alvoId) {
    const sql = `SELECT 1 FROM favorites WHERE user_id = ? AND tipo = ? AND alvo_id = ? LIMIT 1`;
    const [rows] = await db.query(sql, [userId, tipo, alvoId]);
    return rows.length > 0;
  },

  async listByUser(userId, tipo, { page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    let sql = '';
    // O tipo já está embutido no SQL de cada branch (um só ? antes do LIMIT/OFFSET)
    const values = [userId];
    if (tipo === 'freelancer') {
      sql = `
        SELECT f.id, f.alvo_id as id, u.nome, u.foto, p.titulo, p.classificacao, p.preco_por_hora, u.cidade, u.provincia
        FROM favorites f
        JOIN users u ON f.alvo_id = u.id
        JOIN profiles p ON p.user_id = u.id
        WHERE f.user_id = ? AND f.tipo = 'freelancer' AND u.status = 'ativo'
        ORDER BY f.created_at DESC LIMIT ? OFFSET ?
      `;
      values.push(parseInt(limit, 10), parseInt(offset, 10));
    } else {
      sql = `
        SELECT f.id, f.alvo_id as id, s.titulo, s.descricao, s.preco, s.prazo_entrega,
               u.nome as freelancer_nome, u.foto as freelancer_foto, c.nome as categoria_nome, c.cor as categoria_cor
        FROM favorites f
        JOIN services s ON f.alvo_id = s.id
        JOIN users u ON s.freelancer_id = u.id
        JOIN categories c ON s.categoria_id = c.id
        WHERE f.user_id = ? AND f.tipo = 'servico' AND s.status = 'ativo'
        ORDER BY f.created_at DESC LIMIT ? OFFSET ?
      `;
      values.push(parseInt(limit, 10), parseInt(offset, 10));
    }
    const [rows] = await db.query(sql, values);
    return rows;
  },
};

module.exports = Favorite;
