const db = require('../config/db');

const Project = {
  async create({ clienteId, freelancerId, propostaId, servicoId, valor, prazo }) {
    const sql = `
      INSERT INTO projects (cliente_id, freelancer_id, proposta_id, servico_id, valor, prazo, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDENTE')
    `;
    const [result] = await db.query(sql, [clienteId, freelancerId, propostaId, servicoId, valor, prazo]);
    return this.getById(result.insertId);
  },

  async getById(id) {
    const sql = `
      SELECT pr.*,
        c.nome as cliente_nome, c.foto as cliente_foto,
        f.nome as freelancer_nome, f.foto as freelancer_foto,
        s.titulo as servico_titulo, s.descricao as servico_descricao
      FROM projects pr
      JOIN users c ON pr.cliente_id = c.id
      JOIN users f ON pr.freelancer_id = f.id
      LEFT JOIN services s ON pr.servico_id = s.id
      WHERE pr.id = ?
    `;
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
  },

  async listByUser(userId, tipo, { page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const col = tipo === 'CLIENTE' ? 'cliente_id' : 'freelancer_id';
    const sql = `
      SELECT pr.*,
        c.nome as cliente_nome, c.foto as cliente_foto,
        f.nome as freelancer_nome, f.foto as freelancer_foto,
        s.titulo as servico_titulo
      FROM projects pr
      JOIN users c ON pr.cliente_id = c.id
      JOIN users f ON pr.freelancer_id = f.id
      LEFT JOIN services s ON pr.servico_id = s.id
      WHERE pr.${col} = ?
      ORDER BY pr.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(sql, [userId, parseInt(limit, 10), parseInt(offset, 10)]);
    return rows;
  },

  async updateStatus(id, status) {
    let sql = `UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    if (status === 'CONCLUIDO') {
      sql = `UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP, concluido_em = CURRENT_TIMESTAMP WHERE id = ?`;
    }
    await db.query(sql, [status, id]);
    return this.getById(id);
  },

  // Ao aceitar uma proposta: vincula proposta + valor/prazo — o projeto
  // passa a AGUARDANDO_PAGAMENTO (FASE A): o freelancer só começa após o pagamento
  async updateFromProposal(id, { propostaId, valor, prazo }) {
    const sql = `
      UPDATE projects
      SET proposta_id = ?, valor = ?, prazo = ?, status = 'AGUARDANDO_PAGAMENTO',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await db.query(sql, [propostaId, valor, prazo, id]);
    return this.getById(id);
  },
};

module.exports = Project;
