/* ============================================================
   FreelaMZ — Controller do fluxo de entrega (FASE A)
   Entregas com ficheiros, aprovação dos dois lados, ajustes
   de valor, cancelamento de comum acordo e download protegido.
   ============================================================ */
const finance = require('../services/finance');
const db = require('../config/db');
const Project = require('../models/Project');
const { ErroFinanceiro } = finance;
const { salvarArquivoEntrega, apagarArquivo, caminhoArquivo } = require('../services/arquivo');

function responderErro(res, err, prefixo) {
  if (err instanceof ErroFinanceiro || (err && err.status)) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }
  console.error(`[${prefixo}]`, err.stack || err.message);
  return res.status(500).json({ success: false, message: 'Erro interno' });
}

async function projetoOuErro(projectId) {
  const proj = await Project.getById(projectId);
  if (!proj) throw new ErroFinanceiro(404, 'Projeto não encontrado');
  return proj;
}

function souParticipante(proj, userId) {
  return proj.cliente_id === userId || proj.freelancer_id === userId;
}

const deliveryController = {
  /* POST /projects/:id/deliveries (multipart: mensagem, links, arquivos) */
  async create(req, res) {
    let guardados = [];
    try {
      const projectId = Number(req.params.id);
      const mensagem = (req.body && req.body.mensagem) || '';
      let links = [];
      if (req.body && req.body.links) {
        try {
          const p = typeof req.body.links === 'string' ? JSON.parse(req.body.links) : req.body.links;
          links = (Array.isArray(p) ? p : []).filter((l) => typeof l === 'string' && /^https?:\/\//.test(l)).slice(0, 5);
        } catch (e) { links = []; }
      }
      if (!mensagem && (!req.files || !req.files.length) && !links.length) {
        return res.status(400).json({ success: false, message: 'Escreva a mensagem de entrega, anexe ficheiros ou inclua um link' });
      }

      const proj = await projetoOuErro(projectId);
      if (proj.freelancer_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Apenas o freelancer do projeto pode entregar' });
      }

      /* validar e guardar ficheiros ANTES da transação financeira */
      for (const f of req.files || []) {
        const meta = salvarArquivoEntrega(f.buffer, f.originalname);
        guardados.push(meta);
      }

      const r = await finance.criarEntrega({
        projectId, freelancerId: req.user.id,
        mensagem: mensagem ? String(mensagem).slice(0, 2000) : null,
        links,
        arquivos: guardados,
      });
      res.status(201).json({ success: true, message: `Entrega #${r.delivery.numero} enviada`, ...r });
    } catch (err) {
      // rollback dos ficheiros já guardados se a entrega falhou
      guardados.forEach((g) => apagarArquivo(g.url));
      responderErro(res, err, 'DELIV');
    }
  },

  /* GET /projects/:id/deliveries — lista (só participantes/admin) */
  async list(req, res) {
    try {
      const projectId = Number(req.params.id);
      const proj = await projetoOuErro(projectId);
      if (!souParticipante(proj, req.user.id) && req.user.tipo_usuario !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Acesso negado: apenas participantes do projeto' });
      }
      const [rows] = await db.query(`
        SELECT d.*, u.nome as freelancer_nome
        FROM deliveries d JOIN users u ON u.id = d.freelancer_id
        WHERE d.project_id = ? ORDER BY d.numero ASC
      `, [projectId]);
      const [files] = await db.query(`
        SELECT df.* FROM delivery_files df
        JOIN deliveries d ON d.id = df.delivery_id
        WHERE d.project_id = ? ORDER BY df.id ASC
      `, [projectId]);
      const entregas = rows.map((d) => ({
        ...d,
        links: typeof d.links === 'string' ? JSON.parse(d.links) : (d.links || []),
        arquivos: files.filter((f) => f.delivery_id === d.id),
      }));
      res.json({ success: true, deliveries: entregas });
    } catch (err) {
      responderErro(res, err, 'DELIV-L');
    }
  },

  /* GET /projects/:id/deliveries/files/:fileId — download autorizado */
  async download(req, res) {
    try {
      const projectId = Number(req.params.id);
      const fileId = Number(req.params.fileId);
      const proj = await projetoOuErro(projectId);
      if (!souParticipante(proj, req.user.id) && req.user.tipo_usuario !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Acesso negado: apenas participantes do projeto podem descarregar' });
      }
      const [[arquivo]] = await db.query(`
        SELECT df.* FROM delivery_files df
        JOIN deliveries d ON d.id = df.delivery_id
        WHERE df.id = ? AND d.project_id = ?
      `, [fileId, projectId]);
      if (!arquivo) {
        return res.status(404).json({ success: false, message: 'Ficheiro não encontrado' });
      }
      const caminho = caminhoArquivo(arquivo.url);
      if (!caminho) {
        return res.status(404).json({ success: false, message: 'Ficheiro não existe no armazenamento' });
      }
      res.download(caminho, arquivo.nome_original);
    } catch (err) {
      responderErro(res, err, 'DELIV-DL');
    }
  },

  /* POST /projects/:id/deliveries/:deliveryId/approve — cliente aprova */
  async approve(req, res) {
    try {
      const r = await finance.aprovarEntrega({ projectId: Number(req.params.id), userId: req.user.id });
      res.json({
        success: true,
        message: r.liberado ? 'Entrega aprovada — pagamento liberado aos dois lados! 💰' : 'Entrega aprovada. Aguardando confirmação do freelancer.',
        ...r,
      });
    } catch (err) {
      responderErro(res, err, 'APPR');
    }
  },

  /* POST /projects/:id/deliveries/:deliveryId/revision — cliente pede revisão */
  async revision(req, res) {
    try {
      const motivo = (req.body && req.body.motivo) || '';
      const r = await finance.pedirRevisao({ projectId: Number(req.params.id), userId: req.user.id, motivo });
      res.json({ success: true, message: 'Revisão pedida — projeto voltou a EM_ANDAMENTO', ...r });
    } catch (err) {
      responderErro(res, err, 'REV');
    }
  },

  /* POST /projects/:id/dispute — abrir disputa */
  async dispute(req, res) {
    try {
      const motivo = (req.body && req.body.motivo) || '';
      const r = await finance.abrirDisputa({ projectId: Number(req.params.id), userId: req.user.id, motivo });
      res.json({ success: true, message: 'Disputa aberta — o administrador vai decidir', ...r });
    } catch (err) {
      responderErro(res, err, 'DSP');
    }
  },

  /* POST /projects/:id/confirm — freelancer confirma conclusão e valor */
  async confirm(req, res) {
    try {
      const r = await finance.confirmarConclusao({ projectId: Number(req.params.id), userId: req.user.id });
      res.json({
        success: true,
        message: r.liberado ? 'Conclusão confirmada — pagamento liberado! 💰' : 'Conclusão confirmada. Aguardando aprovação do cliente.',
        ...r,
      });
    } catch (err) {
      responderErro(res, err, 'CONF');
    }
  },

  /* POST /projects/:id/adjustments — propor ajuste de valor */
  async proposeAdjustment(req, res) {
    try {
      const { valor_novo, motivo } = req.body || {};
      const r = await finance.proporAjuste({
        projectId: Number(req.params.id), autorId: req.user.id, valorNovo: valor_novo, motivo,
      });
      res.status(201).json({ success: true, message: 'Proposta de ajuste enviada — aguarda resposta da outra parte', ...r });
    } catch (err) {
      responderErro(res, err, 'ADJ');
    }
  },

  /* POST /projects/:id/adjustments/:adjustmentId/respond — responder ajuste */
  async respondAdjustment(req, res) {
    try {
      const { aceitar } = req.body || {};
      const r = await finance.responderAjuste({
        ajusteId: Number(req.params.adjustmentId), userId: req.user.id, aceitar: !!aceitar,
      });
      res.json({ success: true, message: r.aceito ? 'Ajuste aceite e aplicado' : 'Ajuste recusado', ...r });
    } catch (err) {
      responderErro(res, err, 'ADJ-R');
    }
  },

  /* POST /projects/:id/cancel — pedir cancelamento (acordo dos dois) */
  async requestCancel(req, res) {
    try {
      const { motivo } = req.body || {};
      const r = await finance.proporCancelamento({ projectId: Number(req.params.id), autorId: req.user.id, motivo });
      res.json({ success: true, message: r.pedido ? 'Pedido de cancelamento enviado' : 'Projeto cancelado', ...r });
    } catch (err) {
      responderErro(res, err, 'CNC');
    }
  },

  /* POST /projects/:id/cancel/:reqId/respond — responder cancelamento */
  async respondCancel(req, res) {
    try {
      const { aceitar } = req.body || {};
      const r = await finance.responderCancelamento({
        reqId: Number(req.params.reqId), userId: req.user.id, aceitar: !!aceitar,
      });
      res.json({
        success: true,
        message: r.aceito ? `Cancelamento aceite${r.reembolso ? ' — valor reembolsado ao cliente' : ''}` : 'Cancelamento recusado',
        ...r,
      });
    } catch (err) {
      responderErro(res, err, 'CNC-R');
    }
  },
};

module.exports = deliveryController;
