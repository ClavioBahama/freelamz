const Service = require('../models/Service');

const serviceController = {
  async list(req, res) {
    try {
      const { categoria, busca, precoMax, ordem, page, limit, freelancer_id } = req.query;
      const services = await Service.list({ categoria, busca, precoMax, ordem, page, limit, freelancer_id });
      res.json({ success: true, services });
    } catch (err) {
      console.error('[SVC] Erro ao listar serviços:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async getById(req, res) {
    try {
      const service = await Service.getById(req.params.id);
      if (!service) {
        return res.status(404).json({ success: false, message: 'Serviço não encontrado' });
      }
      service.imagens = await Service.getImages(service.id);
      res.json({ success: true, service });
    } catch (err) {
      console.error('[SVC] Erro ao obter serviço:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async create(req, res) {
    try {
      const freelancerId = req.user.id;
      const { titulo, descricao, categoria_id, preco, prazo_entrega } = req.body;
      const service = await Service.create(freelancerId, { titulo, descricao, categoria_id, preco, prazo_entrega });
      res.status(201).json({ success: true, service });
    } catch (err) {
      console.error('[SVC] Erro ao criar serviço:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async update(req, res) {
    try {
      const freelancerId = req.user.id;
      const { titulo, descricao, categoria_id, preco, prazo_entrega, status } = req.body;
      const ok = await Service.update(req.params.id, freelancerId, { titulo, descricao, categoria_id, preco, prazo_entrega, status });
      if (!ok) {
        return res.status(404).json({ success: false, message: 'Serviço não encontrado ou sem permissão' });
      }
      res.json({ success: true, message: 'Serviço atualizado' });
    } catch (err) {
      console.error('[SVC] Erro ao atualizar serviço:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async delete(req, res) {
    try {
      const ok = await Service.delete(req.params.id, req.user.id);
      if (!ok) {
        return res.status(404).json({ success: false, message: 'Serviço não encontrado ou sem permissão' });
      }
      res.json({ success: true, message: 'Serviço removido' });
    } catch (err) {
      console.error('[SVC] Erro ao remover serviço:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },
};

module.exports = serviceController;
