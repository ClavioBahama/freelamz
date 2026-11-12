const Proposal = require('../models/Proposal');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const db = require('../config/db');

async function notify(userId, tipo, titulo, mensagem) {
  try { await Notification.create(userId, tipo, titulo, mensagem); } catch (e) {}
}

const proposalController = {
  async create(req, res) {
    try {
      const { projeto_id, preco, prazo, mensagem } = req.body;
      const freelancerId = req.user.id;

      const proposal = await Proposal.create({ projeto_id, freelancer_id: freelancerId, preco, prazo, mensagem });

      // Notificar o dono do projeto (cliente)
      const projeto = await Project.getById(projeto_id);
      if (projeto) {
        await notify(projeto.cliente_id, 'nova_proposta', 'Nova proposta recebida', `Um freelancer enviou uma proposta para o seu projeto "${projeto.titulo || projeto.servico_titulo}".`);
      }

      res.status(201).json({ success: true, proposal });
    } catch (err) {
      console.error('[PROP] Erro ao criar proposta:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listByProject(req, res) {
    try {
      const proposals = await Proposal.listByProject(req.params.projetoId);
      res.json({ success: true, proposals });
    } catch (err) {
      console.error('[PROP] Erro ao listar propostas:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listByFreelancer(req, res) {
    try {
      const proposals = await Proposal.listByFreelancer(req.user.id, { page: req.query.page, limit: req.query.limit });
      res.json({ success: true, proposals });
    } catch (err) {
      console.error('[PROP] Erro ao listar propostas do freelancer:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listByCliente(req, res) {
    try {
      const proposals = await Proposal.listByCliente(req.user.id, { page: req.query.page, limit: req.query.limit });
      res.json({ success: true, proposals });
    } catch (err) {
      console.error('[PROP] Erro ao listar propostas do cliente:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const proposal = await Proposal.getById(req.params.id);
      if (!proposal) {
        return res.status(404).json({ success: false, message: 'Proposta não encontrada' });
      }

      // Permissões: apenas o cliente do projeto aceita/recusa;
      // apenas o autor da proposta cancela
      const projeto = await Project.getById(proposal.projeto_id);
      const souCliente = projeto && projeto.cliente_id === req.user.id;
      const souAutor = proposal.freelancer_id === req.user.id;
      const acaoCliente = status === 'ACEITA' || status === 'RECUSADA';
      const acaoAutor = status === 'CANCELADA';
      if ((acaoCliente && !souCliente) || (acaoAutor && !souAutor)) {
        return res.status(403).json({ success: false, message: 'Acesso negado: apenas o cliente do projeto pode responder esta proposta' });
      }

      const atualizada = await Proposal.updateStatus(req.params.id, status);

      // Se aceita, vincular a proposta ao projeto existente (não duplicar):
      // o projeto criado pelo cliente passa a ter proposta/valor/prazo da proposta aceita
      // FASE A: projeto nasce AGUARDANDO_PAGAMENTO + linha de escrow criada
      if (status === 'ACEITA' && projeto) {
        await Project.updateFromProposal(projeto.id, {
          propostaId: atualizada.id,
          valor: atualizada.preco,
          prazo: atualizada.prazo,
        });
        await db.query(
          `INSERT INTO escrow (project_id, amount_held, platform_fee, status)
           VALUES (?, 0, 0, 'AGUARDANDO_PAGAMENTO')
           ON DUPLICATE KEY UPDATE status = 'AGUARDANDO_PAGAMENTO'`,
          [projeto.id]
        );
        await notify(atualizada.freelancer_id, 'proposta_aceita', 'Proposta aceita! 🎉', `Sua proposta para "${projeto.servico_titulo || 'o projeto'}" foi aceita pelo cliente. Assim que o cliente pagar, o valor fica retido e você pode começar.`);
        await notify(projeto.cliente_id, 'pagamento_pendente', 'Pague para iniciar o projeto 💳', `Você aceitou a proposta de ${atualizada.preco} MT. Pague (M-Pesa, e-Mola, cartão ou saldo) para reter o valor e liberar o freelancer.`);
      }
      if (status === 'RECUSADA') {
        await notify(atualizada.freelancer_id, 'proposta_recusada', 'Proposta recusada', `Sua proposta para "${projeto.servico_titulo || 'o projeto'}" não foi aceita desta vez.`);
      }

      res.json({ success: true, proposal: atualizada });
    } catch (err) {
      console.error('[PROP] Erro ao atualizar proposta:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },
};

module.exports = proposalController;
