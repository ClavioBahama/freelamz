/* FreelaMZ — Lista de conversas */
import { api } from '../js/api.js';
import {
  navbar, renderAvatar, skeletonLista, emptyState, errorState,
} from '../js/layout.js';
import { formatarHora } from '../js/utils.js';

export default function messages(props, { $h, $onMounted, $f7router, $update }) {
  let carregando = true;
  let erro = null;
  let conversas = [];

  const ir = (path) => $f7router.navigate(path);

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const res = await api.get('/messages/conversations');
      conversas = res.conversas || [];
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Mensagens' })}
      <div class="page-content">
        <div class="mz-container">

          ${carregando ? skeletonLista($h, 5)
          : erro ? errorState($h, { mensagem: erro, onRetry: carregar })
          : conversas.length === 0 ? $h`
            ${emptyState($h, {
              icone: 'chat_bubble_fill',
              titulo: 'Sem conversas ainda',
              texto: 'Converse com freelancers e clientes para combinar projetos, prazos e preços.',
              acao: 'Encontrar pessoas',
              onAcao: () => ir('/freelancers'),
            })}
          ` : $h`
            <div class="mz-list-card">
              ${conversas.map((c) => $h`
                <a class="mz-list-item" @click=${() => ir(`/messages/${c.outro_id}`)}>
                  ${renderAvatar($h, c, 'avatar-sm')}
                  <div class="mz-list-main">
                    <div class="mz-list-title">${c.outro_nome}</div>
                    <div class="mz-list-sub" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                      ${c.remetente_id === (window.freelaMZ.usuario || {}).id ? 'Você: ' : ''}${c.texto}
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div class="mz-list-sub">${formatarHora(c.created_at)}</div>
                    ${c.nao_lidas > 0 ? $h`
                      <span class="mz-badge badge-aceita" style="margin-top:4px;">${c.nao_lidas} nova${c.nao_lidas > 1 ? 's' : ''}</span>
                    ` : ''}
                  </div>
                </a>
              `)}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
