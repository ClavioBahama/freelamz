/* FreelaMZ — Notificações */
import { api } from '../js/api.js';
import {
  navbar, skeletonLista, emptyState, errorState, toast, atualizarBadges,
} from '../js/layout.js';
import { formatarHora } from '../js/utils.js';

const ICONES = {
  nova_mensagem: ['chat_bubble_fill', 'var(--grad-primary)'],
  nova_proposta: ['paperplane_fill', 'var(--grad-coral)'],
  proposta_aceita: ['checkmark_seal_fill', 'var(--grad-green)'],
  novo_projeto: ['doc_text_fill', 'var(--grad-green)'],
  projeto_atualizado: ['arrow_2_circlepath', 'var(--grad-primary)'],
  nova_avaliacao: ['star_fill', 'var(--grad-amber)'],
  boas_vindas: ['hand_wave_fill', 'var(--grad-primary)'],
};

export default function notifications(props, { $h, $onMounted, $update }) {
  let carregando = true;
  let erro = null;
  let notificacoes = [];

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const res = await api.get('/notifications');
      notificacoes = res.notifications || [];
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  const marcarTodas = async () => {
    try {
      await api.put('/notifications/read-all');
      notificacoes = notificacoes.map((n) => ({ ...n, lida: 1 }));
      atualizarBadges();
      toast('Todas marcadas como lidas ✅', 'success');
      $update();
    } catch (e) {
      toast(e.message || 'Erro', 'error');
    }
  };

  const marcarUma = async (n) => {
    if (n.lida) return;
    try {
      await api.put(`/notifications/${n.id}/read`);
      n.lida = 1;
      atualizarBadges();
      $update();
    } catch (e) { /* silencioso */ }
  };

  // Recalculado no render para refletir notificações carregadas
  const naoLidas = () => notificacoes.filter((n) => !n.lida).length;

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Notificações' })}
      <div class="page-content">
        <div class="mz-container">

          ${naoLidas() > 0 ? $h`
            <a class="btn btn-primary btn-block" style="margin-bottom:14px; text-decoration:none;" @click=${marcarTodas}>
              Marcar todas como lidas (${naoLidas()})
            </a>
          ` : ''}

          ${carregando ? skeletonLista($h, 5)
          : erro ? errorState($h, { mensagem: erro, onRetry: carregar })
          : notificacoes.length === 0 ? $h`
            ${emptyState($h, {
              icone: 'bell',
              titulo: 'Sem notificações',
              texto: 'Propostas, mensagens e atualizações de projetos aparecem aqui.',
            })}
          ` : $h`
            <div class="mz-list-card">
              ${notificacoes.map((n) => $h`
                <div class="notif-item ${n.lida ? '' : 'nova'}" @click=${() => marcarUma(n)}>
                  <div class="notif-icon-box" style="background:${(ICONES[n.tipo] || ['bell_fill', 'var(--grad-primary)'])[1]}">
                    <i class="f7-icons">${(ICONES[n.tipo] || ['bell_fill'])[0]}</i>
                  </div>
                  <div style="flex:1; min-width:0;">
                    <div class="mz-list-title" style="font-size:14px;">${n.titulo}</div>
                    <div class="mz-list-sub" style="white-space:pre-line; line-height:1.45;">${n.mensagem}</div>
                    <div class="mz-list-sub" style="margin-top:3px; opacity:0.7;">${formatarHora(n.created_at)}</div>
                  </div>
                  ${n.lida ? '' : $h`<span style="width:9px; height:9px; border-radius:50%; background:#2563EB; flex-shrink:0;"></span>`}
                </div>
              `)}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
