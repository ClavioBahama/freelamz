/* FreelaMZ — Detalhe do serviço: descrição, freelancer, ações */
import { api, assetUrl } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import {
  navbar, renderAvatar, stars, toast, skeletonCards, emptyState, errorState, renderButton,
} from '../js/layout.js';
import { formatarMoeda, formatarData } from '../js/utils.js';

export default function serviceDetalhe(props, { $h, $onMounted, $f7route, $f7router, $update }) {
  const id = $f7route.params.id;
  let carregando = true;
  let erro = null;
  let servico = null;
  let favorito = false;
  let avaliacoes = { media: 0, total: 0 };

  const ir = (path) => $f7router.navigate(path);

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const res = await api.get(`/services/${id}`);
      servico = res.service;
      if (servico && servico.freelancer_id) {
        const [resRate, resFav] = await Promise.all([
          api.get(`/reviews/rating/${servico.freelancer_id}`).catch(() => ({ rating: { media: 0, total: 0 } })),
          api.get(`/favorites/is-favorite?tipo=servico&alvo_id=${id}`).catch(() => ({ favorito: false })),
        ]);
        avaliacoes = resRate.rating || { media: 0, total: 0 };
        favorito = !!resFav.favorito;
      }
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  const alternarFav = async () => {
    try {
      if (favorito) {
        await api.delete('/favorites', { tipo: 'servico', alvo_id: Number(id) });
        favorito = false;
        toast('Removido dos favoritos');
      } else {
        await api.post('/favorites', { tipo: 'servico', alvo_id: Number(id) });
        favorito = true;
        toast('Adicionado aos favoritos ❤️', 'success');
      }
      $update();
    } catch (e) {
      toast(e.message || 'Erro ao favoritar', 'error');
    }
  };

  const eu = loadAuth().user || {};

  const apagarServico = async () => {
    if (!window.confirm('Apagar este serviço? Esta ação não pode ser desfeita.')) return;
    try {
      await api.delete(`/services/${id}`);
      toast('Serviço apagado 🗑️', 'success');
      $f7router.navigate('/services');
    } catch (e) {
      toast(e.message || 'Não foi possível apagar', 'error');
    }
  };

  return () => {
    // recalculado a cada render (servico chega depois do fetch)
    const souCliente = eu.tipo_usuario === 'CLIENTE';
    const ehMeu = !!servico && Number(eu.id) === Number(servico.freelancer_id);
    return $h`
    <div class="page">
      ${navbar($h, { titulo: 'Serviço', voltar: true })}
      <div class="page-content">

        ${carregando ? $h`
          <div class="mz-container">
            <div class="skeleton" style="height:210px; border-radius:26px;"></div>
            ${skeletonCards($h, 2)}
          </div>
        ` : erro ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${errorState($h, { mensagem: erro, onRetry: carregar })}
          </div>
        ` : !servico ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${emptyState($h, { icone: 'briefcase', titulo: 'Serviço não encontrado' })}
          </div>
        ` : $h`
          <div>
            <!-- Cabeçalho -->
            <div class="detail-hero">
              <div class="detail-row">
                <div class="svc-icon" style="width:58px; height:58px; border-radius:18px; background:rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center; font-size:28px; color:#fff;">
                  <i class="f7-icons">${servico.categoria_icone || 'briefcase'}</i>
                </div>
                <div>
                  <span class="mz-badge" style="background:rgba(255,255,255,0.2); color:#fff;">${servico.categoria_nome}</span>
                  <div class="detail-title" style="margin-top:8px; font-size:20px;">${servico.titulo}</div>
                </div>
              </div>
              <div class="detail-actions">
                <div class="price-tag">
                  <b>${formatarMoeda(servico.preco)}</b>
                  <span>preço fixo</span>
                </div>
                <div class="price-tag">
                  <b>${servico.prazo_entrega}</b>
                  <span>prazo de entrega</span>
                </div>
                <div class="price-tag">
                  <b>${avaliacoes.media || '0.0'}★</b>
                  <span>${avaliacoes.total || 0} avaliações</span>
                </div>
              </div>
              <div class="detail-actions">
                ${souCliente ? $h`
                  ${renderButton($h, {
                    icone: 'plus_circle', rotulo: 'Contratar este serviço', variante: 'primary', tamanho: 'sm',
                    onClick: () => ir(`/projects/create?servico=${servico.id}&freelancer=${servico.freelancer_id}`),
                  })}
                  ${renderButton($h, {
                    icone: 'chat_bubble_fill', rotulo: 'Conversar', variante: 'white', tamanho: 'sm',
                    onClick: () => ir(`/messages/${servico.freelancer_id}`),
                  })}
                  ${renderButton($h, {
                    icone: favorito ? 'heart_fill' : 'heart',
                    rotulo: favorito ? 'Favorito' : 'Favoritar',
                    variante: 'white', tamanho: 'sm', onClick: alternarFav,
                  })}
                ` : ''}
                ${ehMeu ? $h`
                  ${renderButton($h, {
                    icone: 'square_pencil', rotulo: 'Editar serviço', variante: 'primary', tamanho: 'sm',
                    onClick: () => ir(`/services/edit/${servico.id}`),
                  })}
                  ${renderButton($h, {
                    icone: 'trash', rotulo: 'Apagar serviço', variante: 'danger', tamanho: 'sm',
                    onClick: apagarServico,
                  })}
                ` : ''}
              </div>
            </div>

            <div class="mz-container">
              <!-- Descrição -->
              <div class="section-title">Descrição do serviço</div>
              <div class="mz-card">
                <p style="margin:0; font-size:14px; line-height:1.65; color:var(--mz-text); white-space:pre-line;">
                  ${servico.descricao || 'Sem descrição.'}
                </p>
                ${servico.imagens && servico.imagens.length ? $h`
                  <div class="mz-grid" style="margin-top:16px; grid-template-columns:repeat(3,1fr);">
                    ${(servico.imagens || []).slice(0, 6).map((img) => $h`
                      <img src=${assetUrl(img.url || img)} alt="imagem do serviço"
                        style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:14px; border:1px solid var(--mz-border);" />
                    `)}
                  </div>
                ` : ''}
                <p class="text-sm text-muted" style="margin:14px 0 0 0;">
                  Publicado em ${formatarData(servico.created_at)} · ${servico.cidade || 'Moçambique'}
                </p>
              </div>

              <!-- Freelancer -->
              <div class="section-title">Oferecido por</div>
              <div class="mz-card">
                <div class="detail-row" style="cursor:pointer;" @click=${() => ir(`/freelancers/${servico.freelancer_id}`)}>
                  ${renderAvatar($h, servico)}
                  <div style="flex:1;">
                    <div style="font-size:16px; font-weight:800; color:var(--mz-navy);">${servico.freelancer_nome}</div>
                    <div class="text-sm text-muted">Ver perfil completo →</div>
                  </div>
                  ${stars($h, avaliacoes.media, avaliacoes.total)}
                </div>
              </div>
            </div>
          </div>
        `}
      </div>
    </div>
    `;
  };
}
