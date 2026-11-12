/* ============================================================
   FreelaMZ — EmolaProvider (ESQUELETO para pagamentos reais)
   ------------------------------------------------------------
   ATIVO APENAS QUANDO PAYMENT_PROVIDER=emola no .env.
   Enquanto as chaves não existirem, toda a cobrança falha com
   uma mensagem clara (nunca deve "parecer" que funcionou).

   Para ligar os pagamentos reais e-Mola (Movitel MZ):
   1) Contratar o serviço C2B/B2C junto da Movitel e obter:
        - EMOLA_API_KEY       (token de API)
        - EMOLA_API_SECRET
        - EMOLA_PROVIDER_HOST (ex.: https://api.emola.co.mz)
        - EMOLA_MERCHANT_ID   (código do comerciante)
   2) No .env: PAYMENT_PROVIDER=emola + as variáveis acima
   3) Implementar charge()/withdraw() respeitando o contrato do
      PaymentProvider.js — o resto do sistema não muda nada.

   Exemplo de integração (padrão REST comum nos gateways MZ):
   ------------------------------------------------------------
   // async charge({ amount, currency, method, userId, meta }) {
   //   const res = await fetch(`${process.env.EMOLA_PROVIDER_HOST }/v1/payments`, {
   //     method: 'POST',
   //     headers: {
   //       Authorization: `Bearer ${process.env.EMOLA_API_KEY}`,
   //       'Content-Type': 'application/json',
   //     },
   //     body: JSON.stringify({
   //       msisdn: meta.numero,                 // +258 8X XXX XXXX
   //       amount: (amount / 100).toFixed(2),   // centavos → MT
   //       currency: 'MZN',
   //       merchantId: process.env.EMOLA_MERCHANT_ID,
   //       description: 'Pagamento de projeto FreelaMZ',
   //       callbackUrl: `${process.env.APP_URL}/api/payments/webhook/emola`,
   //     }),
   //   });
   //   const raw = await res.json();
   //   if (!res.ok || !raw.success) {
   //     return { ok: false, erro: raw.message || 'Pagamento e-Mola recusado', raw };
   //   }
   //   return { ok: true, provider: this.name, reference: raw.transactionId, raw };
   // }
   ============================================================ */
const PaymentProvider = require('./PaymentProvider');

class EmolaProvider extends PaymentProvider {
  get name() {
    return 'emola';
  }

  get isTestMode() {
    return !process.env.EMOLA_API_KEY || !process.env.EMOLA_API_SECRET;
  }

  async charge() {
    return {
      ok: false,
      provider: this.name,
      erro: 'e-Mola real não configurado. Defina EMOLA_API_KEY/EMOLA_API_SECRET no .env '
        + '(ou volte a PAYMENT_PROVIDER=fake para o modo de teste).',
    };
  }

  async withdraw() {
    return {
      ok: false,
      provider: this.name,
      erro: 'Saques e-Mola reais não configurados. Defina EMOLA_API_KEY/EMOLA_API_SECRET no .env.',
    };
  }
}

module.exports = EmolaProvider;
