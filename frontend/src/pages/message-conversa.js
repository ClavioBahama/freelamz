/* ============================================================
   FreelaMZ — Conversa (chat) com contexto de projeto (FASE A)
   - Rota /messages/:id?projeto=X ativa a barra de estado do
     projeto (pagamento → andamento → entrega → conclusão)
   - Botões contextuais por papel/estado (pagar, entregar,
     aprovar, revisão, disputa, ajuste, cancelamento)
   - Cards numerados de ENTREGA / AJUSTE / mensagens de sistema
   - Atualização automática a cada 5 s
   ============================================================ */
import { api, getToken, apiUrl } from '../js/api.js';
import {
  navbar, renderAvatar, toast, skeletonLista, emptyState, errorState, statusBadge, renderButton,
} from '../js/layout.js';
import { formatarHora, formatarMoeda, horaCurta, rotuloDia } from '../js/utils.js';

/* ---------- helpers ---------- */
const CENTAVOS = (v) => formatarMoeda((Number(v) || 0) / 100);
const MT = (v) => formatarMoeda(v);

function parseExtra(m) {
  if (!m.extra) return null;
  if (typeof m.extra === 'object') return m.extra;
  try { return JSON.parse(m.extra); } catch (e) { return null; }
}

function tamanhoTexto(bytes) {
  const b = Number(bytes) || 0;
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} KB`;
  return `${b} B`;
}

/* Passos da barra de estado (índice do estado atual) */
const PASSOS = [
  { id: 'AGUARDANDO_PAGAMENTO', rot: 'Pagamento' },
  { id: 'EM_ANDAMENTO', rot: 'Em andamento' },
  { id: 'ENTREGUE', rot: 'Entregue' },
  { id: 'CONCLUIDO', rot: 'Concluído' },
];
const indicePasso = (status) => PASSOS.findIndex((p) => p.id === status);

export default function messageConversa(props, { $h, $onMounted, $onUnmounted, $f7route, $f7router, $update }) {
  const outroId = Number($f7route.params.id);
  const projetoId = $f7route.query.projeto ? Number($f7route.query.projeto) : null;
  const eu = (window.freelaMZ && window.freelaMZ.usuario) || {};

  let carregando = true;
  let erro = null;
  let mensagens = [];
  let outro = { id: outroId, nome: 'Conversa' };
  let texto = '';
  let enviando = false;
  let intervalo = null;

  /* Contexto do projeto (quando ?projeto=) */
  let projeto = null;
  let escrow = null;
  let entregas = [];
  let meuPapel = null; // 'cliente' | 'freelancer' | 'admin'

  /* Modais */
  const pagar = { aberto: false, metodo: 'MPESA', numero: '', pin: '', falha: false, saldo: null, processando: false };
  const entregar = { aberto: false, mensagem: '', links: [], linkInput: '', arquivos: [], enviando: false };
  const ajuste = { aberto: false, valor: '', motivo: '' };
  const revisao = { aberto: false, motivo: '' };
  const disputa = { aberto: false, motivo: '' };
  const cancelar = { aberto: false, motivo: '' };
  let agindo = false; // qualquer ação em curso

  const ir = (path) => $f7router.navigate(path);
  const ehCliente = () => meuPapel === 'cliente';
  const ehFreelancer = () => meuPapel === 'freelancer';
  const escrowRetido = () => escrow && escrow.status === 'RETIDO' && Number(escrow.amount_held) > 0;

  /* ---------- carregamento ---------- */
  const carregarConversa = async (silencoso = false) => {
    try {
      const query = `destinatario_id=${outroId}${projetoId ? `&projeto_id=${projetoId}` : ''}`;
      const res = await api.get(`/messages/conversation?${query}`);
      mensagens = res.mensagens || [];
      const recebida = mensagens.find((m) => m.remetente_id !== eu.id);
      if (recebida && recebida.remetente_nome) {
        outro = { id: outroId, nome: recebida.remetente_nome };
      }
    } catch (e) {
      if (!silencoso) erro = e.message;
    }
  };

  const carregarProjeto = async (silencoso = false) => {
    if (!projetoId) return;
    try {
      const res = await api.get(`/projects/${projetoId}`);
      projeto = res.project;
      escrow = res.escrow;
      meuPapel = res.meu_papel;
      const nome = ehCliente()
        ? projeto.freelancer_nome
        : ehFreelancer() ? projeto.cliente_nome : (projeto.cliente_nome || outro.nome);
      outro = { id: outroId, nome: nome || outro.nome };
    } catch (e) {
      if (!silencoso) erro = e.message;
    }
  };

  const carregarEntregas = async (silencoso = false) => {
    if (!projetoId) return;
    try {
      const res = await api.get(`/projects/${projetoId}/deliveries`);
      entregas = res.deliveries || [];
    } catch (e) {
      if (!silencoso) { /* 403 para não-participantes — o GET do projeto já cobre */ }
    }
  };

  const carregar = async (silencoso = false) => {
    if (!silencoso) { carregando = true; erro = null; $update(); }
    await Promise.all([carregarConversa(silencoso), carregarProjeto(silencoso), carregarEntregas(silencoso)]);
    if (!silencoso) carregando = false;
    $update();
    rolarParaFim();
  };

  /* O .page-content É o elemento com scroll (não descendente dele) —
     procurar '.page-content .msg-scroll' devolvia sempre null e o
     auto-scroll nunca funcionava. '.page-current' mira só a página ativa.
     Duplo rAF + retry: o patch do htm nem sempre flui no primeiro frame. */
  const rolarParaFim = () => {
    const alvo = () => {
      const el = document.querySelector('.page-current .page-content.msg-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    };
    requestAnimationFrame(() => {
      alvo();
      requestAnimationFrame(alvo);
    });
    setTimeout(alvo, 350);
  };

  let tecladoHandler = null;

  $onMounted(() => {
    carregar();
    intervalo = setInterval(() => carregar(true), 5000);
    /* Teclado mobile: visualViewport encolhe quando o teclado abre —
       a barra de envio sobe com ele em vez de ficar coberta. */
    const vv = window.visualViewport;
    if (vv) {
      tecladoHandler = () => {
        const barra = document.querySelector('.page-current .msg-input-bar');
        const conteudo = document.querySelector('.page-current .page-content.msg-scroll');
        const teclado = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        if (barra) barra.style.transform = teclado > 0 ? `translateY(${-teclado}px)` : '';
        if (conteudo) conteudo.style.paddingBottom = teclado > 0 ? `${teclado + 120}px` : '';
        if (teclado > 0) rolarParaFim();
      };
      vv.addEventListener('resize', tecladoHandler);
      vv.addEventListener('scroll', tecladoHandler);
    }
  });

  $onUnmounted(() => {
    if (intervalo) clearInterval(intervalo);
    const vv = window.visualViewport;
    if (vv && tecladoHandler) {
      vv.removeEventListener('resize', tecladoHandler);
      vv.removeEventListener('scroll', tecladoHandler);
      tecladoHandler = null;
    }
  });

  /* ---------- ações de texto ---------- */
  const enviar = async (e) => {
    if (e) e.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    enviando = true;
    texto = '';
    $update();
    try {
      await api.post('/messages', {
        destinatario_id: outroId, projeto_id: projetoId || undefined, texto: conteudo,
      });
      await carregar(true);
    } catch (err) {
      toast(err.message || 'Erro ao enviar mensagem', 'error');
    }
    enviando = false;
    $update();
  };

  /* ---------- ações financeiras ---------- */
  const ultimaEntrega = () => entregas[entregas.length - 1] || null;

  const abrirPagar = async () => {
    pagar.aberto = true; pagar.metodo = 'MPESA'; pagar.numero = ''; pagar.pin = ''; pagar.falha = false;
    pagar.processando = false;
    try {
      const w = await api.get('/payments/wallet');
      pagar.saldo = w.wallet ? w.wallet.saldo : 0;
    } catch (e) { pagar.saldo = null; }
    $update();
  };

  const pagarProjeto = async (e) => {
    e.preventDefault();
    if (pagar.processando) return;
    if (pagar.metodo !== 'SALDO' && !pagar.numero.trim()) {
      return toast('Indique o número do telefone / cartão', 'error');
    }
    pagar.processando = true; $update();
    try {
      const r = await api.post('/payments/pay', {
        projectId: projetoId, metodo: pagar.metodo,
        numero: pagar.metodo === 'SALDO' ? undefined : pagar.numero.trim(),
        pin: pagar.metodo === 'SALDO' ? undefined : pagar.pin.trim(),
        simularFalha: pagar.falha || undefined,
      });
      toast(r.message || 'Pagamento recebido e retido 🔒', 'success');
      pagar.aberto = false;
      await carregar(true);
    } catch (err) {
      toast(err.message || 'Pagamento recusado', 'error');
    }
    pagar.processando = false;
    $update();
  };

  const enviarEntrega = async (e) => {
    e.preventDefault();
    if (entregar.enviando) return;
    const msg = entregar.mensagem.trim();
    if (!msg && !entregar.arquivos.length && !entregar.links.length) {
      return toast('Escreva a mensagem, anexe ficheiros ou inclua um link', 'error');
    }
    entregar.enviando = true; $update();
    try {
      const fd = new FormData();
      fd.append('mensagem', msg);
      fd.append('links', JSON.stringify(entregar.links));
      entregar.arquivos.forEach((f) => fd.append('arquivos', f));
      const r = await api.postForm(`/projects/${projetoId}/deliveries`, fd);
      toast(r.message || 'Entrega enviada 📦', 'success');
      entregar.aberto = false;
      entregar.mensagem = ''; entregar.links = []; entregar.arquivos = [];
      await carregar(true);
    } catch (err) {
      toast(err.message || 'Erro ao enviar entrega', 'error');
    }
    entregar.enviando = false;
    $update();
  };

  const escolherArquivos = (e) => {
    const lista = [...e.target.files || []];
    e.target.value = '';
    const ATUAL = ['.pdf', '.zip', '.jpg', '.jpeg', '.png', '.webp', '.docx', '.xlsx', '.mp4'];
    for (const f of lista) {
      if (entregar.arquivos.length >= 5) return toast('Máximo de 5 ficheiros por entrega', 'error');
      const ext = (f.name || '').toLowerCase().match(/\.[a-z0-9]+$/);
      if (!ext || !ATUAL.includes(ext[0])) return toast(`"${f.name}": tipo não permitido`, 'error');
      if (f.size > 20 * 1024 * 1024) return toast(`"${f.name}": acima de 20 MB`, 'error');
      entregar.arquivos.push(f);
    }
    $update();
  };

  const adicionarLink = () => {
    const l = entregar.linkInput.trim();
    if (!l) return;
    if (!/^https?:\/\//.test(l)) return toast('O link tem de começar por http:// ou https://', 'error');
    if (entregar.links.length >= 5) return toast('Máximo de 5 links', 'error');
    entregar.links.push(l);
    entregar.linkInput = '';
    $update();
  };

  const aprovarEntrega = async () => {
    if (agindo) return;
    agindo = true; $update();
    try {
      const d = ultimaEntrega();
      const r = await api.post(`/projects/${projetoId}/deliveries/${d ? d.id : 0}/approve`, {});
      toast(r.message || 'Entrega aprovada ✅', 'success');
      await carregar(true);
    } catch (err) {
      toast(err.message || 'Erro ao aprovar', 'error');
    }
    agindo = false; $update();
  };

  const confirmarConclusao = async () => {
    if (agindo) return;
    agindo = true; $update();
    try {
      const r = await api.post(`/projects/${projetoId}/confirm`, {});
      toast(r.message || 'Conclusão confirmada ✅', 'success');
      await carregar(true);
    } catch (err) {
      toast(err.message || 'Erro ao confirmar', 'error');
    }
    agindo = false; $update();
  };

  const pedirRevisao = async (e) => {
    e.preventDefault();
    if (!revisao.motivo.trim()) return toast('Escreva o motivo da revisão', 'error');
    try {
      const d = ultimaEntrega();
      const r = await api.post(`/projects/${projetoId}/deliveries/${d ? d.id : 0}/revision`,
        { motivo: revisao.motivo.trim() });
      toast(r.message || 'Revisão pedida 🔁', 'success');
      revisao.aberto = false; revisao.motivo = '';
      await carregar(true);
    } catch (err) {
      toast(err.message || 'Erro ao pedir revisão', 'error');
    }
    $update();
  };

  const abrirDisputa = async (e) => {
    e.preventDefault();
    if (!disputa.motivo.trim()) return toast('Explique o motivo da disputa', 'error');
    try {
      const r = await api.post(`/projects/${projetoId}/dispute`, { motivo: disputa.motivo.trim() });
      toast(r.message || 'Disputa aberta ⚖️', 'success');
      disputa.aberto = false; disputa.motivo = '';
      await carregar(true);
    } catch (err) {
      toast(err.message || 'Erro ao abrir disputa', 'error');
    }
    $update();
  };

  const proporAjuste = async (e) => {
    e.preventDefault();
    const valor = Number(ajuste.valor);
    if (!valor || valor < 1) return toast('Indique o novo valor', 'error');
    if (valor === Number(projeto.valor)) return toast('O novo valor é igual ao atual', 'error');
    try {
      const r = await api.post(`/projects/${projetoId}/adjustments`,
        { valor_novo: valor, motivo: ajuste.motivo.trim() || undefined });
      toast(r.message || 'Proposta de ajuste enviada 🤝', 'success');
      ajuste.aberto = false; ajuste.valor = ''; ajuste.motivo = '';
      await carregar(true);
    } catch (err) {
      toast(err.message || 'Erro ao propor ajuste', 'error');
    }
    $update();
  };

  const responderAjuste = async (ajusteId, aceitar) => {
    if (agindo) return;
    agindo = true; $update();
    try {
      const r = await api.post(`/projects/${projetoId}/adjustments/${ajusteId}/respond`, { aceitar });
      toast(r.message || 'Ajuste respondido', 'success');
      await carregar(true);
    } catch (err) {
      toast(err.message || 'Erro ao responder', 'error');
    }
    agindo = false; $update();
  };

  const pedirCancelamento = async (e) => {
    e.preventDefault();
    if (!cancelar.motivo.trim()) return toast('Escreva o motivo do cancelamento', 'error');
    try {
      const r = await api.post(`/projects/${projetoId}/cancel`, { motivo: cancelar.motivo.trim() });
      toast(r.message || 'Pedido enviado', 'success');
      cancelar.aberto = false; cancelar.motivo = '';
      await carregar(true);
    } catch (err) {
      toast(err.message || 'Erro ao pedir cancelamento', 'error');
    }
    $update();
  };

  const responderCancelamento = async (reqId, aceitar) => {
    if (agindo) return;
    agindo = true; $update();
    try {
      const r = await api.post(`/projects/${projetoId}/cancel/${reqId}/respond`, { aceitar });
      toast(r.message || 'Cancelamento respondido', 'success');
      await carregar(true);
    } catch (err) {
      toast(err.message || 'Erro ao responder', 'error');
    }
    agindo = false; $update();
  };

  /* Download protegido: fetch com token → blob → link temporário */
  const descarregar = async (f) => {
    try {
      const res = await fetch(apiUrl(`/projects/${projetoId}/deliveries/files/${f.id}`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        let msg = 'Erro ao descarregar';
        try { const j = await res.json(); msg = j.message || msg; } catch (e) {}
        return toast(msg, 'error');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.nome || f.nome_original || 'ficheiro';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      toast('Erro ao descarregar o ficheiro', 'error');
    }
  };

  /* id real do ficheiro (o extra traz id:null; a lista tem o id) */
  const fileIdDe = (url) => {
    for (const d of entregas) {
      const achado = (d.arquivos || []).find((a) => a.url === url);
      if (achado) return achado;
    }
    return null;
  };

  /* ---------- render: barra de estado ---------- */
  const renderBarraProjeto = () => {
    if (!projetoId || !projeto) return '';
    const idx = indicePasso(projeto.status);
    const valor = Number(projeto.valor) || 0;
    return $h`
      <div class="chat-projeto-bar">
        <div class="chat-proj-topo">
          <a class="chat-proj-link" @click=${() => ir(`/projects/${projetoId}`)}>
            <i class="f7-icons">doc_text_fill</i>
            <span>${projeto.servico_titulo || ('Projeto #' + projeto.id)}</span>
          </a>
          ${statusBadge($h, projeto.status)}
        </div>

        ${projeto.status === 'CANCELADO' || projeto.status === 'EM_DISPUTA' || idx >= 0 ? $h`
          <div class="chat-steps">
            ${PASSOS.map((p, i) => $h`
              <div class="chat-step ${idx >= i ? 'on' : ''}">
                <span class="chat-step-dot">${idx > i ? '✓' : i + 1}</span>
                <span class="chat-step-rot">${p.rot}</span>
              </div>
            `)}
          </div>
        ` : ''}

        <div class="chat-proj-valor">
          <span>Valor: <b>${MT(valor)}</b></span>
          ${escrow ? $h`
            <span>Escrow: <b>${CENTAVOS(escrow.amount_held)}</b> · ${statusBadge($h, escrow.status)}</span>
          ` : ''}
          ${projeto.status === 'AGUARDANDO_PAGAMENTO' && ehCliente() ? $h`
            <span class="text-muted">Pague para o freelancer começar 🔒</span>
          ` : ''}
          ${projeto.status === 'ENTREGUE' && projeto.client_approved ? $h`
            <span class="text-muted">Cliente aprovou — falta confirmar o freelancer</span>
          ` : ''}
          ${projeto.status === 'ENTREGUE' && !projeto.client_approved && ehCliente() ? $h`
            <span class="text-muted">A sua aprovação libera o pagamento (com o freelancer)</span>
          ` : ''}
        </div>

        <!-- Ações contextuais -->
        <div class="chat-acoes">
          ${ehCliente() && projeto.status === 'AGUARDANDO_PAGAMENTO' ? $h`
            ${renderButton($h, {
              icone: 'creditcard_fill', rotulo: `Pagar ${MT(valor)}`,
              variante: 'green', tamanho: 'sm', disabled: agindo, onClick: abrirPagar,
            })}
          ` : ''}
          ${ehFreelancer() && projeto.status === 'AGUARDANDO_PAGAMENTO' ? $h`
            <span class="text-muted text-sm">Aguarda o pagamento do cliente…</span>
          ` : ''}
          ${ehFreelancer() && (projeto.status === 'EM_ANDAMENTO' || projeto.status === 'ENTREGUE') && !projeto.freelancer_approved ? $h`
            ${renderButton($h, {
              icone: 'tray_full',
              rotulo: projeto.status === 'ENTREGUE' ? 'Nova entrega' : 'Entregar projeto',
              variante: 'primary', tamanho: 'sm',
              onClick: () => { entregar.aberto = true; $update(); },
            })}
          ` : ''}
          ${ehFreelancer() && projeto.status === 'ENTREGUE' && projeto.client_approved && !projeto.freelancer_approved ? $h`
            ${renderButton($h, {
              icone: 'checkmark_seal', rotulo: 'Confirmar conclusão e valor',
              variante: 'green', tamanho: 'sm', disabled: agindo, onClick: confirmarConclusao,
            })}
          ` : ''}
          ${ehCliente() && projeto.status === 'ENTREGUE' && !projeto.client_approved ? $h`
            ${renderButton($h, {
              icone: 'checkmark_circle', rotulo: 'Aprovar entrega',
              variante: 'green', tamanho: 'sm', disabled: agindo, onClick: aprovarEntrega,
            })}
            ${renderButton($h, {
              icone: 'arrow_2_circlepath', rotulo: 'Pedir revisão',
              variante: 'ghost', tamanho: 'sm', extraStyle: 'color:#B45309;',
              onClick: () => { revisao.aberto = true; $update(); },
            })}
            ${renderButton($h, {
              icone: 'exclamationmark_triangle', rotulo: 'Abrir disputa',
              variante: 'ghost', tamanho: 'sm', extraStyle: 'color:#ef4444;',
              onClick: () => { disputa.aberto = true; $update(); },
            })}
          ` : ''}
          ${projeto.status === 'EM_DISPUTA' ? $h`
            <span class="text-muted text-sm">Disputa em análise — o administrador decide ⚖️</span>
          ` : ''}
          ${escrowRetido() && projeto.status === 'EM_ANDAMENTO' && !projeto.ajustes_pendentes ? $h`
            ${renderButton($h, {
              icone: 'arrow_2_squarepath', rotulo: 'Ajustar valor',
              variante: 'ghost', tamanho: 'sm',
              onClick: () => { ajuste.aberto = true; $update(); },
            })}
          ` : ''}
          ${(projeto.status === 'AGUARDANDO_PAGAMENTO' || projeto.status === 'EM_ANDAMENTO')
            && !(entregas || []).length && !projeto.cancelamento_pendente ? $h`
            <button class="btn btn-ghost btn-sm" style="color:#ef4444;"
              @click=${() => { cancelar.aberto = true; $update(); }}>
              🚫 Cancelar
            </button>
          ` : ''}
        </div>
      </div>
    `;
  };

  /* ---------- render: mensagens ---------- */
  const renderMensagem = (m) => {
    const extra = parseExtra(m);
    const minha = m.remetente_id === eu.id;

    if (m.tipo === 'SISTEMA') {
      /* pedido de cancelamento pendente → card com resposta */
      if (extra && extra.cancel_req_id && projeto && projeto.cancelamento_pendente && !minha) {
        return $h`
          <div class="msg-card msg-card-cancel">
            <div class="msg-card-topo">
              <i class="f7-icons">xmark_circle_fill</i> Pedido de cancelamento
            </div>
            <div class="msg-card-corpo">${m.texto}</div>
            <div class="msg-card-acoes">
              <button class="btn btn-danger btn-sm" disabled=${agindo}
                @click=${() => responderCancelamento(extra.cancel_req_id, true)}>Aceitar e reembolsar</button>
              <button class="btn btn-sm" disabled=${agindo}
                @click=${() => responderCancelamento(extra.cancel_req_id, false)}>Recusar</button>
            </div>
          </div>
        `;
      }
      return $h`
        <div class="msg-sistema">${m.texto}
          <span class="msg-hora" style="display:block; text-align:center;">${formatarHora(m.created_at)}</span>
        </div>
      `;
    }

    if (m.tipo === 'ENTREGA' && extra) {
      const arquivos = extra.arquivos || [];
      const links = extra.links || [];
      return $h`
        <div class="msg-card msg-card-entrega ${minha ? 'minha' : ''}">
          <div class="msg-card-topo">
            <i class="f7-icons">tray_full</i> Entrega #${extra.numero}
          </div>
          ${m.texto ? $h`<div class="msg-card-corpo">${m.texto}</div>` : ''}
          ${arquivos.length ? $h`
            <div class="msg-arquivos">
              ${arquivos.map((a) => {
                const real = fileIdDe(a.url);
                return $h`
                  <div class="msg-arquivo">
                    <i class="f7-icons">doc_fill</i>
                    <div class="msg-arquivo-main">
                      <div>${a.nome || a.nome_original}</div>
                      <span>${a.tipo || ''} · ${tamanhoTexto(a.tamanho)}</span>
                    </div>
                    ${real ? $h`
                      <button class="btn btn-sm" @click=${() => descarregar(real)}>⬇ Descarregar</button>
                    ` : $h`<span class="text-muted text-sm">—</span>`}
                  </div>
                `;
              })}
            </div>
          ` : ''}
          ${links.length ? $h`
            <div class="msg-links">
              ${links.map((l) => $h`<a href=${l} target="_blank" rel="noopener">${l}</a>`)}
            </div>
          ` : ''}
          <span class="msg-hora">${formatarHora(m.created_at)}</span>
        </div>
      `;
    }

    if (m.tipo === 'AJUSTE' && extra) {
      const pendente = projeto && projeto.ajustes_pendentes && !minha;
      return $h`
        <div class="msg-card msg-card-ajuste ${minha ? 'minha' : ''}">
          <div class="msg-card-topo">
            <i class="f7-icons">arrow_2_squarepath</i> Ajuste de valor
          </div>
          <div class="msg-card-corpo">${m.texto}</div>
          ${pendente ? $h`
            <div class="msg-card-acoes">
              <button class="btn btn-green btn-sm" disabled=${agindo}
                @click=${() => responderAjuste(extra.ajuste_id, true)}>Aceitar</button>
              <button class="btn btn-danger btn-sm" disabled=${agindo}
                @click=${() => responderAjuste(extra.ajuste_id, false)}>Recusar</button>
            </div>
          ` : ''}
          <span class="msg-hora">${formatarHora(m.created_at)}</span>
        </div>
      `;
    }

    /* TEXTO normal */
    return $h`
      <div class="msg-row ${minha ? 'minha' : 'sua'}">
        ${minha ? '' : renderAvatar($h, m, 'avatar-sm')}
        <div class="msg-bubble">
          <div class="msg-texto">${m.texto}</div>
          <div class="msg-meta">
            <span class="msg-hora">${horaCurta(m.created_at)}</span>
            ${minha ? $h`
              <span class="msg-status" title=${m.lida ? 'Lida' : 'Enviada'}>
                <i class="icon f7-icons">checkmark</i>${m.lida ? $h`<i class="icon f7-icons">checkmark</i>` : ''}
              </span>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  };

  /* Render com separadores de data (Hoje / Ontem / dd/mm/aaaa) */
  const renderMensagens = () => {
    let ultimoDia = '';
    return mensagens.map((m) => {
      const dia = rotuloDia(m.created_at);
      const sep = dia && dia !== ultimoDia ? $h`<div class="msg-data"><span>${dia}</span></div>` : null;
      ultimoDia = dia;
      return $h`${sep}${renderMensagem(m)}`;
    });
  };

  /* ---------- render: modais ---------- */
  const renderModalPagar = () => !pagar.aberto ? '' : $h`
    <div class="mz-modal">
      <div class="mz-modal-card">
        <div class="mz-modal-head">
          <h3>Pagar ${MT(Number(projeto.valor) || 0)}</h3>
          <a class="mz-modal-x" @click=${() => { pagar.aberto = false; $update(); }}>
            <i class="f7-icons">xmark_circle_fill</i>
          </a>
        </div>
        <p class="text-muted text-sm" style="margin:0 0 14px 0;">
          O valor fica retido em segurança (escrow) e só é liberado quando os dois lados aprovarem.
        </p>
        <form class="mz-form" @submit=${pagarProjeto}>
          <div class="metodo-row">
            ${[['MPESA', 'M-Pesa'], ['EMOLA', 'e-Mola'], ['CARTAO', 'Cartão'], ['SALDO', 'Saldo']].map(([id, rot]) => $h`
              <button type="button" class="metodo-pill ${pagar.metodo === id ? 'active' : ''}"
                @click=${() => { pagar.metodo = id; $update(); }}>${rot}</button>
            `)}
          </div>

          ${pagar.metodo === 'SALDO' ? $h`
            <div class="mz-modal-info">
              Saldo disponível: <b>${pagar.saldo !== null ? CENTAVOS(pagar.saldo) : '…'}</b>
            </div>
          ` : $h`
            <div>
              <label class="field-label">${pagar.metodo === 'CARTAO' ? 'Número do cartão' : 'Número de telefone'}</label>
              <div class="field-input">
                <i class="f7-icons">${pagar.metodo === 'CARTAO' ? 'creditcard' : 'phone_fill'}</i>
                <input type="text" placeholder="Ex.: +258 84 500 0000"
                  value=${pagar.numero} @input=${(e) => { pagar.numero = e.target.value; }} />
              </div>
            </div>
            <div>
              <label class="field-label">PIN (fictício, 4+ dígitos)</label>
              <div class="field-input">
                <i class="f7-icons">lock_fill</i>
                <input type="password" placeholder="••••"
                  value=${pagar.pin} @input=${(e) => { pagar.pin = e.target.value; }} />
              </div>
            </div>
          `}

          <label class="mz-check">
            <input type="checkbox" checked=${pagar.falha}
              @change=${(e) => { pagar.falha = e.target.checked; $update(); }} />
            <span>Simular falha do provedor (só em desenvolvimento)</span>
          </label>

          <button class="btn btn-green" type="submit" disabled=${pagar.processando}>
            ${pagar.processando ? 'A processar pagamento… (~2 s simulado)' : `Pagar ${MT(Number(projeto.valor) || 0)}`}
          </button>
        </form>
      </div>
    </div>
  `;

  const renderModalEntregar = () => !entregar.aberto ? '' : $h`
    <div class="mz-modal">
      <div class="mz-modal-card">
        <div class="mz-modal-head">
          <h3>Entregar projeto</h3>
          <a class="mz-modal-x" @click=${() => { entregar.aberto = false; $update(); }}>
            <i class="f7-icons">xmark_circle_fill</i>
          </a>
        </div>
        <form class="mz-form" @submit=${enviarEntrega}>
          <div>
            <label class="field-label">Mensagem da entrega</label>
            <div class="field-input">
              <i class="f7-icons">chat_bubble_text</i>
              <textarea rows="3" placeholder="Descreva o que está a entregar…"
                @input=${(e) => { entregar.mensagem = e.target.value; }}>${entregar.mensagem}</textarea>
            </div>
          </div>
          <div>
            <label class="field-label">Ficheiros (máx. 5, 20 MB cada — PDF, ZIP, DOCX, XLSX, MP4, imagens)</label>
            <input type="file" multiple class="input-file-entrega"
              accept=".pdf,.zip,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.mp4" @change=${escolherArquivos} />
            ${entregar.arquivos.length ? $h`
              <div class="msg-arquivos" style="margin-top:8px;">
                ${entregar.arquivos.map((f, i) => $h`
                  <div class="msg-arquivo">
                    <i class="f7-icons">doc_fill</i>
                    <div class="msg-arquivo-main">
                      <div>${f.name}</div><span>${tamanhoTexto(f.size)}</span>
                    </div>
                    <a class="btn btn-sm" style="color:#ef4444;"
                      @click=${() => { entregar.arquivos.splice(i, 1); $update(); }}>✕</a>
                  </div>
                `)}
              </div>
            ` : ''}
          </div>
          <div>
            <label class="field-label">Links (Drive, WeTransfer…)</label>
            <div class="link-add-row">
              <input type="text" placeholder="https://…"
                value=${entregar.linkInput} @input=${(e) => { entregar.linkInput = e.target.value; }} />
              <button type="button" class="btn btn-sm" @click=${adicionarLink}>Adicionar</button>
            </div>
            ${entregar.links.length ? $h`
              <div class="msg-links" style="margin-top:8px;">
                ${entregar.links.map((l, i) => $h`
                  <div class="link-add-row">
                    <a href=${l} target="_blank" rel="noopener">${l}</a>
                    <a class="btn btn-sm" style="color:#ef4444;"
                      @click=${() => { entregar.links.splice(i, 1); $update(); }}>✕</a>
                  </div>
                `)}
              </div>
            ` : ''}
          </div>
          <button class="btn btn-primary" type="submit" disabled=${entregar.enviando}>
            ${entregar.enviando ? 'A enviar…' : 'Enviar entrega 📦'}
          </button>
        </form>
      </div>
    </div>
  `;

  const renderModalTexto = (modal, titulo, rotuloBotao, placeholder, onOk) => !modal.aberto ? '' : $h`
    <div class="mz-modal">
      <div class="mz-modal-card">
        <div class="mz-modal-head">
          <h3>${titulo}</h3>
          <a class="mz-modal-x" @click=${() => { modal.aberto = false; $update(); }}>
            <i class="f7-icons">xmark_circle_fill</i>
          </a>
        </div>
        <form class="mz-form" @submit=${onOk}>
          <div>
            <label class="field-label">Motivo</label>
            <div class="field-input">
              <i class="f7-icons">chat_bubble_text</i>
              <textarea rows="3" placeholder=${placeholder}
                @input=${(e) => { modal.motivo = e.target.value; }}>${modal.motivo}</textarea>
            </div>
          </div>
          <button class="btn btn-primary" type="submit">${rotuloBotao}</button>
        </form>
      </div>
    </div>
  `;

  const renderModalAjuste = () => !ajuste.aberto ? '' : $h`
    <div class="mz-modal">
      <div class="mz-modal-card">
        <div class="mz-modal-head">
          <h3>Ajustar valor do projeto</h3>
          <a class="mz-modal-x" @click=${() => { ajuste.aberto = false; $update(); }}>
            <i class="f7-icons">xmark_circle_fill</i>
          </a>
        </div>
        <p class="text-muted text-sm" style="margin:0 0 14px 0;">
          Valor atual: <b>${MT(Number(projeto.valor) || 0)}</b>. A outra parte tem de aceitar;
          aumentos saem do saldo da carteira do cliente, diminuições voltam para ele.
        </p>
        <form class="mz-form" @submit=${proporAjuste}>
          <div>
            <label class="field-label">Novo valor (MT)</label>
            <div class="field-input">
              <i class="f7-icons">money_dollar_circle</i>
              <input type="number" min="1" placeholder="Ex.: 2500"
                value=${ajuste.valor} @input=${(e) => { ajuste.valor = e.target.value; }} />
            </div>
          </div>
          <div>
            <label class="field-label">Motivo (opcional)</label>
            <div class="field-input">
              <i class="f7-icons">chat_bubble_text</i>
              <input type="text" placeholder="Ex.: trabalho extra na página de contato"
                value=${ajuste.motivo} @input=${(e) => { ajuste.motivo = e.target.value; }} />
            </div>
          </div>
          <button class="btn btn-primary" type="submit">Propor ajuste 🤝</button>
        </form>
      </div>
    </div>
  `;

  return () => $h`
    <div class="page page-chat">
      ${navbar($h, {
        titulo: outro.nome,
        voltar: true,
        direita: projetoId && projeto ? $h`
          <a class="link" @click=${() => ir(`/projects/${projetoId}`)}>
            <i class="f7-icons">doc_text_fill</i>
          </a>
        ` : null,
      })}
      <div class="page-content msg-scroll">

        ${carregando ? $h`
          <div class="mz-container">${skeletonLista($h, 4)}</div>
        ` : erro ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${errorState($h, { mensagem: erro, onRetry: () => carregar() })}
          </div>
        ` : mensagens.length === 0 && !projetoId ? $h`
          ${emptyState($h, {
            icone: 'chat_bubble_fill',
            titulo: 'Ainda não há mensagens',
            texto: 'Diga olá! 👋 Envie a primeira mensagem e comece a combinar os detalhes.',
          })}
        ` : $h`
          <div class="mz-container">
            ${renderBarraProjeto()}
            ${mensagens.length === 0 && projetoId ? $h`
              <div class="text-muted text-sm" style="text-align:center; padding:18px 0;">
                ${ehCliente() ? 'Pague o projeto e converse com o freelancer.' : 'Aguarda o pagamento do cliente.'}
              </div>
            ` : ''}
            ${renderMensagens()}
          </div>
        `}
      </div>

      <!-- Barra de envio fixa -->
      <form class="msg-input-bar" @submit=${enviar}>
        <input type="text" placeholder="Escreva uma mensagem…"
          value=${texto} @input=${(e) => { texto = e.target.value; }} />
        <button class="msg-send" type="submit" disabled=${enviando}>
          <i class="f7-icons">paperplane_fill</i>
        </button>
      </form>

      ${renderModalPagar()}
      ${renderModalEntregar()}
      ${renderModalAjuste()}
      ${renderModalTexto(revisao, 'Pedir revisão', 'Pedir revisão 🔁',
        'O que precisa de ser corrigido?', pedirRevisao)}
      ${renderModalTexto(disputa, 'Abrir disputa', 'Abrir disputa ⚖️',
        'Explique o problema para o administrador decidir', abrirDisputa)}
      ${renderModalTexto(cancelar, 'Cancelar projeto', 'Pedir cancelamento 🚫',
        'Motivo do cancelamento', pedirCancelamento)}
    </div>
  `;
}
