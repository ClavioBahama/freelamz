/* FreelaMZ — Meus projetos (cliente e freelancer) */
import { api } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import {
  navbar, renderAvatar, statusBadge, skeletonLista, emptyState, errorState, renderButton,
} from '../js/layout.js';
import { formatarMoeda, formatarData } from '../js/utils.js';

const FILTROS = [
  { id: '', rotulo: 'Todos' },
  { id: 'PENDENTE', rotulo: 'Pendentes' },
  { id: 'EM_ANDAMENTO', rotulo: 'Em andamento' },
  { id: 'ENTREGUE', rotulo: 'Entregues' },
  { id: 'CONCLUIDO', rotulo: 'Concluídos' },
  { id: 'CANCELADO', rotulo: 'Cancelados' },
];

export default function projects(props, { $h, $onMounted, $f7router, $update }) {
  let carregando = true;
  let erro = null;
  let projetos = [];
  let filtro = '';

  const ir = (path) => $f7router.navigate(path);
  const souFreelancer = ((loadAuth().user || {}).tipo_usuario) === 'FREELANCER';

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const res = await api.get('/projects');
      projetos = res.projects || [];
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  // ATENÇÃO: visiveis é recalculado dentro do render (a cada $update),
  // senão ficaria preso no array vazio da montagem
  const visiveis = () => (filtro ? projetos.filter((p) => p.status === filtro) : projetos);

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Meus projetos' })}
      <div class="page-content">
        <div class="mz-container">

          ${!souFreelancer ? renderButton($h, {
            icone: 'plus_circle', rotulo: 'Criar novo projeto', variante: 'primary', bloco: true,
            onClick: () => ir('/projects/create'),
          }) : ''}

          <div class="filter-bar">
            ${FILTROS.map((f) => $h`
              <button class="filter-pill ${filtro === f.id ? 'active' : ''}"
                @click=${() => { filtro = f.id; $update(); }}>${f.rotulo}</button>
            `)}
          </div>

          ${carregando ? skeletonLista($h, 5)
          : erro ? errorState($h, { mensagem: erro, onRetry: carregar })
          : visiveis().length === 0 ? $h`
            ${emptyState($h, {
              icone: 'doc_text',
              titulo: filtro ? 'Nada por aqui' : 'Sem projetos ainda',
              texto: filtro
                ? 'Não há projetos com este estado.'
                : souFreelancer
                  ? 'Quando clientes criarem projetos para si, eles aparecem aqui.'
                  : 'Crie um projeto para contratar um freelancer.',
              acao: filtro ? 'Ver todos' : (souFreelancer ? 'Ver serviços' : 'Criar projeto'),
              onAcao: () => (filtro ? (filtro = '', $update()) : ir(souFreelancer ? '/services' : '/projects/create')),
            })}
          ` : $h`
            <div class="mz-list-card">
              ${visiveis().map((p) => $h`
                <a class="mz-list-item" @click=${() => ir(`/projects/${p.id}`)}>
                  ${renderAvatar($h, souFreelancer
                    ? { nome: p.cliente_nome, foto: p.cliente_foto }
                    : { nome: p.freelancer_nome, foto: p.freelancer_foto }, 'avatar-sm')}
                  <div class="mz-list-main">
                    <div class="mz-list-title">${p.servico_titulo || p.titulo || ('Projeto #' + p.id)}</div>
                    <div class="mz-list-sub">
                      ${souFreelancer ? 'Cliente: ' + p.cliente_nome : 'Freelancer: ' + p.freelancer_nome}
                      · ${formatarMoeda(p.valor)} · ${formatarData(p.created_at)}
                    </div>
                  </div>
                  ${statusBadge($h, p.status)}
                </a>
              `)}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
