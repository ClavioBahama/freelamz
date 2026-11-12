const Category = require('../models/Category');

const categoryController = {
  async list(req, res) {
    try {
      const categories = await Category.list();
      res.json({ success: true, categories });
    } catch (err) {
      console.error('[CAT] Erro ao listar categorias:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async create(req, res) {
    try {
      const category = await Category.create(req.body);
      res.status(201).json({ success: true, category });
    } catch (err) {
      console.error('[CAT] Erro ao criar categoria:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async update(req, res) {
    try {
      const category = await Category.update(req.params.id, req.body);
      if (!category) {
        return res.status(404).json({ success: false, message: 'Categoria não encontrada' });
      }
      res.json({ success: true, category });
    } catch (err) {
      console.error('[CAT] Erro ao atualizar categoria:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async delete(req, res) {
    try {
      const ok = await Category.delete(req.params.id);
      if (!ok) {
        return res.status(404).json({ success: false, message: 'Categoria não encontrada' });
      }
      res.json({ success: true, message: 'Categoria removida' });
    } catch (err) {
      console.error('[CAT] Erro ao remover categoria:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },
};

module.exports = categoryController;
