/* ============================================================
   FreelaMZ — Fábrica de provedores de pagamento
   ------------------------------------------------------------
   Trocar de provedor = mudar UMA variável do .env:
     PAYMENT_PROVIDER=fake   (padrão — modo de teste, sem dinheiro real)
     PAYMENT_PROVIDER=mpesa  (real — requer MPESA_API_KEY etc.)
     PAYMENT_PROVIDER=emola  (real — requer EMOLA_API_KEY etc.)
   ============================================================ */
const FakePaymentProvider = require('./FakePaymentProvider');
const MpesaProvider = require('./MpesaProvider');
const EmolaProvider = require('./EmolaProvider');

const REGISTO = {
  fake: () => new FakePaymentProvider(),
  mpesa: () => new MpesaProvider(),
  emola: () => new EmolaProvider(),
};

function getProvider() {
  const nome = String(process.env.PAYMENT_PROVIDER || 'fake').toLowerCase().trim();
  const criar = REGISTO[nome] || REGISTO.fake;
  return criar();
}

module.exports = { getProvider };
