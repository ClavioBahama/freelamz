/* ============================================================
   FreelaMZ — Carteira (FASE A)
   Saldo, valor retido/em escrow, recarga fictícia, saque e
   extrato filtrado por tipo. Os valores da API vêm em CENTAVOS.
   ============================================================ */
import { api } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import { navbar, renderAvatar, toast, skeletonLista, skeletonMetricas, emptyState, errorState } from '../js/layout.js';
import { formatarMoeda, formatarData, formatarHora } from '../js/utils.js';

/* Tipos de transação: rótulo, ícone e sinal (entrada/saída/neutro) */
const TIPOS = {
  RECARGA_FICTICIA: { rot: 'Recarga (teste)', ic: 'plus_circle_fill', sinal: 1 },
  PAGAMENTO_PROJETO: { rot: 'Pagamento de projeto', ic: 'creditcard_fill', sinal: -1 },
  LIBERACAO_ESCROW: { rot: 'Liberação de escrow', ic: 'lock_open_fill', sinal: 1 },
  COMISSAO: { rot: 'Comissão da plataforma', ic: 'percent', sinal: 0 },
  REEMBOLSO: { rot: 'Reembolso', ic: 'arrow_uturn_left', sinal: 1 },
  AJUSTE_VALOR: { rot: 'Ajuste de valor', ic: 'arrow_2_squarepath', sinal: 0 },
  SAQUE: { rot: 'Saque', ic: 'arrow_down_circle_fill', sinal: -1 },
  SAQUE_RECUSADO: { rot: 'Saque recusado (devolvido)', ic: 'xmark_circle_fill', sinal: 1 },
};
const metaTipo = (t) => TIPOS[t] || { rot: t || 'Movimento', ic: 'money_yen_circle', sinal: 0 };

const FILTROS = [
  { id: '', rot: 'Todos' },
  { id: 'RECARGA_FICTICIA', rot: 'Recargas' },
  { id: 'PAGAMENTO_PROJETO', rot: 'Pagamentos' },
  { id: 'LIBERACAO_ESCROW', rot: 'Liberações' },
  { id: 'REEMBOLSO', rot: 'Reembolsos' },
  { id: 'AJUSTE_VALOR', rot: 'Ajustes' },
  { id: 'SAQUE', rot: 'Saques' },
];

export default function wallet(props, { $h, $onMounted, $f7router, $update }) {
  const usuario = loadAuth().user || {};

  let carregando = true;
  let erro = null;
  let carteira = { saldo: 0, pendente: 0, rotulo_pendente: 'Em escrow' };
  let transacoes = [];
  let saques = [];
  let config = null; // modo_teste, comissao_percentual

  let filtro = '';
  let recValor = '';
  let sacValor = '';
  let sacMetodo = 'MPESA';
  let sacDestino = '';
  let enviando = null; // 'recarga' | 'saque'

  const ir = (path) => $f7router.navigate(path);

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const [w, s, c] = await Promise.all([
        api.get('/payments/wallet'),
        api.get('/payments/withdrawals'),
        api.get('/payments/config'),
      ]);
      carteira = w.wallet || carteira;
      transacoes = w.transacoes || [];
      saques = s.saques || [];
      config = c.config || null;
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  const aplicarFiltro = async (id) => {
    filtro = id;
    try {
      const res = await api.get(`/payments/wallet/transactions${id ? `?tipo=${id}` : ''}`);
      transacoes = res.transacoes || transacoes;
    } catch (e) {
      toast(e.message || 'Erro ao filtrar', 'error');
    }
    $update();
  };

  const recarregar = async (e) => {
    e.preventDefault();
    const valor = Number(recValor);
    if (!valor || valor < 1) return toast('Indique um valor entre 1 e 10.000 MT', 'error');
    if (enviando) return;
    enviando = 'recarga'; $update();
    try {
      const r = await api.post('/payments/wallet/recharge', { valor });
      toast('Saldo fictício adicionado (modo de teste) 🧪', 'success');
      recValor = '';
      await carregar();
    } catch (err) {
      toast(err.message || 'Erro na recarga', 'error');
    }
    enviando = null;
    $update();
  };

  const sacar = async (e) => {
    e.preventDefault();
    const valor = Number(sacValor);
    if (!valor || valor < 1) return toast('Indique o valor do saque', 'error');
    if (!sacDestino.trim()) return toast('Indique o destino (número M-Pesa/e-Mola ou IBAN)', 'error');
    if (enviando) return;
    enviando = 'saque'; $update();
    try {
      await api.post('/payments/wallet/withdraw', { valor, metodo: sacMetodo, destino: sacDestino.trim() });
      toast('Saque registado — aguarda aprovação do administrador ⏳', 'success');
      sacValor = ''; sacDestino = '';
      await carregar();
    } catch (err) {
      toast(err.message || 'Erro no saque', 'error');
    }
    enviando = null;
    $update();
  };

  $onMounted(carregar);

  const ehFreelancer = usuario.tipo_usuario === 'FREELANCER';

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Carteira', voltar: true })}
      <div class="page-content">
        <div class="mz-container">

          ${carregando ? $h`
            ${skeletonMetricas($h, 2)}
            <div style="margin-top:18px;">${skeletonLista($h, 5)}</div>
          ` : erro ? $h`
            <div style="padding-top:30px;">
              ${errorState($h, { mensagem: erro, onRetry: carregar })}
            </div>
          ` : $h`
            <!-- Hero da carteira -->
            <div class="wallet-hero">
              <div>
                <div class="wallet-eyebrow">Saldo disponível</div>
                <div class="wallet-saldo">${formatarMoeda(carteira.saldo / 100)}</div>
                <div class="wallet-sub">${carteira.rotulo_pendente || 'Em escrow'}:
                  <b>${formatarMoeda(carteira.pendente / 100)}</b></div>
              </div>
              <i class="f7-icons wallet-icone">creditcard_fill</i>
            </div>

            ${config && config.modo_teste ? $h`
              <div class="mz-badge badge-pendente" style="display:flex; gap:8px; align-items:center; padding:10px 14px; margin-bottom:16px;">
                🧪 Modo de teste: pagamentos fictícios (M-Pesa/e-Mola/cartão simulados).
                Comissão atual: ${config.comissao_percentual}%.
              </div>
            ` : ''}

            <!-- Recarga (só em modo de teste) -->
            ${config && config.modo_teste ? $h`
              <div class="mz-card" style="padding:18px;">
                <div class="section-title" style="margin:0 0 10px 0;">Recarga fictícia</div>
                <form class="mz-form" @submit=${recarregar}>
                  <div>
                    <label class="field-label">Valor a adicionar (MT)</label>
                    <div class="field-input">
                      <i class="f7-icons">plus_circle</i>
                      <input type="number" min="1" max="10000" placeholder="Ex.: 1000"
                        value=${recValor} @input=${(e) => { recValor = e.target.value; }} />
                    </div>
                  </div>
                  <button class="btn btn-green" type="submit" disabled=${enviando === 'recarga'}>
                    ${enviando === 'recarga' ? 'A adicionar…' : 'Adicionar saldo (simulado)'}
                  </button>
                </form>
              </div>
            ` : ''}

            <!-- Saque -->
            <div class="mz-card" style="padding:18px;">
              <div class="section-title" style="margin:0 0 10px 0;">Solicitar saque</div>
              <form class="mz-form" @submit=${sacar}>
                <div>
                  <label class="field-label">Valor (MT)</label>
                  <div class="field-input">
                    <i class="f7-icons">arrow_down_circle</i>
                    <input type="number" min="1" placeholder="Ex.: 500"
                      value=${sacValor} @input=${(e) => { sacValor = e.target.value; }} />
                  </div>
                </div>
                <div>
                  <label class="field-label">Método</label>
                  <div class="field-input">
                    <i class="f7-icons">creditcard</i>
                    <select value=${sacMetodo} @change=${(e) => { sacMetodo = e.target.value; $update(); }}>
                      <option value="MPESA" selected=${sacMetodo === 'MPESA'}>M-Pesa</option>
                      <option value="EMOLA" selected=${sacMetodo === 'EMOLA'}>e-Mola</option>
                      <option value="BANCO" selected=${sacMetodo === 'BANCO'}>Transferência bancária</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="field-label">Destino (nº M-Pesa/e-Mola ou IBAN)</label>
                  <div class="field-input">
                    <i class="f7-icons">phone_fill</i>
                    <input type="text" placeholder="Ex.: +258 84 000 0000"
                      value=${sacDestino} @input=${(e) => { sacDestino = e.target.value; }} />
                  </div>
                </div>
                <button class="btn btn-primary" type="submit" disabled=${enviando === 'saque'}>
                  ${enviando === 'saque' ? 'A registar…' : 'Pedir saque'}
                </button>
              </form>
            </div>

            <!-- Meus saques -->
            ${saques.length ? $h`
              <div class="section-title">Meus saques (${saques.length})</div>
              <div class="mz-list-card">
                ${saques.map((s) => $h`
                  <div class="mz-list-item">
                    <i class="f7-icons" style="font-size:22px; color:var(--mz-primary);">arrow_down_circle_fill</i>
                    <div class="mz-list-main">
                      <div class="mz-list-title">${formatarMoeda(s.valor / 100)} · ${s.metodo}</div>
                      <div class="mz-list-sub">${s.destino} · ${formatarData(s.created_at)}</div>
                    </div>
                    <span class="mz-badge badge-${s.status === 'CONCLUIDO' ? 'concluido' : s.status === 'RECUSADO' ? 'recusada' : 'pendente'}">
                      ${s.status === 'CONCLUIDO' ? 'Concluído' : s.status === 'RECUSADO' ? 'Recusado' : 'Pendente'}
                    </span>
                  </div>
                `)}
              </div>
            ` : ''}

            <!-- Extrato -->
            <div class="section-title">Extrato</div>
            <div class="filter-row" style="margin-bottom:12px;">
              ${FILTROS.map((f) => $h`
                <button class="filter-pill ${filtro === f.id ? 'active' : ''}"
                  @click=${() => aplicarFiltro(f.id)}>${f.rot}</button>
              `)}
            </div>

            ${transacoes.length === 0 ? $h`
              ${emptyState($h, {
                icone: 'doc_text_search',
                titulo: 'Sem movimentos',
                texto: 'Pagamentos, liberações e recargas aparecem aqui.',
              })}
            ` : $h`
              <div class="mz-list-card">
                ${transacoes.map((t) => {
                  const m = metaTipo(t.tipo);
                  const valorMT = Number(t.valor) / 100;
                  const sinal = m.sinal;
                  return $h`
                    <div class="mz-list-item">
                      <i class="f7-icons" style="font-size:22px; color:var(--mz-primary);">${m.ic}</i>
                      <div class="mz-list-main">
                        <div class="mz-list-title">${m.rot}</div>
                        <div class="mz-list-sub">
                          ${t.descricao || t.reference || ''} · ${formatarHora(t.created_at)}
                        </div>
                      </div>
                      <span class="tx-valor ${sinal > 0 ? 'pos' : sinal < 0 ? 'neg' : ''}">
                        ${sinal > 0 ? '+' : sinal < 0 ? '−' : ''}${formatarMoeda(valorMT)}
                      </span>
                    </div>
                  `;
                })}
              </div>
            `}
          `}
        </div>
      </div>
    </div>
  `;
}
