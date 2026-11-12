const db = require('../config/db');

/* Colunas públicas do utilizador (NUNCA incluir senha_hash em respostas públicas) */
const CAMPOS_PUBLICOS = `
  id, nome, nome_utilizador, email, telefone, whatsapp, tipo_usuario, foto, capa,
  bio, sobre_mim, cidade, provincia, pais, idiomas,
  linkedin, instagram, facebook, site_pessoal,
  tipo_cliente, nome_empresa, setor, tamanho_equipa,
  email_verificado, telefone_verificado, verificado_plataforma,
  status, ultima_atividade, created_at, updated_at
`;

const User = {
  async create({ nome, email, telefone, senhaHash, tipoUsuario, foto, cidade, provincia, pais }) {
    const sql = `
      INSERT INTO users (nome, email, telefone, senha_hash, tipo_usuario, foto, cidade, provincia, pais, status, email_verificado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', 1)
    `;
    const [result] = await db.query(sql, [
      nome, email, telefone || null, senhaHash, tipoUsuario, foto || null, cidade || null, provincia || null, pais || 'Moçambique',
    ]);
    // username único derivado do nome
    const id = result.insertId;
    await User._gerarUsername(id, nome);
    return this.findById(id);
  },

  async _gerarUsername(id, nome) {
    const base = String(nome || 'user')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 40) || 'user';
    let final = base;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const [dup] = await db.query('SELECT id FROM users WHERE nome_utilizador = ? AND id != ?', [final, id]);
      if (!dup.length) break;
      n += 1;
      final = `${base}${n}`;
    }
    await db.query('UPDATE users SET nome_utilizador = ? WHERE id = ?', [final, id]);
    return final;
  },

  async findById(id) {
    const sql = `SELECT ${CAMPOS_PUBLICOS}, senha_hash FROM users WHERE id = ?`;
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
  },

  /* Versão sem hash para expor em endpoints */
  async findByIdPublico(id) {
    const sql = `SELECT ${CAMPOS_PUBLICOS} FROM users WHERE id = ?`;
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const sql = `SELECT ${CAMPOS_PUBLICOS}, senha_hash FROM users WHERE email = ?`;
    const [rows] = await db.query(sql, [email]);
    return rows[0] || null;
  },

  async findByUsername(nomeUtilizador) {
    const sql = `SELECT ${CAMPOS_PUBLICOS}, senha_hash FROM users WHERE nome_utilizador = ?`;
    const [rows] = await db.query(sql, [nomeUtilizador]);
    return rows[0] || null;
  },

  async update(id, fields) {
    const allowed = [
      'nome', 'email', 'telefone', 'whatsapp', 'foto', 'capa', 'cidade', 'provincia', 'pais',
      'tipo_usuario', 'status', 'nome_utilizador', 'bio', 'sobre_mim', 'idiomas',
      'linkedin', 'instagram', 'facebook', 'site_pessoal',
      'email_verificado', 'telefone_verificado', 'verificado_plataforma',
      'tipo_cliente', 'nome_empresa', 'setor', 'tamanho_equipa', 'ultima_atividade',
    ];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await db.query(sql, values);
    return this.findById(id);
  },

  async updateSenha(id, senhaHash) {
    await db.query('UPDATE users SET senha_hash = ? WHERE id = ?', [senhaHash, id]);
    return this.findById(id);
  },

  async registrarAtividade(id) {
    await db.query('UPDATE users SET ultima_atividade = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  },

  async delete(id) {
    const sql = `DELETE FROM users WHERE id = ?`;
    const [result] = await db.query(sql, [id]);
    return result.affectedRows > 0;
  },

  async list({ page = 1, limit = 20, tipoUsuario, status, busca }) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT u.id, u.nome, u.nome_utilizador, u.email, u.telefone, u.tipo_usuario, u.foto,
        u.cidade, u.provincia, u.pais, u.status, u.email_verificado, u.telefone_verificado,
        u.verificado_plataforma, u.created_at
      FROM users u WHERE 1=1
    `;
    const values = [];
    if (tipoUsuario) { sql += ' AND u.tipo_usuario = ?'; values.push(tipoUsuario); }
    if (status) { sql += ' AND u.status = ?'; values.push(status); }
    if (busca) { sql += ' AND (u.nome LIKE ? OR u.email LIKE ?)'; values.push(`%${busca}%`, `%${busca}%`); }
    sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    values.push(parseInt(limit, 10), parseInt(offset, 10));
    const [rows] = await db.query(sql, values);
    return rows;
  },
};

module.exports = User;
