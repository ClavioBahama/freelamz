/* FreelaMZ — Favoritos (freelancers e serviços) */
import { api } from '../js/api.js';
import {
  navbar, renderAvatar, stars, preco, toast, skeletonCards, emptyState, errorState,
} from '../js/layout.js';
import { formatarMoeda } from '../js/utils.js';

export default function favorites(props, { $h, $onMounted, $f7router, $update }) {
  let aba = 'freelancer';
  let carregando = true;
  let erro = null;
  let itens = [];

  const ir = (path) => $f7router.navigate(path);

  const carregar = async (novaAba) => {
    if (novaAba) aba = novaAba;
    carregando = true; erro = null; $update();
    try {
      const res = await api.get(`/favorites?tipo=${aba}`);
      itens = res.itens || [];
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(() => carregar());

  const remover = async (id) => {
    try {
      await api.delete('/favorites', { tipo: aba, alvo_id: id });
      itens = itens.filter((i) => i.id !== id);
      toast('Removido dos favoritos');
      $update();
    } catch (e) {
      toast(e.message || 'Erro ao remover', 'error');
    }
  };

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Favoritos' })}
      <div class="page-content">
        <div class="mz-container">

          <!-- Abas -->
          <div class="filter-bar">
            <button class="filter-pill ${aba === 'freelancer' ? 'active' : ''}"
              @click=${() => carregar('freelancer')}>❤️ Freelancers</button>
            <button class="filter-pill ${aba === 'servico' ? 'active' : ''}"
              @click=${() => carregar('servico')}>⭐ Serviços</button>
          </div>

          ${carregando ? skeletonCards($h, 4)
          : erro ? errorState($h, { mensagem: erro, onRetry: () => carregar() })
          : itens.length === 0 ? $h`
            ${emptyState($h, {
              icone: 'heart_fill',
              titulo: 'Nada nos favoritos',
              texto: aba === 'freelancer'
                ? 'Toque no coração num freelancer para o guardar aqui.'
                : 'Toque no coração num serviço para o guardar aqui.',
              acao: aba === 'freelancer' ? 'Ver freelancers' : 'Ver serviços',
              onAcao: () => ir(aba === 'freelancer' ? '/freelancers' : '/services'),
            })}
          ` : $h`
            <div class="mz-grid">
              ${aba === 'freelancer'
                ? itens.map((f) => $h`
                  <div class="fl-card">
                    <div class="fl-top">
                      ${renderAvatar($h, f)}
                      <div style="min-width:0; flex:1;">
                        <div class="fl-name">${f.nome}</div>
                        <div class="fl-title">${f.titulo || 'Freelancer'}</div>
                        <div class="fl-title"><i class="f7-icons" style="font-size:12px;">placemark</i> ${f.cidade || 'Moçambique'}</div>
                      </div>
                    </div>
                    <div class="fl-foot">
                      ${stars($h, f.classificacao, f.num_avaliacoes)}
                      ${Number(f.preco_por_hora) > 0
                        ? $h`<span class="fl-price">${formatarMoeda(f.preco_por_hora)}<small>/hora</small></span>`
                        : $h`<span class="fl-price">A combinar</span>`}
                    </div>
                    <div class="flex gap-2">
                      <a class="btn btn-primary btn-sm" style="flex:1; text-decoration:none;" @click=${() => ir(`/freelancers/${f.id}`)}>Ver perfil</a>
                      <a class="btn btn-ghost btn-sm" style="color:#ef4444; text-decoration:none;" @click=${() => remover(f.id)}>
                        <i class="f7-icons" style="font-size:15px;">heart_slash_fill</i>
                      </a>
                    </div>
                  </div>
                `)
                : itens.map((s) => $h`
                  <div class="service-card">
                    <div class="service-card-head">
                      <div class="svc-icon" style="background:${s.categoria_cor || '#2563EB'}">
                        <i class="f7-icons">briefcase</i>
                      </div>
                      <a class="btn-heart on" @click=${() => remover(s.id)}>
                        <i class="f7-icons">heart_fill</i>
                      </a>
                    </div>
                    <div class="service-card-body" @click=${() => ir(`/services/${s.id}`)}>
                      <div class="service-card-title">${s.titulo}</div>
                      <div class="service-card-meta"><i class="f7-icons" style="font-size:13px;">person</i> ${s.freelancer_nome}</div>
                      <div class="service-card-meta"><i class="f7-icons" style="font-size:13px;">clock</i> ${s.prazo_entrega}</div>
                      <div class="service-card-price">${preco($h, s.preco)}</div>
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
