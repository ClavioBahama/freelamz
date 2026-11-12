/* ============================================================
   FreelaMZ — Detalhe do projeto: dados, propostas, linha do
   tempo (FASE A) e avaliação. As mudanças manuais de estado
   foram substituídas pelo fluxo financeiro no chat do projeto:
   ?projeto=ID na conversa ativa a barra de estado e ações.
   ============================================================ */
import { api } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import {
  navbar, renderAvatar, statusBadge, toast, skeletonLista, emptyState, errorState, renderButton,
} from '../js/layout.js';
import { formatarMoeda, formatarData, formatarHora } from '../js/utils.js';

const CENTAVOS = (v) => formatarMoeda((Number(v) || 0) / 100);

export default function projectDetalhe(props, { $h, $onMounted, $f7route, $f7router, $update }) {
  const id = $f7route.params.id;
  let carregando = true;
  let erro = null;
  let projeto = null;
  let escrow = null;
  let meuPapel = null;
  let propostas = [];
  let entregas = [];
  let avaliado = false;

  // Estado do formulário de proposta
  let propPreco = '';
  let propPrazo = '';
  let propMsg = '';

  const ir = (path) => $f7router.navigate(path);

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const res = await api.get(`/projects/${id}`);
      projeto = res.project;
      escrow = res.escrow;
      meuPapel = res.meu_papel;
      const [resP, resD] = await Promise.all([
        api.get(`/proposals/projeto/${id}`).catch(() => ({ proposals: [] })),
        api.get(`/projects/${id}/deliveries`).catch(() => ({ deliveries: [] })),
      ]);
      propostas = resP.proposals || [];
      entregas = resD.deliveries || [];
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  const eu = loadAuth().user || {};
  const souCliente = () => projeto && projeto.cliente_id === eu.id;
  const souFreelancer = () => projeto && projeto.freelancer_id === eu.id;
  const souParticipante = () => souCliente() || souFreelancer();
  const chatPath = () => `/messages/${souCliente() ? projeto.freelancer_id : projeto.cliente_id}?projeto=${projeto.id}`;
  const valorRetido = () => escrow && Number(escrow.amount_held) > 0
    && ['RETIDO', 'EM_DISPUTA'].includes(escrow.status);

  /* Cancelar direto só sem valor retido (com dinheiro → acordo no chat) */
  const cancelarDireto = async () => {
    try {
      const res = await api.put(`/projects/${id}/status`, { status: 'CANCELADO' });
      projeto = res.project;
      toast('Projeto cancelado.', 'success');
      $update();
    } catch (e) {
      toast(e.message || 'Erro ao cancelar', 'error');
    }
  };

  const aceitarProposta = async (proposta) => {
    try {
      await api.put(`/proposals/${proposta.id}/status`, { status: 'ACEITA' });
      toast('Proposta aceita! O projeto aguarda o pagamento do cliente. 🎉', 'success');
      await carregar();
    } catch (e) {
      toast(e.message || 'Erro ao aceitar proposta', 'error');
    }
  };

  const recusarProposta = async (proposta) => {
    try {
      await api.put(`/proposals/${proposta.id}/status`, { status: 'RECUSADA' });
      toast('Proposta recusada.');
      await carregar();
    } catch (e) {
      toast(e.message || 'Erro ao recusar', 'error');
    }
  };

  const avaliar = async (nota) => {
    const avaliadoId = souCliente() ? projeto.freelancer_id : projeto.cliente_id;
    try {
      await api.post('/reviews', {
        projeto_id: projeto.id,
        avaliado_id: avaliadoId,
        nota,
        comentario: '',
      });
      avaliado = true;
      toast('Avaliação enviada. Obrigado! ⭐', 'success');
      $update();
    } catch (e) {
      toast(e.message || 'Erro ao avaliar', 'error');
    }
  };

  /* ---------- linha do tempo ---------- */
  const timeline = () => {
    const itens = [];
    itens.push({ ic: 'doc_text', rot: 'Projeto criado', sub: formatarData(projeto.created_at), on: true });
    if (escrow && escrow.paid_at) {
      itens.push({
        ic: 'creditcard_fill', rot: 'Pago e retido (escrow)', on: true,
        sub: `${formatarHora(escrow.paid_at)} · ${CENTAVOS(escrow.amount_held)} retido com segurança`,
      });
    }
    (entregas || []).forEach((d) => {
      itens.push({
        ic: 'tray_full', rot: `Entrega #${d.numero}`, on: true,
        sub: `${formatarHora(d.created_at)} · ${(d.arquivos || []).length} ficheiro(s)`
          + `${d.links && d.links.length ? ` · ${d.links.length} link(s)` : ''}`,
      });
    });
    if (projeto.revisions_count) {
      itens.push({ ic: 'arrow_2_squarepath', rot: 'Revisões pedidas', on: true, sub: `${projeto.revisions_count} revisão(ões)` });
    }
    if (projeto.client_approved_at) {
      itens.push({ ic: 'checkmark_circle', rot: 'Cliente aprovou a entrega', on: true, sub: formatarHora(projeto.client_approved_at) });
    }
    if (projeto.freelancer_approved_at) {
      itens.push({ ic: 'checkmark_seal', rot: 'Freelancer confirmou conclusão e valor', on: true, sub: formatarHora(projeto.freelancer_approved_at) });
    }
    if (escrow && escrow.released_at) {
      itens.push({
        ic: 'lock_open_fill', rot: 'Pagamento liberado ao freelancer', on: true,
        sub: `${formatarHora(escrow.released_at)} · líquido ${CENTAVOS(Number(escrow.amount_held) - Number(escrow.platform_fee))}`,
      });
    }
    if (escrow && escrow.refunded_at) {
      itens.push({
        ic: 'arrow_uturn_left', rot: 'Valor reembolsado ao cliente', on: true,
        sub: `${formatarHora(escrow.refunded_at)} · ${CENTAVOS(escrow.amount_held)}`,
      });
    }
    if (escrow && escrow.status === 'EM_DISPUTA') {
      itens.push({
        ic: 'scale_3d', rot: 'Disputa em análise', on: true,
        sub: escrow.dispute_reason || 'Administrador a decidir',
      });
    }
    if (projeto.status === 'CANCELADO') {
      itens.push({ ic: 'xmark_circle', rot: 'Projeto cancelado', on: true, sub: formatarData(projeto.updated_at) });
    }
    return itens;
  };

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Projeto', voltar: true })}
      <div class="page-content">

        ${carregando ? $h`
          <div class="mz-container">
            <div class="skeleton" style="height:210px; border-radius:26px;"></div>
            ${skeletonLista($h, 3)}
          </div>
        ` : erro ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${errorState($h, { mensagem: erro, onRetry: carregar })}
          </div>
        ` : !projeto ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${emptyState($h, { icone: 'doc_text', titulo: 'Projeto não encontrado' })}
          </div>
        ` : $h`
          <div>
            <!-- Cabeçalho -->
            <div class="detail-hero">
              <div class="detail-row">
                ${renderAvatar($h, souCliente()
                  ? { nome: projeto.freelancer_nome, foto: projeto.freelancer_foto }
                  : { nome: projeto.cliente_nome, foto: projeto.cliente_foto }, 'avatar-lg')}
                <div>
                  <div class="detail-title" style="margin-top:0;">${projeto.servico_titulo || ('Projeto #' + projeto.id)}</div>
                  <div class="detail-sub">
                    ${souCliente()
                      ? $h`Freelancer: <a style="text-decoration:underline;" @click=${() => ir(`/freelancers/${projeto.freelancer_id}`)}>${projeto.freelancer_nome}</a>`
                      : $h`Cliente: <a style="text-decoration:underline;" @click=${() => ir(`/clientes/${projeto.cliente_id}`)}>${projeto.cliente_nome}</a>`}
                  </div>
                  <div style="margin-top:10px;">${statusBadge($h, projeto.status)}</div>
                </div>
              </div>
              <div class="detail-actions">
                <div class="price-tag"><b>${formatarMoeda(projeto.valor)}</b><span>valor combinado</span></div>
                <div class="price-tag"><b>${projeto.prazo}</b><span>prazo</span></div>
                <div class="price-tag"><b>${formatarData(projeto.created_at)}</b><span>criado em</span></div>
              </div>

              <!-- Pagamento / escrow (FASE A) -->
              ${escrow && souParticipante() ? $h`
                <div class="escrow-strip">
                  <i class="f7-icons">${escrow.status === 'LIBERADO' ? 'lock_open_fill' : 'lock_fill'}</i>
                  <div>
                    <b>${CENTAVOS(escrow.amount_held)}</b> em escrow ·
                    comissão ${CENTAVOS(escrow.platform_fee)} ·
                    ${statusBadge($h, escrow.status)}
                  </div>
                </div>
              ` : projeto.status === 'AGUARDANDO_PAGAMENTO' ? $h`
                <div class="escrow-strip escrow-pendente">
                  <i class="f7-icons">creditcard</i>
                  <div>Aguarda pagamento — o valor será retido em segurança até a entrega ser aprovada pelos dois lados.</div>
                </div>
              ` : ''}

              <div class="detail-actions">
                ${souParticipante() && projeto.status !== 'CONCLUIDO' && projeto.status !== 'CANCELADO' ? $h`
                  ${renderButton($h, {
                    icone: 'chat_bubble_fill',
                    rotulo: projeto.status === 'AGUARDANDO_PAGAMENTO' && souCliente() ? 'Pagar no chat'
                      : projeto.status === 'ENTREGUE' && souCliente() ? 'Responder à entrega'
                      : projeto.status === 'EM_ANDAMENTO' && souFreelancer() ? 'Entregar no chat'
                      : 'Abrir chat do projeto',
                    variante: 'primary', tamanho: 'sm',
                    onClick: () => ir(chatPath()),
                  })}
                ` : ''}
                ${!souParticipante() ? $h`
                  ${renderButton($h, {
                    icone: 'chat_bubble_fill', rotulo: 'Conversar', variante: 'white', tamanho: 'sm',
                    onClick: () => ir(`/messages/${projeto.cliente_id === eu.id ? projeto.freelancer_id : projeto.cliente_id}`),
                  })}
                ` : ''}
                ${souParticipante() && ['PENDENTE', 'AGUARDANDO_PAGAMENTO', 'EM_ANDAMENTO'].includes(projeto.status) ? $h`
                  ${valorRetido() ? $h`
                    <span class="text-muted text-sm" style="align-self:center;">
                      Cancelamento com valor retido: acordo dos dois no chat 🚫
                    </span>
                  ` : $h`
                    ${renderButton($h, {
                      icone: 'xmark_circle', rotulo: 'Cancelar', variante: 'danger', tamanho: 'sm',
                      onClick: cancelarDireto,
                    })}
                  `}
                ` : ''}
                ${projeto.status === 'CONCLUIDO' ? $h`
                  <span class="mz-badge badge-concluido">✔ Concluído e pago</span>
                ` : ''}
              </div>
            </div>

            <div class="mz-container">
              <!-- Linha do tempo -->
              ${souParticipante() ? $h`
                <div class="section-title">Linha do tempo</div>
                <div class="mz-card" style="padding:16px 18px;">
                  <div class="timeline">
                    ${timeline().map((t) => $h`
                      <div class="tl-item ${t.on ? 'on' : ''}">
                        <span class="tl-dot"><i class="f7-icons">${t.ic}</i></span>
                        <div class="tl-main">
                          <div class="tl-rot">${t.rot}</div>
                          <div class="tl-sub">${t.sub}</div>
                        </div>
                      </div>
                    `)}
                  </div>
                </div>
              ` : ''}

              <!-- Descrição -->
              <div class="section-title">Detalhes</div>
              <div class="mz-card">
                <p style="margin:0; font-size:14px; line-height:1.65; white-space:pre-line;">
                  ${projeto.servico_descricao || 'Sem descrição do serviço associado.'}
                </p>
              </div>

              <!-- Avaliação (após conclusão) -->
              ${projeto.status === 'CONCLUIDO' && !avaliado ? $h`
                <div class="section-title">Avaliar ${souCliente() ? 'o freelancer' : 'o cliente'}</div>
                <div class="mz-card" style="text-align:center;">
                  <p class="text-muted text-sm" style="margin:0 0 12px 0;">
                    Como foi trabalhar neste projeto? Deixe a sua nota:
                  </p>
                  <div class="flex" style="justify-content:center; gap:10px;">
                    ${[1, 2, 3, 4, 5].map((n) => $h`
                      <a style="font-size:34px; text-decoration:none; cursor:pointer; color:#FBBF24;"
                        @click=${() => avaliar(n)}>★</a>
                    `)}
                  </div>
                </div>
              ` : ''}
              ${avaliado ? $h`
                <div class="mz-badge badge-aceita" style="display:flex; justify-content:center; padding:12px;">
                  ✔ Avaliação enviada — obrigado!
                </div>
              ` : ''}

              <!-- Propostas recebidas (apenas o cliente vê) -->
              ${souCliente() ? $h`
                <div class="section-title">Propostas recebidas (${propostas.length})</div>
                ${propostas.length === 0 ? $h`
                  ${emptyState($h, {
                    icone: 'paperplane',
                    titulo: 'Sem propostas ainda',
                    texto: 'Freelancers convidados ainda não enviaram propostas para este projeto.',
                  })}
                ` : $h`
                  <div class="mz-list-card">
                    ${propostas.map((p) => $h`
                      <div class="mz-list-item">
                        ${renderAvatar($h, p, 'avatar-sm')}
                        <div class="mz-list-main">
                          <div class="mz-list-title">${p.freelancer_nome}</div>
                          <div class="mz-list-sub">
                            ${formatarMoeda(p.preco)} · prazo ${p.prazo} · ${formatarData(p.created_at)}
                          </div>
                          ${p.mensagem ? $h`<div class="mz-list-sub" style="margin-top:4px; white-space:pre-line;">${p.mensagem}</div>` : ''}
                          <div style="margin-top:8px; display:flex; gap:8px;">
                            ${p.status === 'PENDENTE' ? $h`
                              <a class="btn btn-green btn-sm" style="text-decoration:none;" @click=${() => aceitarProposta(p)}>Aceitar</a>
                              <a class="btn btn-ghost btn-sm" style="text-decoration:none; color:#ef4444;" @click=${() => recusarProposta(p)}>Recusar</a>
                            ` : statusBadge($h, p.status)}
                          </div>
                        </div>
                      </div>
                    `)}
                  </div>
                `}
              ` : ''}

              <!-- Enviar proposta (freelancer do projeto, ainda sem proposta) -->
              ${souFreelancer() && !propostas.some((p) => p.freelancer_id === eu.id) && projeto.status === 'PENDENTE' ? $h`
                <div class="section-title">Enviar proposta</div>
                <div class="mz-card" style="padding:20px;">
                  <form class="mz-form" @submit=${async (e) => {
                    e.preventDefault();
                    try {
                      await api.post('/proposals', {
                        projeto_id: projeto.id,
                        preco: Number(propPreco),
                        prazo: propPrazo,
                        mensagem: propMsg,
                      });
                      toast('Proposta enviada! 🚀', 'success');
                      carregar();
                    } catch (err) {
                      toast(err.message || 'Erro ao enviar proposta', 'error');
                    }
                  }}>
                    <div>
                      <label class="field-label">O seu preço (MT)</label>
                      <div class="field-input">
                        <i class="f7-icons">money_dollar_circle</i>
                        <input type="number" min="0" placeholder="Ex.: 5000"
                          @input=${(ev) => { propPreco = ev.target.value; }} />
                      </div>
                    </div>
                    <div>
                      <label class="field-label">Prazo</label>
                      <div class="field-input">
                        <i class="f7-icons">clock</i>
                        <input type="text" placeholder="Ex.: 7 dias"
                          @input=${(ev) => { propPrazo = ev.target.value; }} />
                      </div>
                    </div>
                    <div>
                      <label class="field-label">Mensagem</label>
                      <div class="field-input">
                        <i class="f7-icons">chat_bubble_text</i>
                        <textarea placeholder="Explique a sua abordagem para este projeto…"
                          @input=${(ev) => { propMsg = ev.target.value; }}></textarea>
                      </div>
                    </div>
                    <button class="btn btn-primary" type="submit" style="padding:13px 22px;">
                      Enviar proposta
                    </button>
                  </form>
                </div>
              ` : ''}
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}
