/* FreelaMZ — Home / Explorar: hero + busca + chips + destaques */
import { api } from '../js/api.js';
import {
  navbar, stars, renderAvatar, skeletonCards, emptyState, errorState, preco,
} from '../js/layout.js';
import { formatarMoeda } from '../js/utils.js';

export default function home(props, { $h, $onMounted, $f7router, $update }) {
  let carregando = true;
  let erro = null;
  let categorias = [];
  let servicos = [];
  let freelancers = [];
  let busca = '';

  const ir = (path) => $f7router.navigate(path);

  const pesquisar = (e) => {
    if (e) e.preventDefault();
    ir(busca ? `/services?busca=${encodeURIComponent(busca)}` : '/services');
  };

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const [resCat, resSvc, resFl] = await Promise.all([
        api.get('/categories'),
        api.get('/services'),
        api.get('/users/freelancers'),
      ]);
      categorias = resCat.categories || [];
      servicos = (resSvc.services || []).slice(0, 6);
      freelancers = (resFl.freelancers || []).slice(0, 4);
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Explorar' })}
      <div class="page-content">
        ${carregando ? $h`
          <div class="mz-container">
            <div class="skeleton" style="height:190px; border-radius:26px;"></div>
            <div class="skeleton sk-line" style="width:50%; height:22px; margin-top:22px;"></div>
            ${skeletonCards($h, 6)}
          </div>
        ` : erro ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${errorState($h, { mensagem: erro, onRetry: carregar })}
          </div>
        ` : $h`
          <div class="mz-container">

            <!-- Hero -->
            <div class="hero">
              <div>
                <div class="hero-eyebrow">🇲🇿 Feito em Moçambique</div>
                <div class="hero-title">Encontre talentos.<br/>Encontre oportunidades.</div>
                <div class="hero-sub">
                  O marketplace que conecta freelancers moçambicanos a clientes
                  que precisam de trabalho bem feito — de design a desenvolvimento.
                </div>
                <div class="hero-actions">
                  <a class="btn btn-primary btn-sm" style="padding:12px 22px; text-decoration:none;"
                    @click=${() => ir('/freelancers')}>Encontrar freelancers</a>
                  <a class="btn btn-white btn-sm" style="padding:12px 22px; text-decoration:none;"
                    @click=${() => ir('/services')}>Ver serviços</a>
                </div>
              </div>
            </div>

            <!-- Busca -->
            <form class="searchbar-mz" style="margin-top:18px;" @submit=${pesquisar}>
              <i class="f7-icons search-icon">search</i>
              <input type="search" placeholder="Buscar serviços, ex.: design de logo…"
                value=${busca} @input=${(e) => { busca = e.target.value; }} />
            </form>

            <!-- Categorias (chips) -->
            <div class="section-title">Categorias</div>
            <div class="chips-row">
              ${categorias.map((c) => $h`
                <a class="category-chip" @click=${() => ir(`/services?categoria=${c.id}`)}>
                  <span class="chip-dot" style="background:${c.cor || '#2563EB'}"></span>
                  ${c.nome}
                </a>
              `)}
            </div>

            <!-- Serviços em destaque -->
            <div class="section-title">
              <span>Serviços em destaque</span>
              <a class="ver-mais" href="/services" @click=${(e) => { e.preventDefault(); ir('/services'); }}>Ver todos →</a>
            </div>
            ${servicos.length === 0
              ? emptyState($h, {
                  icone: 'briefcase',
                  titulo: 'Ainda sem serviços',
                  texto: 'Quando freelancers publicarem serviços, eles aparecerão aqui.',
                  acao: 'Ver freelancers', onAcao: () => ir('/freelancers'),
                })
              : $h`<div class="mz-grid">
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
                          <i class="f7-icons" style="font-size:13px;">person</i> ${s.freelancer_nome}
                        </div>
                        <div class="service-card-meta">
                          <i class="f7-icons" style="font-size:13px;">clock</i> ${s.prazo_entrega}
                        </div>
                        <div class="service-card-price">
                          ${preco($h, s.preco)}
                          <small style="font-size:11px; color:var(--mz-text-2);">/${s.prazo_entrega ? 'entrega' : ''}</small>
                        </div>
                      </div>
                    </div>
                  `)}
                </div>`}

            <!-- Freelancers -->
            <div class="section-title">
              <span>Freelancers em alta</span>
              <a class="ver-mais" href="/freelancers" @click=${(e) => { e.preventDefault(); ir('/freelancers'); }}>Ver todos →</a>
            </div>
            ${freelancers.length === 0
              ? emptyState($h, {
                  icone: 'person_2',
                  titulo: 'Sem freelancers ainda',
                  texto: 'Convide talentos ou volte mais tarde.',
                })
              : $h`<div class="mz-grid">
                  ${freelancers.map((f) => {
                    const habs = (f.habilidades || []).filter(Boolean);
                    const extras = Math.max(0, habs.length - 3);
                    return $h`
                    <div class="fl-card" @click=${() => ir(`/freelancers/${f.user_id}`)}>
                      <div class="fl-top">
                        ${renderAvatar($h, f)}
                        <div style="min-width:0;">
                          <div class="fl-name">${f.nome}</div>
                          <div class="fl-title">${f.titulo || 'Freelancer'}</div>
                        </div>
                      </div>
                      ${habs.length ? $h`<div class="fl-tags">
                        ${habs.slice(0, 3).map((h) => $h`<span class="fl-tag">${h.trim()}</span>`)}
                        ${extras > 0 ? $h`<span class="fl-tag">+${extras}</span>` : ''}
                      </div>` : ''}
                      <div class="fl-foot">
                        ${stars($h, f.classificacao, f.num_avaliacoes)}
                        ${Number(f.preco_por_hora) > 0
                          ? $h`<span class="fl-price">${formatarMoeda(f.preco_por_hora)}<small>/hora</small></span>`
                          : $h`<span class="fl-price">A combinar</span>`}
                      </div>
                    </div>
                  `;})}
                </div>`}
          </div>
        `}
      </div>
    </div>
  `;
}
