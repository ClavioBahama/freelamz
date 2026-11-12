const db = require('../config/db');

const Category = {
  async list() {
    const sql = `SELECT * FROM categories ORDER BY nome ASC`;
    const [rows] = await db.query(sql);
    return rows;
  },

  async getById(id) {
    const sql = `SELECT * FROM categories WHERE id = ?`;
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
  },

  async create({ nome, icone, cor, descricao }) {
    const sql = `INSERT INTO categories (nome, icone, cor, descricao) VALUES (?, ?, ?, ?)`;
    const [result] = await db.query(sql, [nome, icone, cor, descricao]);
    return this.getById(result.insertId);
  },

  async update(id, { nome, icone, cor, descricao }) {
    const sql = `UPDATE categories SET nome = ?, icone = ?, cor = ?, descricao = ? WHERE id = ?`;
    await db.query(sql, [nome, icone, cor, descricao, id]);
    return this.getById(id);
  },

  async delete(id) {
    const sql = `DELETE FROM categories WHERE id = ?`;
    const [result] = await db.query(sql, [id]);
    return result.affectedRows > 0;
  },
};

module.exports = Category;
