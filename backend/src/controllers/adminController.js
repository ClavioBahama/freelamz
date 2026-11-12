const User = require('../models/User');
const Service = require('../models/Service');
const Project = require('../models/Project');
const Proposal = require('../models/Proposal');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const db = require('../config/db');
const { apagarArquivo } = require('../services/imagem');
const finance = require('../services/finance');

async function notify(userId, tipo, titulo, mensagem) {
  try { await Notification.create(userId, tipo, titulo, mensagem); } catch (e) {}
}

const adminController = {
  async stats(req, res) {
    try {
      const [users] = await db.query(`SELECT COUNT(*) as total FROM users`);
      const [freelancers] = await db.query(`SELECT COUNT(*) as total FROM users WHERE tipo_usuario = 'FREELANCER'`);
      const [clientes] = await db.query(`SELECT COUNT(*) as total FROM users WHERE tipo_usuario = 'CLIENTE'`);
      const [services] = await db.query(`SELECT COUNT(*) as total FROM services`);
      const [projects] = await db.query(`SELECT COUNT(*) as total FROM projects`);
      const [bloqueados] = await db.query(`SELECT COUNT(*) as total FROM users WHERE status = 'bloqueado'`);
      const [propostas] = await db.query(`SELECT COUNT(*) as total FROM proposals`);
      const [avaliacoes] = await db.query(`SELECT COUNT(*) as total FROM reviews`);
      const [denunciasPendentes] = await db.query(`SELECT COUNT(*) as total FROM reports WHERE status = 'PENDENTE'`);

      // Projetos por status (para gráfico)
      const [projStatus] = await db.query(`
        SELECT status, COUNT(*) as total FROM projects GROUP BY status
      `);
      // Serviços por categoria (para gráfico)
      const [svcCat] = await db.query(`
        SELECT c.nome as categoria, COUNT(s.id) as total
        FROM categories c LEFT JOIN services s ON s.categoria_id = c.id AND s.status = 'ativo'
        GROUP BY c.id, c.nome ORDER BY total DESC
      `);
      // Usuários por mês (últimos 6 meses)
      const [usersMes] = await db.query(`
        SELECT DATE_FORMAT(created_at, '%Y-%m') as mes, COUNT(*) as total
        FROM users
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 5 MONTH)
        GROUP BY mes ORDER BY mes
      `);

      res.json({
        success: true,
        stats: {
          total_usuarios: users[0].total,
          total_freelancers: freelancers[0].total,
          total_clientes: clientes[0].total,
          total_servicos: services[0].total,
          total_projetos: projects[0].total,
          total_bloqueados: bloqueados[0].total,
          total_propostas: propostas[0].total,
          total_avaliacoes: avaliacoes[0].total,
          denuncias_pendentes: denunciasPendentes[0].total,
          projetos_por_status: projStatus,
          servicos_por_categoria: svcCat,
          usuarios_por_mes: usersMes,
        },
      });
    } catch (err) {
      console.error('[ADMIN] Erro nas estatísticas:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listUsers(req, res) {
    try {
      const users = await User.list({ page: req.query.page, limit: req.query.limit, busca: req.query.busca });
      res.json({ success: true, users });
    } catch (err) {
      console.error('[ADMIN] Erro ao listar usuários:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async updateUser(req, res) {
    try {
      const {
        nome, email, telefone, tipo_usuario, cidade, provincia, pais, status,
        verificado_plataforma, email_verificado, telefone_verificado,
        nome_empresa, setor, tipo_cliente,
      } = req.body;
      const alvo = await User.findById(req.params.id);
      if (!alvo) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      }
      // Salvaguarda: o admin não pode tirar o próprio cargo de admin
      if (Number(alvo.id) === Number(req.user.id) && tipo_usuario && tipo_usuario !== 'ADMIN') {
        return res.status(400).json({ success: false, message: 'Não pode remover o seu próprio cargo de administrador' });
      }
      const campos = {};
      for (const [chave, valor] of Object.entries({
        nome, email, telefone, tipo_usuario, cidade, provincia, pais, status,
        verificado_plataforma, email_verificado, telefone_verificado,
        nome_empresa, setor, tipo_cliente,
      })) {
        if (valor !== undefined) campos[chave] = valor === '' ? null : valor;
      }
      const user = await User.update(req.params.id, campos);
      const { senha_hash: _, ...semSenha } = user;
      res.json({ success: true, message: 'Usuário atualizado', user: semSenha });
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Email já está em uso por outro utilizador' });
      }
      console.error('[ADMIN] Erro ao atualizar usuário:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  /* Verificar/desverificar utilizador (selo da plataforma) */
  async verifyUser(req, res) {
    try {
      const { verificado } = req.body || {};
      const alvo = await User.findById(req.params.id);
      if (!alvo) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      const user = await User.update(req.params.id, { verificado_plataforma: verificado ? 1 : 0 });
      const { senha_hash: _, ...semSenha } = user;
      res.json({
        success: true,
        message: verificado ? 'Utilizador verificado pela plataforma ✓' : 'Verificação removida',
        user: semSenha,
      });
    } catch (err) {
      console.error('[ADMIN] Erro ao verificar usuário:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  /* Remover foto de perfil de conteúdo inadequado */
  async removerFoto(req, res) {
    try {
      const alvo = await User.findById(req.params.id);
      if (!alvo) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      if (alvo.foto) apagarArquivo(alvo.foto);
      const user = await User.update(req.params.id, { foto: null });
      const { senha_hash: _, ...semSenha } = user;
      res.json({ success: true, message: 'Foto removida pelo administrador', user: semSenha });
    } catch (err) {
      console.error('[ADMIN] Erro ao remover foto:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async deleteUser(req, res) {
    try {
      if (Number(req.params.id) === Number(req.user.id)) {
        return res.status(400).json({ success: false, message: 'Não pode apagar a sua própria conta' });
      }
      const ok = await User.delete(req.params.id);
      if (!ok) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      }
      res.json({ success: true, message: 'Usuário apagado' });
    } catch (err) {
      console.error('[ADMIN] Erro ao apagar usuário:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async blockUser(req, res) {
    try {
      await User.update(req.params.id, { status: 'bloqueado' });
      res.json({ success: true, message: 'Usuário bloqueado' });
    } catch (err) {
      console.error('[ADMIN] Erro ao bloquear:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async unblockUser(req, res) {
    try {
      await User.update(req.params.id, { status: 'ativo' });
      res.json({ success: true, message: 'Usuário desbloqueado' });
    } catch (err) {
      console.error('[ADMIN] Erro ao desbloquear:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listServices(req, res) {
    try {
      const services = await Service.list({ page: req.query.page, limit: req.query.limit });
      res.json({ success: true, services });
    } catch (err) {
      console.error('[ADMIN] Erro ao listar serviços:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async deleteService(req, res) {
    try {
      const ok = await Service.delete(req.params.id, null);
      if (!ok) {
        return res.status(404).json({ success: false, message: 'Serviço não encontrado' });
      }
      res.json({ success: true, message: 'Serviço removido pelo admin' });
    } catch (err) {
      console.error('[ADMIN] Erro ao remover serviço:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listProjects(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const sql = `
        SELECT pr.*, c.nome as cliente_nome, c.foto as cliente_foto, f.nome as freelancer_nome, f.foto as freelancer_foto
        FROM projects pr
        JOIN users c ON pr.cliente_id = c.id
        JOIN users f ON pr.freelancer_id = f.id
        ORDER BY pr.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await db.query(sql, [limit, (page - 1) * limit]);
      res.json({ success: true, projects: rows });
    } catch (err) {
      console.error('[ADMIN] Erro ao listar projetos:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listProposals(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const sql = `
        SELECT p.*, u.nome as freelancer_nome, u.foto as freelancer_foto, c.nome as cliente_nome, c.foto as cliente_foto, s.titulo as projeto_titulo
        FROM proposals p
        JOIN users u ON p.freelancer_id = u.id
        JOIN projects pr ON p.projeto_id = pr.id
        JOIN users c ON pr.cliente_id = c.id
        LEFT JOIN services s ON pr.servico_id = s.id
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await db.query(sql, [limit, (page - 1) * limit]);
      res.json({ success: true, proposals: rows });
    } catch (err) {
      console.error('[ADMIN] Erro ao listar propostas:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async updateProposalStatus(req, res) {
    try {
      const { status } = req.body;
      const atualizada = await Proposal.updateStatus(req.params.id, status);
      if (!atualizada) {
        return res.status(404).json({ success: false, message: 'Proposta não encontrada' });
      }
      await notify(atualizada.freelancer_id, 'proposta_status', 'Status da proposta alterado', `Um administrador alterou o status da sua proposta para "${status}".`);
      res.json({ success: true, proposal: atualizada });
    } catch (err) {
      console.error('[ADMIN] Erro ao atualizar proposta:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async deleteReview(req, res) {
    try {
      const review = await Review.getById(req.params.id);
      if (!review) {
        return res.status(404).json({ success: false, message: 'Avaliação não encontrada' });
      }
      await Review.delete(req.params.id);
      await Review.syncProfile(review.avaliado_id);
      await notify(review.avaliado_id, 'avaliacao_removida', 'Avaliação removida', 'Uma avaliação sua foi removida pela administração.');
      res.json({ success: true, message: 'Avaliação removida' });
    } catch (err) {
      console.error('[ADMIN] Erro ao remover avaliação:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listReviews(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const sql = `
        SELECT r.*, u.nome as avaliador_nome, u.foto as avaliador_foto, a.nome as avaliado_nome, a.foto as avaliado_foto, s.titulo as projeto_titulo
        FROM reviews r
        JOIN users u ON r.avaliador_id = u.id
        JOIN users a ON r.avaliado_id = a.id
        LEFT JOIN projects pr ON r.projeto_id = pr.id
        LEFT JOIN services s ON pr.servico_id = s.id
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await db.query(sql, [limit, (page - 1) * limit]);
      res.json({ success: true, reviews: rows });
    } catch (err) {
      console.error('[ADMIN] Erro ao listar avaliações:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listReports(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const sql = `
        SELECT r.*, u.nome as denunciante_nome
        FROM reports r
        JOIN users u ON r.user_id = u.id
        ORDER BY FIELD(r.status, 'PENDENTE', 'RESOLVIDA', 'REJEITADA'), r.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await db.query(sql, [limit, (page - 1) * limit]);
      res.json({ success: true, reports: rows });
    } catch (err) {
      console.error('[ADMIN] Erro ao listar denúncias:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async updateReport(req, res) {
    try {
      const { status } = req.body;
      if (!['PENDENTE', 'RESOLVIDA', 'REJEITADA'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status inválido (PENDENTE, RESOLVIDA ou REJEITADA)' });
      }
      const [result] = await db.query(
        `UPDATE reports SET status = ? WHERE id = ?`,
        [status, req.params.id]
      );
      if (!result.affectedRows) {
        return res.status(404).json({ success: false, message: 'Denúncia não encontrada' });
      }
      const [rows] = await db.query(`SELECT * FROM reports WHERE id = ?`, [req.params.id]);
      await notify(rows[0].user_id, 'denuncia_status', 'Denúncia atualizada', `A sua denúncia foi marcada como "${status}".`);
      res.json({ success: true, report: rows[0] });
    } catch (err) {
      console.error('[ADMIN] Erro ao atualizar denúncia:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  /* ============================================================
     FASE A — Painel financeiro (escrow, comissões, disputas, saques)
     ============================================================ */

  async financeStats(req, res) {
    try {
      const stats = await finance.statsFinanceirosAdmin();
      res.json({ success: true, finance: stats });
    } catch (err) {
      console.error('[ADMIN] Erro nas estatísticas financeiras:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async updateSetting(req, res) {
    try {
      const { chave, valor } = req.body || {};
      const CAMPOS = {
        comissao_percentual: { min: 0, max: 30, msg: 'Comissão deve estar entre 0 e 30 (%)' },
        max_revisoes: { min: 0, max: 10, msg: 'Revisões devem estar entre 0 e 10' },
        dias_liberacao_automatica: { min: 1, max: 60, msg: 'Dias devem estar entre 1 e 60' },
      };
      if (!CAMPOS[chave]) {
        return res.status(400).json({ success: false, message: 'Configuração desconhecida' });
      }
      const num = parseFloat(valor);
      if (!Number.isFinite(num) || num < CAMPOS[chave].min || num > CAMPOS[chave].max) {
        return res.status(400).json({ success: false, message: CAMPOS[chave].msg });
      }
      await finance.setSetting(chave, String(num));
      res.json({ success: true, settings: { [chave]: String(num) } });
    } catch (err) {
      console.error('[ADMIN] Erro ao guardar setting:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listWithdrawals(req, res) {
    try {
      const saques = await finance.listarSaques({ status: req.query.status || null });
      res.json({ success: true, saques });
    } catch (err) {
      console.error('[ADMIN] Erro ao listar saques:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async processWithdrawal(req, res) {
    try {
      const { aprovar, motivo } = req.body || {};
      if (typeof aprovar !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Indique aprovar=true ou false' });
      }
      const r = await finance.decidirSaque({
        adminId: req.user.id, saqueId: Number(req.params.id), aprovar, motivo,
      });
      res.json({ success: true, message: r.aprovado ? 'Saque aprovado e concluído' : 'Saque recusado — valor devolvido à carteira', ...r });
    } catch (err) {
      if (err instanceof finance.ErroFinanceiro) {
        return res.status(err.status).json({ success: false, message: err.message });
      }
      console.error('[ADMIN] Erro ao processar saque:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listDisputes(req, res) {
    try {
      const stats = await finance.statsFinanceirosAdmin();
      res.json({ success: true, disputas: stats.disputas });
    } catch (err) {
      console.error('[ADMIN] Erro ao listar disputas:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async resolveDispute(req, res) {
    try {
      const { decisao, percentualFreelancer, motivo } = req.body || {};
      const r = await finance.decidirDisputa({
        adminId: req.user.id, projectId: Number(req.params.projectId),
        decisao, percentualFreelancer, motivo,
      });
      res.json({ success: true, message: 'Disputa decidida e registada (auditoria guardada)', ...r });
    } catch (err) {
      if (err instanceof finance.ErroFinanceiro) {
        return res.status(err.status).json({ success: false, message: err.message });
      }
      console.error('[ADMIN] Erro ao decidir disputa:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },
};

module.exports = adminController;
