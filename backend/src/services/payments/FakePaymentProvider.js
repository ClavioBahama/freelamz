/* ============================================================
   FreelaMZ — FakePaymentProvider (MODO DE TESTE)
   ------------------------------------------------------------
   Simula M-Pesa / e-Mola / Cartão sem tocar em dinheiro real.
   Nunca deve ser usado em produção — o .env decide o provedor.

   Variáveis do .env:
     PAYMENT_PROVIDER=fake
     FAKE_PAYMENT_FAIL_RATE=0    (0 a 1 — probabilidade de falhar)
     FAKE_PAYMENT_DELAY_MS=1500  (tempo de "processamento" simulado)
   ============================================================ */
const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

const dormir = (ms) => new Promise((r) => { setTimeout(r, ms); });

class FakePaymentProvider extends PaymentProvider {
  get name() {
    return 'fake';
  }

  get isTestMode() {
    return true; // nenhum dinheiro real é movimentado
  }

  async charge({ amount, currency = 'MZN', method, userId, meta = {} }) {
    if (!amount || amount <= 0) {
      return { ok: false, erro: 'Valor inválido' };
    }

    // tempo de processamento simulado (loading no frontend)
    const delay = parseInt(process.env.FAKE_PAYMENT_DELAY_MS, 10);
    await dormir(Number.isFinite(delay) ? delay : 1500);

    // falha forçada (botão "Simular falha" em dev) ou taxa aleatória
    const taxa = parseFloat(process.env.FAKE_PAYMENT_FAIL_RATE || '0') || 0;
    if (meta.simularFalha || Math.random() < taxa) {
      return {
        ok: false,
        provider: this.name,
        erro: 'Pagamento recusado pelo provedor (simulado). Tente novamente.',
        raw: { simulated: true, method, forced: !!meta.simularFalha },
      };
    }

    return {
      ok: true,
      provider: this.name,
      reference: `FAKE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      raw: {
        simulated: true,
        method,
        currency,
        amount,
        userId,
        numero: meta.numero ? String(meta.numero).replace(/\d(?=\d{2})/g, '*') : null,
      },
    };
  }

  async withdraw({ amount, method, destination, userId }) {
    if (!amount || amount <= 0) {
      return { ok: false, erro: 'Valor inválido' };
    }
    const delay = parseInt(process.env.FAKE_PAYMENT_DELAY_MS, 10);
    await dormir(Number.isFinite(delay) ? Math.min(delay, 800) : 800);
    return {
      ok: true,
      provider: this.name,
      reference: `FAKEW-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      raw: { simulated: true, method, destination, amount, userId },
    };
  }
}

module.exports = FakePaymentProvider;
