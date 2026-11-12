/* ============================================================
   FreelaMZ — MpesaProvider (ESQUELETO para pagamentos reais)
   ------------------------------------------------------------
   ATIVO APENAS QUANDO PAYMENT_PROVIDER=mpesa no .env.
   Enquanto as chaves não existirem, toda a cobrança falha com
   uma mensagem clara (nunca deve "parecer" que funcionou).

   Para ligar os pagamentos reais M-Pesa (Vodacom MZ):
   1) Criar conta no portal de developers da M-Pesa
      (https://developer.mpesa.vm.co.mz) e obter:
        - MPESA_API_KEY        (Consumer Key / API Key)
        - MPESA_API_SECRET     (Consumer Secret / Public Key)
        - MPESA_PROVIDER_HOST  (ex.: https://api.sandbox.vm.co.mz)
        - MPESA_SHORTCODE      (código do agente/loja)
   2) No .env: PAYMENT_PROVIDER=mpesa + as variáveis acima
   3) Implementar charge()/withdraw() abaixo — o contrato está no
      PaymentProvider.js; o resto do sistema não muda nada.

   Exemplo de integração (C2B — cliente paga com o telemóvel):
   ------------------------------------------------------------
   // async charge({ amount, currency, method, userId, meta }) {
   //   const token = await this.#obterToken();            // OAuth/Session
   //   const res = await fetch(`${process.env.MPESA_PROVIDER_HOST}/ipg/v1x/c2bPayment/singleStage `, {
   //     method: 'POST',
   //     headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
   //     body: JSON.stringify({
   //       input_CustomerMSISDN: meta.numero,          // +258 8X XXX XXXX
   //       input_Amount: (amount / 100).toFixed(2),    // centavos → MT
   //       input_Country: 'MZ',
   //       input_Currency: 'MZN',
   //       input_ServiceProviderCode: process.env.MPESA_SHORTCODE,
   //       input_ThirdPartyReference: `FREELAMZ-${userId}`,
   //       input_RequestedDescription: 'Pagamento de projeto FreelaMZ',
   //     }),
   //   });
   //   const raw = await res.json();
   //   if (!res.ok || raw.output_ResponseCode !== 'INS-0') {
   //     return { ok: false, erro: raw.output_ResponseDesc || 'Pagamento M-Pesa recusado', raw };
   //   }
   //   return { ok: true, provider: this.name, reference: raw.output_TransactionID, raw };
   // }
   ============================================================ */
const PaymentProvider = require('./PaymentProvider');

class MpesaProvider extends PaymentProvider {
  get name() {
    return 'mpesa';
  }

  get isTestMode() {
    return !process.env.MPESA_API_KEY || !process.env.MPESA_API_SECRET;
  }

  async charge() {
    return {
      ok: false,
      provider: this.name,
      erro: 'M-Pesa real não configurado. Defina MPESA_API_KEY/MPESA_API_SECRET no .env '
        + '(ou volte a PAYMENT_PROVIDER=fake para o modo de teste).',
    };
  }

  async withdraw() {
    return {
      ok: false,
      provider: this.name,
      erro: 'Saques M-Pesa reais não configurados. Defina MPESA_API_KEY/MPESA_API_SECRET no .env.',
    };
  }
}

module.exports = MpesaProvider;
