/* ============================================================
   FreelaMZ — Controller de projetos (FASE A)
   getById inclui escrow + contadores para a linha do tempo;
   updateStatus já não permite transições manuais de dinheiro
   (ENTREGUE/CONCLUIDO passam pelo fluxo de entregas/aprovações).
   ============================================================ */
const Project = require('../models/Project');
const Proposal = require('../models/Proposal');
const Notification = require('../models/Notification');
const db = require('../config/db');

async function notify(userId, tipo, titulo, mensagem) {
  try { await Notification.create(userId, tipo, titulo, mensagem); } catch (e) {}
}

const projectController = {
  async create(req, res) {
    try {
      const { freelancerId, propostaId, servicoId, valor, prazo } = req.body;
      const clienteId = req.user.id;

      const project = await Project.create({ clienteId, freelancerId, propostaId, servicoId, valor, prazo });

      await notify(freelancerId, 'novo_projeto', 'Novo projeto criado', `Um cliente criou um projeto para você. Valor: ${valor} MT`);

      res.status(201).json({ success: true, project });
    } catch (err) {
      console.error('[PROJ] Erro ao criar projeto:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async list(req, res) {
    try {
      const tipo = req.user.tipo_usuario;
      const projects = await Project.listByUser(req.user.id, tipo, { page: req.query.page, limit: req.query.limit });
      res.json({ success: true, projects });
    } catch (err) {
      console.error('[PROJ] Erro ao listar projetos:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async getById(req, res) {
    try {
      const project = await Project.getById(req.params.id);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
      }
      const souCliente = project.cliente_id === req.user.id;
      const souFreelancer = project.freelancer_id === req.user.id;
      if (!souCliente && !souFreelancer && req.user.tipo_usuario !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Acesso negado a este projeto' });
      }

      /* escrow + contadores para a linha do tempo e botões contextuais */
      const [[escrow]] = await db.query('SELECT * FROM escrow WHERE project_id = ?', [project.id]);
      const [[entregas]] = await db.query(
        'SELECT COUNT(*) as total FROM deliveries WHERE project_id = ?', [project.id]
      );
      const [[pendentes]] = await db.query(
        `SELECT COUNT(*) as total FROM value_adjustments WHERE project_id = ? AND status = 'PENDENTE'`, [project.id]
      );
      const [[cancelPend]] = await db.query(
        `SELECT COUNT(*) as total FROM cancel_requests WHERE project_id = ? AND status = 'PENDENTE'`, [project.id]
      );

      res.json({
        success: true,
        project: {
          ...project,
          entregas_total: Number(entregas.total),
          ajustes_pendentes: Number(pendentes.total),
          cancelamento_pendente: Number(cancelPend.total),
        },
        escrow: escrow || null,
        meu_papel: souCliente ? 'cliente' : (souFreelancer ? 'freelancer' : 'admin'),
      });
    } catch (err) {
      console.error('[PROJ] Erro ao obter projeto:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  /* Transições manuais de status foram substituídas pelo fluxo financeiro:
     ENTREGUE/CONCLUIDO/EM_ANDAMENTO só mudam via pagamento/entrega/aprovações.
     Mantém-se CANCELADO direto (sem pagamento retido). */
  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const projeto = await Project.getById(req.params.id);
      if (!projeto) {
        return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
      }
      const souCliente = projeto.cliente_id === req.user.id;
      const souFreelancer = projeto.freelancer_id === req.user.id;
      if (!souCliente && !souFreelancer && req.user.tipo_usuario !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Acesso negado a este projeto' });
      }

      if (status !== 'CANCELADO') {
        return res.status(400).json({
          success: false,
          message: 'Este status agora é controlado pelo fluxo do projeto: pagamento (M-Pesa/e-Mola/cartão/saldo), entrega no chat e aprovação dos dois lados.',
        });
      }

      /* cancelar: sem valor retido pode ser direto; com valor exige acordo dos dois */
      const [[escrow]] = await db.query('SELECT * FROM escrow WHERE project_id = ?', [projeto.id]);
      const valorRetido = escrow && Number(escrow.amount_held) > 0
        && ['RETIDO', 'EM_DISPUTA'].includes(escrow.status);
      if (valorRetido) {
        return res.status(409).json({
          success: false,
          message: 'Há valor retido em escrow — use o pedido de cancelamento no chat do projeto (acordo dos dois lados) para o reembolso.',
        });
      }

      const project = await Project.updateStatus(req.params.id, status);
      const outro = project.cliente_id === req.user.id ? project.freelancer_id : project.cliente_id;
      await notify(outro, 'projeto_cancelado', 'Projeto cancelado', `O projeto "${project.servico_titulo}" foi cancelado.`);

      res.json({ success: true, project });
    } catch (err) {
      console.error('[PROJ] Erro ao atualizar projeto:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },
};

module.exports = projectController;
