const db = require('../config/db');

/* Portfólio do freelancer — itens com 1..4 imagens cada */
const Portfolio = {
  async listarPorUser(userId) {
    const [items] = await db.query(
      'SELECT * FROM portfolio_items WHERE user_id = ? ORDER BY ordem ASC, created_at DESC',
      [userId]
    );
    if (!items.length) return [];
    const ids = items.map((i) => i.id);
    const [imgs] = await db.query(
      `SELECT * FROM portfolio_images WHERE item_id IN (${ids.map(() => '?').join(',')}) ORDER BY ordem ASC, id ASC`,
      ids
    );
    return items.map((i) => ({
      ...i,
      imagens: imgs.filter((im) => im.item_id === i.id).map((im) => im.url),
    }));
  },

  async buscarPorId(id) {
    const [rows] = await db.query('SELECT * FROM portfolio_items WHERE id = ?', [id]);
    if (!rows.length) return null;
    const [imgs] = await db.query(
      'SELECT url FROM portfolio_images WHERE item_id = ? ORDER BY ordem ASC, id ASC',
      [id]
    );
    return { ...rows[0], imagens: imgs.map((i) => i.url) };
  },

  async criar(userId, { titulo, descricao, link, ordem }, imagens = []) {
    const [res] = await db.query(
      'INSERT INTO portfolio_items (user_id, titulo, descricao, link, ordem) VALUES (?, ?, ?, ?, ?)',
      [userId, titulo, descricao || null, link || null, ordem || 0]
    );
    const id = res.insertId;
    await this._trocarImagens(id, imagens);
    return this.buscarPorId(id);
  },

  async atualizar(id, { titulo, descricao, link, ordem }) {
    await db.query(
      'UPDATE portfolio_items SET titulo = ?, descricao = ?, link = ?, ordem = ? WHERE id = ?',
      [titulo, descricao || null, link || null, ordem || 0, id]
    );
    return this.buscarPorId(id);
  },

  /* Substitui as imagens do item (apaga registos antigos; ficheiros são geridos pelo controller) */
  async _trocarImagens(itemId, urls) {
    await db.query('DELETE FROM portfolio_images WHERE item_id = ?', [itemId]);
    if (!urls || !urls.length) return;
    const values = urls.slice(0, 4).map((u, idx) => [itemId, u, idx]);
    await db.query(
      `INSERT INTO portfolio_images (item_id, url, ordem) VALUES ${values.map(() => '(?, ?, ?)').join(', ')}`,
      values.flat()
    );
  },

  async imagensAntigas(itemId) {
    const [rows] = await db.query('SELECT url FROM portfolio_images WHERE item_id = ?', [itemId]);
    return rows.map((r) => r.url);
  },

  async substituirImagens(itemId, urls) {
    const antigas = await this.imagensAntigas(itemId);
    await this._trocarImagens(itemId, urls);
    return antigas;
  },

  async apagar(id) {
    const item = await this.buscarPorId(id);
    if (!item) return null;
    await db.query('DELETE FROM portfolio_items WHERE id = ?', [id]);
    return item;
  },

  async contarPorUser(userId) {
    const [r] = await db.query('SELECT COUNT(*) as total FROM portfolio_items WHERE user_id = ?', [userId]);
    return Number(r[0].total || 0);
  },
};

module.exports = Portfolio;
