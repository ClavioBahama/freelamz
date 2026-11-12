/* ============================================================
   FreelaMZ — Controller de pagamentos e carteira (FASE A)
   ============================================================ */
const finance = require('../services/finance');
const { getProvider } = require('../services/payments');
const { ErroFinanceiro } = finance;

function responderErro(res, err, prefixo) {
  if (err instanceof ErroFinanceiro) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  console.error(`[${prefixo}]`, err.stack || err.message);
  return res.status(500).json({ success: false, message: 'Erro interno' });
}

const paymentController = {
  /* Config visível ao frontend (modo de teste, comissão, métodos) */
  async config(req, res) {
    try {
      const provider = getProvider();
      const comissao = parseFloat(await finance.getSetting('comissao_percentual', '10'));
      res.json({
        success: true,
        config: {
          provider: provider.name,
          modo_teste: provider.isTestMode,
          comissao_percentual: comissao,
          metodos: ['MPESA', 'EMOLA', 'CARTAO', 'SALDO'],
        },
      });
    } catch (err) {
      responderErro(res, err, 'PAY');
    }
  },

  /* POST /payments/pay — cliente paga o projeto (escrow RETIDO) */
  async pay(req, res) {
    try {
      const { projectId, metodo, numero, pin, simularFalha } = req.body || {};
      if (!projectId) {
        return res.status(400).json({ success: false, message: 'projectId é obrigatório' });
      }
      // botão "Simular falha" só em desenvolvimento
      const forcarFalha = process.env.NODE_ENV === 'development' ? !!simularFalha : false;
      const r = await finance.pagarProjeto({
        userId: req.user.id, projectId: Number(projectId),
        metodo, numero, pin, simularFalha: forcarFalha,
      });
      res.json({ success: true, message: 'Pagamento recebido e retido com segurança 🔒', ...r });
    } catch (err) {
      responderErro(res, err, 'PAY');
    }
  },

  /* GET /payments/wallet — saldo, a receber/em escrow e extrato */
  async wallet(req, res) {
    try {
      const estado = await finance.estadoCarteira(req.user.id, req.user.tipo_usuario);
      res.json({
        success: true,
        wallet: {
          saldo: estado.saldo,
          pendente: estado.pendente,
          currency: estado.currency,
          rotulo_pendente: req.user.tipo_usuario === 'FREELANCER' ? 'A receber (em escrow)' : 'Em escrow',
        },
        transacoes: estado.extrato,
      });
    } catch (err) {
      responderErro(res, err, 'WALLET');
    }
  },

  /* GET /payments/wallet/transactions?tipo=&page= — extrato filtrado */
  async transactions(req, res) {
    try {
      const transacoes = await finance.extratoFiltrado(req.user.id, {
        tipo: req.query.tipo || null,
        page: req.query.page || 1,
        limit: req.query.limit || 50,
      });
      res.json({ success: true, transacoes });
    } catch (err) {
      responderErro(res, err, 'WALLET-TX');
    }
  },

  /* POST /payments/wallet/recharge — adicionar saldo FICTÍCIO (só modo de teste) */
  async recharge(req, res) {
    try {
      const { valor } = req.body || {};
      const r = await finance.recarregar({ userId: req.user.id, valorMT: valor });
      res.json({ success: true, message: 'Saldo fictício adicionado (modo de teste)', saldo: r.saldo });
    } catch (err) {
      responderErro(res, err, 'RCH');
    }
  },

  /* POST /payments/wallet/withdraw — saque fictício (PENDENTE → admin decide) */
  async withdraw(req, res) {
    try {
      const { valor, metodo, destino } = req.body || {};
      const r = await finance.sacar({ userId: req.user.id, valorMT: valor, metodo, destino });
      res.json({ success: true, message: 'Saque registado — aguarda aprovação do administrador', saqueId: r.saqueId });
    } catch (err) {
      responderErro(res, err, 'WDR');
    }
  },

  /* GET /payments/withdrawals — os meus saques */
  async myWithdrawals(req, res) {
    try {
      const saques = await finance.listarSaques({ userId: req.user.id });
      res.json({ success: true, saques });
    } catch (err) {
      responderErro(res, err, 'WDR-L');
    }
  },
};

module.exports = paymentController;
