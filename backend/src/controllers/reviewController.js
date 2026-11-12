const Review = require('../models/Review');
const Project = require('../models/Project');
const Notification = require('../models/Notification');

async function notify(userId, tipo, titulo, mensagem) {
  try { await Notification.create(userId, tipo, titulo, mensagem); } catch (e) {}
}

const reviewController = {
  async create(req, res) {
    try {
      const { projeto_id, avaliado_id, nota, comentario } = req.body;
      const avaliador_id = req.user.id;

      if (nota < 1 || nota > 5) {
        return res.status(400).json({ success: false, message: 'A nota deve estar entre 1 e 5' });
      }

      // Permissões: só participantes do projeto concluído avaliam a contraparte
      const projeto = await Project.getById(projeto_id);
      if (!projeto) {
        return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
      }
      const souCliente = projeto.cliente_id === avaliador_id;
      const souFreelancer = projeto.freelancer_id === avaliador_id;
      if (!souCliente && !souFreelancer) {
        return res.status(403).json({ success: false, message: 'Acesso negado: apenas participantes do projeto podem avaliar' });
      }
      if (projeto.status !== 'CONCLUIDO') {
        return res.status(400).json({ success: false, message: 'Só é possível avaliar projetos concluídos' });
      }
      const contraparte = souCliente ? projeto.freelancer_id : projeto.cliente_id;
      if (Number(avaliado_id) !== Number(contraparte)) {
        return res.status(400).json({ success: false, message: 'Só pode avaliar a outra parte do projeto' });
      }

      const jaExiste = await Review.existsForProject(projeto_id, avaliador_id);
      if (jaExiste) {
        return res.status(409).json({ success: false, message: 'Você já avaliou este projeto' });
      }

      const review = await Review.create({ projeto_id, avaliador_id, avaliado_id, nota, comentario });

      // Atualizar classificação média do avaliado (perfil reflete dados reais)
      await Review.syncProfile(avaliado_id);

      await notify(avaliado_id, 'nova_avaliacao', 'Nova avaliação recebida', `Você recebeu uma avaliação de ${nota} estrelas.`);

      res.status(201).json({ success: true, review });
    } catch (err) {
      console.error('[REV] Erro ao criar avaliação:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listByUser(req, res) {
    try {
      const reviews = await Review.listByUser(req.params.userId, { page: req.query.page, limit: req.query.limit });
      res.json({ success: true, reviews });
    } catch (err) {
      console.error('[REV] Erro ao listar avaliações:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async averageRating(req, res) {
    try {
      const rating = await Review.averageRating(req.params.userId);
      res.json({ success: true, rating });
    } catch (err) {
      console.error('[REV] Erro ao obter média:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },
};

module.exports = reviewController;
