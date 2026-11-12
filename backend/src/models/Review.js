const db = require('../config/db');

const Review = {
  async create({ projeto_id, avaliador_id, avaliado_id, nota, comentario }) {
    const sql = `
      INSERT INTO reviews (projeto_id, avaliador_id, avaliado_id, nota, comentario)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(sql, [projeto_id, avaliador_id, avaliado_id, nota, comentario]);
    return this.getById(result.insertId);
  },

  async getById(id) {
    const sql = `
      SELECT r.*, u.nome as avaliador_nome, u.foto as avaliador_foto
      FROM reviews r
      JOIN users u ON r.avaliador_id = u.id
      WHERE r.id = ?
    `;
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
  },

  async delete(id) {
    const sql = `DELETE FROM reviews WHERE id = ?`;
    const [result] = await db.query(sql, [id]);
    return result.affectedRows > 0;
  },

  // Recalcula classificacao/num_avaliacoes do perfil a partir das avaliações reais
  async syncProfile(userId) {
    const sql = `
      UPDATE profiles p
      LEFT JOIN (SELECT avaliado_id, ROUND(AVG(nota), 1) as media, COUNT(*) as total FROM reviews GROUP BY avaliado_id) r
        ON r.avaliado_id = p.user_id
      SET p.classificacao = COALESCE(r.media, 0), p.num_avaliacoes = COALESCE(r.total, 0)
      WHERE p.user_id = ?
    `;
    await db.query(sql, [userId]);
  },

  async listByUser(userId, { page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const sql = `
      SELECT r.*, u.nome as avaliador_nome, u.foto as avaliador_foto,
             s.titulo as projeto_titulo
      FROM reviews r
      JOIN users u ON r.avaliador_id = u.id
      LEFT JOIN projects pr ON r.projeto_id = pr.id
      LEFT JOIN services s ON pr.servico_id = s.id
      WHERE r.avaliado_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(sql, [userId, parseInt(limit, 10), parseInt(offset, 10)]);
    return rows;
  },

  async averageRating(userId) {
    const sql = `SELECT AVG(nota) as media, COUNT(*) as total FROM reviews WHERE avaliado_id = ?`;
    const [rows] = await db.query(sql, [userId]);
    return { media: parseFloat(rows[0].media || 0).toFixed(1), total: rows[0].total };
  },

  async existsForProject(projetoId, avaliadorId) {
    const sql = `SELECT 1 FROM reviews WHERE projeto_id = ? AND avaliador_id = ? LIMIT 1`;
    const [rows] = await db.query(sql, [projetoId, avaliadorId]);
    return rows.length > 0;
  },
};

module.exports = Review;
