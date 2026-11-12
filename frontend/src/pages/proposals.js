/* FreelaMZ — Propostas (enviadas pelo freelancer / recebidas pelo cliente) */
import { api } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import {
  navbar, renderAvatar, statusBadge, toast, skeletonLista, emptyState, errorState,
} from '../js/layout.js';
import { formatarMoeda, formatarData } from '../js/utils.js';

export default function proposals(props, { $h, $onMounted, $f7router, $update }) {
  let carregando = true;
  let erro = null;
  let propostas = [];
  let filtro = '';

  const ir = (path) => $f7router.navigate(path);
  const eu = loadAuth().user || {};
  const souFreelancer = eu.tipo_usuario === 'FREELANCER';

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const res = await api.get(souFreelancer ? '/proposals/me/freelancer' : '/proposals/me/cliente');
      propostas = res.proposals || [];
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  const responder = async (id, status) => {
    try {
      await api.put(`/proposals/${id}/status`, { status });
      toast(status === 'ACEITA' ? 'Proposta aceita! Projeto criado 🎉' : 'Proposta recusada.', status === 'ACEITA' ? 'success' : '');
      carregar();
    } catch (e) {
      toast(e.message || 'Erro ao responder proposta', 'error');
    }
  };

  const FILTROS = ['TODAS', 'PENDENTE', 'ACEITA', 'RECUSADA'];
  // Recalculado dentro do render para refletir propostas carregadas
  const visiveis = () => (filtro && filtro !== 'TODAS' ? propostas.filter((p) => p.status === filtro) : propostas);

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Propostas' })}
      <div class="page-content">
        <div class="mz-container">

          <div class="filter-bar">
            ${FILTROS.map((f) => $h`
              <button class="filter-pill ${(filtro || 'TODAS') === f ? 'active' : ''}"
                @click=${() => { filtro = f; $update(); }}>
                ${f === 'TODAS' ? 'Todas' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            `)}
          </div>

          ${carregando ? skeletonLista($h, 4)
          : erro ? errorState($h, { mensagem: erro, onRetry: carregar })
          : visiveis().length === 0 ? $h`
            ${emptyState($h, {
              icone: 'paperplane',
              titulo: 'Sem propostas',
              texto: souFreelancer
                ? 'Envie propostas a projetos dos clientes — elas aparecem aqui com o estado.'
                : 'Quando freelancers enviarem propostas aos seus projetos, elas chegam aqui.',
              acao: souFreelancer ? 'Ver projetos' : 'Ver freelancers',
              onAcao: () => ir(souFreelancer ? '/projects' : '/freelancers'),
            })}
          ` : $h`
            <div class="mz-list-card">
              ${visiveis().map((p) => $h`
                <div class="mz-list-item">
                  ${renderAvatar($h, souFreelancer
                    ? { nome: p.cliente_nome, foto: p.cliente_foto }
                    : { nome: p.freelancer_nome, foto: p.freelancer_foto }, 'avatar-sm')}
                  <div class="mz-list-main">
                    <div class="mz-list-title">${p.projeto_titulo || ('Proposta #' + p.id)}</div>
                    <div class="mz-list-sub">
                      ${souFreelancer
                        ? $h`Para: <a style="text-decoration:underline;" @click=${(e) => { e.stopPropagation(); ir(`/clientes/${p.cliente_id}`); }}>${p.cliente_nome}</a>`
                        : $h`De: <a style="text-decoration:underline;" @click=${(e) => { e.stopPropagation(); ir(`/freelancers/${p.freelancer_id}`); }}>${p.freelancer_nome}</a>`}
                      · ${formatarMoeda(p.preco)} · prazo ${p.prazo}
                    </div>
                    ${p.mensagem ? $h`<div class="mz-list-sub" style="margin-top:4px; white-space:pre-line;">${p.mensagem}</div>` : ''}
                    <div class="mz-list-sub">${formatarData(p.created_at)}</div>
                    <div style="margin-top:8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                      ${statusBadge($h, p.status)}
                      ${!souFreelancer && p.status === 'PENDENTE' ? $h`
                        <a class="btn btn-green btn-sm" style="text-decoration:none;" @click=${() => responder(p.id, 'ACEITA')}>Aceitar</a>
                        <a class="btn btn-ghost btn-sm" style="text-decoration:none; color:#ef4444;" @click=${() => responder(p.id, 'RECUSADA')}>Recusar</a>
                      ` : ''}
                      ${souFreelancer && p.status === 'ACEITA' ? $h`
                        <a class="btn btn-primary btn-sm" style="text-decoration:none;" @click=${() => ir('/projects')}>Ver projeto →</a>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `)}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
