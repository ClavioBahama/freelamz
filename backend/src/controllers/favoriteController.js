const Favorite = require('../models/Favorite');

const favoriteController = {
  async add(req, res) {
    try {
      const { tipo, alvo_id } = req.body;
      const userId = req.user.id;
      await Favorite.add(userId, tipo, alvo_id);
      res.json({ success: true, message: 'Adicionado aos favoritos' });
    } catch (err) {
      console.error('[FAV] Erro ao adicionar favorito:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async remove(req, res) {
    try {
      const { tipo, alvo_id } = req.body;
      const userId = req.user.id;
      await Favorite.remove(userId, tipo, alvo_id);
      res.json({ success: true, message: 'Removido dos favoritos' });
    } catch (err) {
      console.error('[FAV] Erro ao remover favorito:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async isFavorite(req, res) {
    try {
      const { tipo, alvo_id } = req.query;
      const fav = await Favorite.isFavorite(req.user.id, tipo, alvo_id);
      res.json({ success: true, favorito: fav });
    } catch (err) {
      console.error('[FAV] Erro ao verificar favorito:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async list(req, res) {
    try {
      const { tipo } = req.query;
      const itens = await Favorite.listByUser(req.user.id, tipo, { page: req.query.page, limit: req.query.limit });
      res.json({ success: true, itens });
    } catch (err) {
      console.error('[FAV] Erro ao listar favoritos:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },
};

module.exports = favoriteController;
