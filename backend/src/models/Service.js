const db = require('../config/db');

const Service = {
  async list({ page = 1, limit = 20, categoria, busca, precoMax, ordem = 'recente', freelancer_id }) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT s.*, u.nome as freelancer_nome, u.foto as freelancer_foto, u.cidade, u.provincia,
             c.nome as categoria_nome, c.cor as categoria_cor, c.icone as categoria_icone
      FROM services s
      JOIN users u ON s.freelancer_id = u.id
      JOIN categories c ON s.categoria_id = c.id
      WHERE s.status = 'ativo' AND u.status = 'ativo'
    `;
    const values = [];
    if (freelancer_id) { sql += ' AND s.freelancer_id = ?'; values.push(parseInt(freelancer_id, 10)); }
    if (categoria) { sql += ' AND s.categoria_id = ?'; values.push(categoria); }
    if (busca) { sql += ' AND (s.titulo LIKE ? OR s.descricao LIKE ?)'; values.push(`%${busca}%`, `%${busca}%`); }
    if (precoMax) { sql += ' AND s.preco <= ?'; values.push(parseFloat(precoMax)); }
    if (ordem === 'menor_preco') sql += ' ORDER BY s.preco ASC';
    else if (ordem === 'maior_preco') sql += ' ORDER BY s.preco DESC';
    else if (ordem === 'melhor_avaliacao') sql += ' ORDER BY s.created_at DESC';
    else sql += ' ORDER BY s.created_at DESC';
    sql += ' LIMIT ? OFFSET ?';
    values.push(parseInt(limit, 10), parseInt(offset, 10));
    const [rows] = await db.query(sql, values);
    return rows;
  },

  async getById(id) {
    const sql = `
      SELECT s.*, u.nome as freelancer_nome, u.foto as freelancer_foto, u.cidade, u.provincia,
             c.nome as categoria_nome, c.cor as categoria_cor, c.icone as categoria_icone
      FROM services s
      JOIN users u ON s.freelancer_id = u.id
      JOIN categories c ON s.categoria_id = c.id
      WHERE s.id = ?
    `;
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
  },

  async getImages(serviceId) {
    const sql = `SELECT * FROM service_images WHERE service_id = ? ORDER BY ordem ASC`;
    const [rows] = await db.query(sql, [serviceId]);
    return rows;
  },

  async create(freelancerId, { titulo, descricao, categoria_id, preco, prazo_entrega }) {
    const sql = `
      INSERT INTO services (freelancer_id, categoria_id, titulo, descricao, preco, prazo_entrega, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ativo')
    `;
    const [result] = await db.query(sql, [freelancerId, categoria_id, titulo, descricao, preco, prazo_entrega]);
    return this.getById(result.insertId);
  },

  async update(id, freelancerId, { titulo, descricao, categoria_id, preco, prazo_entrega, status }) {
    const sql = `
      UPDATE services SET titulo = ?, descricao = ?, categoria_id = ?, preco = ?, prazo_entrega = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND freelancer_id = ?
    `;
    const [result] = await db.query(sql, [titulo, descricao, categoria_id, preco, prazo_entrega, status, id, freelancerId]);
    return result.affectedRows > 0;
  },

  async delete(id, freelancerId) {
    // freelancerId null (admin) → apaga qualquer serviço
    const sql = freelancerId
      ? `DELETE FROM services WHERE id = ? AND freelancer_id = ?`
      : `DELETE FROM services WHERE id = ?`;
    const params = freelancerId ? [id, freelancerId] : [id];
    const [result] = await db.query(sql, params);
    return result.affectedRows > 0;
  },

  async addImage(serviceId, url, ordem = 0) {
    const sql = `INSERT INTO service_images (service_id, url, ordem) VALUES (?, ?, ?)`;
    await db.query(sql, [serviceId, url, ordem]);
  },

  async countByFreelancer(freelancerId) {
    const sql = `SELECT COUNT(*) as total FROM services WHERE freelancer_id = ? AND status = 'ativo'`;
    const [rows] = await db.query(sql, [freelancerId]);
    return rows[0].total;
  },
};

module.exports = Service;
