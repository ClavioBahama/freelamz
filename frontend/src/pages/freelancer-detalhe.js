/* ============================================================
   FreelaMZ — Perfil público do freelancer (redesenhado)
   Capa + avatar sobreposto · selos · estatísticas ·
   abas: Sobre · Portfólio · Serviços · Avaliações
   ============================================================ */
import { api, assetUrl } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import {
  navbar, renderAvatar, selos, indicadorDisponibilidade, statusBadge, preco, toast,
  skeletonCards, skeletonLista, emptyState, errorState,
} from '../js/layout.js';
import { formatarMoeda, formatarData } from '../js/utils.js';

const NIVEIS = {
  iniciante: 'Iniciante', intermedio: 'Intermédio', especialista: 'Especialista',
};

export default function freelancerDetalhe(props, { $h, $onMounted, $f7route, $f7router, $update }) {
  const id = $f7route.params.id;
  let carregando = true;
  let erro = null;
  let profile = null;
  let servicos = [];
  let reviews = [];
  let favorito = false;
  let alternandoFav = false;
  let aba = 'sobre';

  /* photo browser */
  let fotos = [];
  let fotoIdx = 0;

  const ir = (path) => $f7router.navigate(path);

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const [resP, resS, resR] = await Promise.all([
        api.get(`/users/freelancers/${id}`),
        api.get(`/services?freelancer_id=${id}`),
        api.get(`/reviews/user/${id}`),
      ]);
      profile = resP.profile;
      servicos = resS.services || [];
      reviews = resR.reviews || [];
      try {
        const fav = await api.get(`/favorites/is-favorite?tipo=freelancer&alvo_id=${id}`);
        favorito = !!fav.favorito;
      } catch (e) { /* segue sem estado de favorito */ }
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  const alternarFavorito = async () => {
    if (alternandoFav) return;
    alternandoFav = true;
    try {
      if (favorito) {
        await api.delete('/favorites', { tipo: 'freelancer', alvo_id: Number(id) });
        favorito = false;
        toast('Removido dos favoritos');
      } else {
        await api.post('/favorites', { tipo: 'freelancer', alvo_id: Number(id) });
        favorito = true;
        toast('Adicionado aos favoritos ❤️', 'success');
      }
    } catch (e) {
      toast(e.message || 'Erro ao alterar favorito', 'error');
    }
    alternandoFav = false;
    $update();
  };

  const eu = loadAuth().user || {};
  const souCliente = eu.tipo_usuario === 'CLIENTE';

  const stats = () => (profile && profile.estatisticas) || {};
  const portfolio = () => (profile && profile.portfolio) || [];

  const verFotos = (item) => () => {
    fotos = (item.imagens || []).slice();
    if (!fotos.length) return;
    fotoIdx = 0;
    $update();
  };
  const fotoAnterior = () => { fotoIdx = (fotoIdx - 1 + fotos.length) % fotos.length; $update(); };
  const fotoSeguinte = () => { fotoIdx = (fotoIdx + 1) % fotos.length; $update(); };
  const fecharFotos = () => { fotos = []; $update(); };

  const setAba = (id) => () => { aba = id; $update(); };

  const registro = (r) => $h`
    <div class="registro-item">
      <div class="titulo">${r.titulo}</div>
      ${r.local ? $h`<div class="local">${r.local}</div>` : ''}
      ${r.periodo ? $h`<span class="periodo">${r.periodo}</span>` : ''}
      ${r.descricao ? $h`<div class="descricao">${r.descricao}</div>` : ''}
    </div>
  `;

  const social = (icone, url) => url ? $h`
    <a class="btn-mz fantasma" style="padding:8px 14px; font-size:12.5px;" href=${url} target="_blank" rel="noopener">
      <i class="f7-icons" style="font-size:13px;">${icone}</i> ${url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 28)}
    </a>
  ` : '';

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Freelancer', voltar: true })}
      <div class="page-content">

        ${fotos.length ? $h`
          <div class="photo-browser-overlay" @click=${fecharFotos}>
            <button class="pb-close" @click=${fecharFotos}><i class="f7-icons">xmark</i></button>
            <img class="pb-foto" src=${assetUrl(fotos[fotoIdx])} alt="foto do portfólio" @click=${(e) => e.stopPropagation()} />
            <div class="pb-controles">
              <button @click=${(e) => { e.stopPropagation(); fotoAnterior(); }}><i class="f7-icons">chevron_left</i></button>
              <span>${fotoIdx + 1} / ${fotos.length}</span>
              <button @click=${(e) => { e.stopPropagation(); fotoSeguinte(); }}><i class="f7-icons">chevron_right</i></button>
            </div>
          </div>
        ` : ''}

        ${carregando ? $h`
          <div class="mz-container">
            <div class="skeleton" style="height:150px; border-radius:20px;"></div>
            <div class="skeleton" style="height:110px; border-radius:20px; margin-top:14px;"></div>
            ${skeletonCards($h, 3)}
          </div>
        ` : erro ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${errorState($h, { mensagem: erro, onRetry: carregar })}
          </div>
        ` : !profile ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${emptyState($h, { icone: 'person_2', titulo: 'Freelancer não encontrado', texto: 'Este perfil pode ter sido removido.' })}
          </div>
        ` : $h`
          <div>

            <!-- Capa + avatar sobreposto -->
            <div class="perfil-capa">
              ${profile.user_capa ? $h`<img src=${assetUrl(profile.user_capa)} alt="capa" />` : ''}
            </div>

            <div class="mz-container" style="max-width:680px;">

              <div class="perfil-topo">
                ${renderAvatar($h, { nome: profile.nome, foto: profile.user_foto }, 'avatar-xl')}
                <div class="perfil-topo-info">
                  <div class="perfil-nome">${profile.nome}</div>
                  <div class="perfil-username">@${profile.nome_utilizador || profile.user_id || id}
                    · ${profile.titulo || 'Freelancer'}</div>
                  <div style="margin-top:7px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    ${indicadorDisponibilidade($h, profile.disponibilidade)}
                    <span style="display:inline-flex; align-items:center; gap:4px; font-size:12.5px; color:var(--mz-text-2); font-weight:600;">
                      <i class="f7-icons" style="font-size:13px;">placemark</i>
                      ${profile.user_cidade || profile.cidade || profile.localizacao || 'Moçambique'}
                    </span>
                    <span style="display:inline-flex; align-items:center; gap:4px; font-size:12.5px; color:var(--mz-text-2); font-weight:600;">
                      <i class="f7-icons" style="font-size:13px;">rosette</i>
                      ${NIVEIS[profile.nivel] || 'Iniciante'}${profile.anos_experiencia ? ` · ${profile.anos_experiencia} ano(s)` : ''}
                    </span>
                  </div>
                  <div style="margin-top:8px;">
                    ${selos($h, profile, stats())}
                  </div>
                </div>
              </div>

              <!-- Estatísticas -->
              <div class="perfil-stats">
                <div class="stat">
                  <div class="valor"><i class="f7-icons">star_fill</i>${stats().nota_media || '0.0'}</div>
                  <div class="rotulo">${stats().total_avaliacoes || 0} avaliações</div>
                </div>
                <div class="stat">
                  <div class="valor">${stats().projetos_concluidos || 0}</div>
                  <div class="rotulo">concluídos</div>
                </div>
                <div class="stat">
                  <div class="valor">${stats().taxa_resposta || 0}%</div>
                  <div class="rotulo">resposta</div>
                </div>
                <div class="stat">
                  <div class="valor">${formatarMoeda(profile.preco_por_hora)}</div>
                  <div class="rotulo">por hora</div>
                </div>
              </div>

              ${souCliente ? $h`
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;">
                  <a class="btn-mz" style="text-decoration:none;" @click=${() => ir(`/projects/create?freelancer=${id}`)}>
                    <i class="f7-icons" style="font-size:15px;">plus_circle</i> Contratar
                  </a>
                  <a class="btn-mz secundario" style="text-decoration:none;" @click=${() => ir(`/messages/${id}`)}>
                    <i class="f7-icons" style="font-size:15px;">chat_bubble_fill</i> Mensagem
                  </a>
                  <a class="btn-mz fantasma" style="text-decoration:none;" @click=${alternarFavorito}>
                    <i class="f7-icons" style="font-size:15px;">${favorito ? 'heart_fill' : 'heart'}</i>
                    ${favorito ? 'Favorito' : 'Favoritar'}
                  </a>
                </div>
              ` : ''}

              <!-- Abas -->
              <div class="abas-perfil">
                <button class="aba-perfil ${aba === 'sobre' ? 'active' : ''}" type="button" @click=${setAba('sobre')}>
                  <i class="f7-icons">person_crop_circle</i> Sobre
                </button>
                <button class="aba-perfil ${aba === 'portfolio' ? 'active' : ''}" type="button" @click=${setAba('portfolio')}>
                  <i class="f7-icons">photos</i> Portfólio ${portfolio().length ? `(${portfolio().length})` : ''}
                </button>
                <button class="aba-perfil ${aba === 'servicos' ? 'active' : ''}" type="button" @click=${setAba('servicos')}>
                  <i class="f7-icons">briefcase_fill</i> Serviços ${servicos.length ? `(${servicos.length})` : ''}
                </button>
                <button class="aba-perfil ${aba === 'avaliacoes' ? 'active' : ''}" type="button" @click=${setAba('avaliacoes')}>
                  <i class="f7-icons">star_fill</i> Avaliações ${stats().total_avaliacoes ? `(${stats().total_avaliacoes})` : ''}
                </button>
              </div>

              <!-- ============ ABA: SOBRE ============ -->
              ${aba === 'sobre' ? $h`
                <div class="mz-card">
                  <p style="margin:0; font-size:14px; line-height:1.65; color:var(--mz-text); white-space:pre-line;">
                    ${profile.user_sobre || profile.descricao || 'Este freelancer ainda não escreveu uma descrição.'}
                  </p>

                  ${(profile.habilidades || []).filter(Boolean).length ? $h`
                    <div class="secao-head" style="margin-top:16px;"><div class="secao-titulo"><i class="f7-icons">wand_stars</i> Habilidades</div></div>
                    <div class="tags-lista">
                      ${profile.habilidades.filter(Boolean).map((hb) => $h`<span class="tag-skill">${hb.trim()}</span>`)}
                    </div>
                  ` : ''}

                  ${(profile.idiomas || []).filter(Boolean).length || (profile.user_idiomas || '').trim() ? $h`
                    <p class="text-sm text-muted" style="margin:14px 0 0 0;">
                      <b>Idiomas:</b> ${(profile.idiomas || []).filter(Boolean).join(', ') || profile.user_idiomas}
                    </p>
                  ` : ''}
                  ${profile.experiencia ? $h`
                    <p class="text-sm text-muted" style="margin:6px 0 0 0;"><b>Experiência:</b> ${profile.experiencia}</p>
                  ` : ''}

                  ${(profile.educacao || []).length ? $h`
                    <div class="secao-head"><div class="secao-titulo"><i class="f7-icons">book</i> Educação</div></div>
                    ${profile.educacao.map((r) => registro(r))}
                  ` : ''}
                  ${(profile.experiencia_prof || []).length ? $h`
                    <div class="secao-head"><div class="secao-titulo"><i class="f7-icons">briefcase</i> Experiência profissional</div></div>
                    ${profile.experiencia_prof.map((r) => registro(r))}
                  ` : ''}
                  ${(profile.certificacoes || []).length ? $h`
                    <div class="secao-head"><div class="secao-titulo"><i class="f7-icons">rosette</i> Certificações</div></div>
                    ${profile.certificacoes.map((r) => registro(r))}
                  ` : ''}

                  ${profile.linkedin || profile.instagram || profile.facebook || profile.site_pessoal ? $h`
                    <div class="secao-head"><div class="secao-titulo"><i class="f7-icons">globe</i> Na internet</div></div>
                    <div class="tags-lista">
                      ${social('logo_linkedin', profile.linkedin)}
                      ${social('camera', profile.instagram)}
                      ${social('logo_facebook', profile.facebook)}
                      ${social('safari', profile.site_pessoal)}
                    </div>
                  ` : ''}

                  <p class="text-sm text-muted" style="margin:16px 0 0 0;">
                    <i class="f7-icons" style="font-size:12px; vertical-align:-2px;">clock</i>
                    Membro desde ${formatarData(profile.membro_desde)}
                  </p>
                </div>
              ` : ''}

              <!-- ============ ABA: PORTFÓLIO ============ -->
              ${aba === 'portfolio' ? $h`
                ${portfolio().length === 0 ? $h`
                  ${emptyState($h, {
                    icone: 'photos',
                    titulo: 'Sem trabalhos no portfólio',
                    texto: 'Este freelancer ainda não publicou trabalhos.',
                  })}
                ` : $h`
                  <div class="portfolio-grid">
                    ${portfolio().map((item) => $h`
                      <div class="portfolio-item">
                        <div class="portfolio-thumb-multi" @click=${verFotos(item)}>
                          ${(item.imagens && item.imagens.length) ? $h`
                            <img src=${assetUrl(item.imagens[0])} alt=${item.titulo} />
                            ${item.imagens.length > 1 ? $h`
                              <span class="portfolio-badge-fotos"><i class="f7-icons">photos</i> ${item.imagens.length}</span>
                            ` : ''}
                          ` : $h`<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#94a3b8;"><i class="f7-icons">photos</i></div>`}
                        </div>
                        <div class="portfolio-info">
                          <div class="portfolio-titulo">${item.titulo}</div>
                          ${item.descricao ? $h`<div class="text-sm text-muted" style="margin-top:3px; font-size:11.5px; line-height:1.4;">${item.descricao.slice(0, 90)}${item.descricao.length > 90 ? '…' : ''}</div>` : ''}
                          ${item.link ? $h`
                            <a href=${item.link} target="_blank" rel="noopener" class="text-sm" style="display:inline-flex; align-items:center; gap:4px; margin-top:6px; color:var(--mz-primary); font-weight:700; text-decoration:none;">
                              <i class="f7-icons" style="font-size:12px;">link</i> Ver projeto
                            </a>
                          ` : ''}
                        </div>
                      </div>
                    `)}
                  </div>
                `}
              ` : ''}

              <!-- ============ ABA: SERVIÇOS ============ -->
              ${aba === 'servicos' ? $h`
                ${servicos.length === 0 ? $h`
                  ${emptyState($h, {
                    icone: 'briefcase',
                    titulo: 'Sem serviços publicados',
                    texto: 'Este freelancer ainda não publicou serviços.',
                  })}
                ` : $h`
                  <div class="mz-grid">
                    ${servicos.map((s) => $h`
                      <div class="service-card" @click=${() => ir(`/services/${s.id}`)}>
                        <div class="service-card-head">
                          <div class="svc-icon" style="background:${s.categoria_cor || '#2563EB'}">
                            <i class="f7-icons">${s.categoria_icone || 'briefcase'}</i>
                          </div>
                          <span class="mz-badge badge-verificado">${s.categoria_nome}</span>
                        </div>
                        <div class="service-card-body">
                          <div class="service-card-title">${s.titulo}</div>
                          <div class="service-card-meta">
                            <i class="f7-icons" style="font-size:13px;">clock</i> ${s.prazo_entrega}
                          </div>
                          <div class="service-card-price">${preco($h, s.preco)}</div>
                        </div>
                      </div>
                    `)}
                  </div>
                `}
              ` : ''}

              <!-- ============ ABA: AVALIAÇÕES ============ -->
              ${aba === 'avaliacoes' ? $h`
                ${reviews.length === 0 ? $h`
                  ${emptyState($h, {
                    icone: 'star',
                    titulo: 'Ainda sem avaliações',
                    texto: 'Seja o primeiro a avaliar após concluir um projeto.',
                  })}
                ` : $h`
                  <div class="mz-list-card">
                    ${reviews.map((r) => $h`
                      <div class="mz-list-item">
                        ${renderAvatar($h, r, 'avatar-sm')}
                        <div class="mz-list-main">
                          <div class="mz-list-title">${r.avaliador_nome}</div>
                          <div class="stars">${'★'.repeat(r.nota)}<span class="off">${'☆'.repeat(5 - r.nota)}</span></div>
                          ${r.comentario ? $h`<div class="mz-list-sub" style="margin-top:4px;">${r.comentario}</div>` : ''}
                          <div class="mz-list-sub">${formatarData(r.created_at)}${r.projeto_titulo ? ' · ' + r.projeto_titulo : ''}</div>
                        </div>
                      </div>
                    `)}
                  </div>
                `}
              ` : ''}
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}
