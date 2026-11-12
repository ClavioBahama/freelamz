/* ============================================================
   FreelaMZ — Contrato PaymentProvider (interface)
   ------------------------------------------------------------
   Qualquer provedor de pagamentos REAL ou SIMULADO deve
   implementar estes métodos. Trocar de provedor exige apenas
   PAYMENT_PROVIDER=<nome> no .env (ver index.js).

   Convenções:
   - Todos os valores chegam em CENTAVOS (inteiros, nunca float)
   - charge() devolve { ok, reference, provider, erro?, raw? }
   - withdraw() devolve { ok, reference, provider, erro?, raw? }
   - Nunca lança exceção por falha de negócio — devolve ok:false
     (exceção só para erro de programação/infraestrutura)
   ============================================================ */

class PaymentProvider {
  /** Nome curto do provedor ('fake', 'mpesa', 'emola'…) */
  get name() {
    throw new Error('PaymentProvider.name não implementado');
  }

  /** true enquanto nenhuma chave real estiver configurada (modo de teste) */
  get isTestMode() {
    return true;
  }

  /**
   * Cobrar um valor ao utilizador (pagamento do projeto pelo cliente).
   * @param {Object} p
   * @param {number} p.amount        Valor em CENTAVOS
   * @param {string} p.currency     'MZN'
   * @param {string} p.method       'MPESA' | 'EMOLA' | 'CARTAO'
   * @param {number} p.userId       Id do utilizador que paga
   * @param {Object} [p.meta]       { numero, pin, simularFalha, descricao }
   * @returns {Promise<{ok:boolean, reference?:string, provider?:string, erro?:string, raw?:Object}>}
   */
  // eslint-disable-next-line no-unused-vars
  async charge({ amount, currency, method, userId, meta }) {
    throw new Error('PaymentProvider.charge() não implementado');
  }

  /**
   * Transferir saldo para fora da plataforma (saque do freelancer).
   * @param {Object} p
   * @param {number} p.amount       Valor em CENTAVOS
   * @param {string} p.method       'MPESA' | 'EMOLA' | 'BANCO'
   * @param {string} p.destination  Número/IBAN de destino
   * @param {number} p.userId
   * @returns {Promise<{ok:boolean, reference?:string, provider?:string, erro?:string, raw?:Object}>}
   */
  // eslint-disable-next-line no-unused-vars
  async withdraw({ amount, method, destination, userId }) {
    throw new Error('PaymentProvider.withdraw() não implementado');
  }
}

module.exports = PaymentProvider;
