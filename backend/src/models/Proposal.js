const db = require('../config/db');

const Proposal = {
  async create({ projeto_id, freelancer_id, preco, prazo, mensagem }) {
    const sql = `
      INSERT INTO proposals (projeto_id, freelancer_id, preco, prazo, mensagem, status)
      VALUES (?, ?, ?, ?, ?, 'PENDENTE')
    `;
    const [result] = await db.query(sql, [projeto_id, freelancer_id, preco, prazo, mensagem]);
    return this.getById(result.insertId);
  },

  async getById(id) {
    const sql = `
      SELECT p.*, u.nome as freelancer_nome, u.foto as freelancer_foto
      FROM proposals p
      JOIN users u ON p.freelancer_id = u.id
      WHERE p.id = ?
    `;
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
  },

  async listByProject(projetoId) {
    const sql = `
      SELECT p.*, u.nome as freelancer_nome, u.foto as freelancer_foto, u.cidade
      FROM proposals p
      JOIN users u ON p.freelancer_id = u.id
      WHERE p.projeto_id = ?
      ORDER BY p.created_at DESC
    `;
    const [rows] = await db.query(sql, [projetoId]);
    return rows;
  },

  async listByFreelancer(freelancerId, { page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const sql = `
      SELECT p.*, s.titulo as projeto_titulo, u.nome as cliente_nome, u.foto as cliente_foto, pr.cliente_id
      FROM proposals p
      JOIN projects pr ON p.projeto_id = pr.id
      JOIN users u ON pr.cliente_id = u.id
      LEFT JOIN services s ON pr.servico_id = s.id
      WHERE p.freelancer_id = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(sql, [freelancerId, parseInt(limit, 10), parseInt(offset, 10)]);
    return rows;
  },

  async listByCliente(clienteId, { page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const sql = `
      SELECT p.*, u.nome as freelancer_nome, u.foto as freelancer_foto, s.titulo as projeto_titulo
      FROM proposals p
      JOIN projects pr ON p.projeto_id = pr.id
      JOIN users u ON p.freelancer_id = u.id
      LEFT JOIN services s ON pr.servico_id = s.id
      WHERE pr.cliente_id = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(sql, [clienteId, parseInt(limit, 10), parseInt(offset, 10)]);
    return rows;
  },

  async updateStatus(id, status) {
    const sql = `UPDATE proposals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await db.query(sql, [status, id]);
    return this.getById(id);
  },
};

module.exports = Proposal;
