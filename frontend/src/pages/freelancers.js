/* FreelaMZ — Lista de freelancers com busca, ordenação e filtros */
import { api } from '../js/api.js';
import {
  navbar, renderAvatar, stars, skeletonCards, emptyState, errorState, renderButton, renderIcon,
} from '../js/layout.js';
import { formatarMoeda } from '../js/utils.js';

const ORDENS = [
  { id: 'recente', rotulo: 'Recentes' },
  { id: 'melhor_avaliacao', rotulo: 'Melhor avaliação' },
  { id: 'menor_preco', rotulo: 'Menor preço' },
  { id: 'maior_preco', rotulo: 'Maior preço' },
];

/* Um perfil só entra na listagem pública se tiver ALGUM dado de
   apresentação (título, habilidades ou preço) — nunca "vazio" e quebrado. */
const perfilExibivel = (f) => !!(f.titulo || ((f.habilidades || []).length) || Number(f.preco_por_hora) > 0);

export default function freelancers(props, { $h, $onMounted, $f7route, $f7router, $update }) {
  let carregando = true;
  let erro = null;
  let lista = [];
  let busca = ($f7route.query && $f7route.query.busca) || '';
  let ordem = 'recente';

  /* Filtros avançados (aplicados à lista carregada) */
  let filtrosAbertos = false;
  let filtros = { local: '', precoMax: '', notaMin: '' };

  const ir = (path) => $f7router.navigate(path);

  const pesquisar = (e) => {
    if (e) e.preventDefault();
    carregar();
  };

  const aplicarFiltros = () => lista.filter(perfilExibivel).filter((f) => {
    if (filtros.local) {
      const alvo = `${f.cidade || ''} ${f.provincia || ''} ${f.localizacao || ''}`.toLowerCase();
      if (!alvo.includes(filtros.local.toLowerCase())) return false;
    }
    if (filtros.precoMax) {
      const preco = Number(f.preco_por_hora) || 0;
      if (preco <= 0 || preco > Number(filtros.precoMax)) return false;
    }
    if (filtros.notaMin) {
      const nota = parseFloat(f.classificacao) || 0;
      if (nota < Number(filtros.notaMin)) return false;
    }
    return true;
  });

  const limparFiltros = () => {
    filtros = { local: '', precoMax: '', notaMin: '' };
    $update();
  };

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const qs = new URLSearchParams();
      if (busca) qs.set('busca', busca);
      if (ordem) qs.set('ordem', ordem);
      const res = await api.get(`/users/freelancers?${qs.toString()}`);
      lista = res.freelancers || [];
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Freelancers' })}
      <div class="page-content">
        <div class="mz-container">

          <!-- Busca -->
          <form class="searchbar-mz" @submit=${pesquisar}>
            ${renderIcon($h, 'search', { classe: 'search-icon', tamanho: 19 })}
            <input type="search" placeholder="Buscar por título ou habilidade…"
              value=${busca} @input=${(e) => { busca = e.target.value; }} />
          </form>

          <!-- Ordenação (segmented) + botão de filtros -->
          <div class="filtros-topo">
            <div class="filter-bar">
              ${ORDENS.map((o) => $h`
                <button class="filter-pill ${ordem === o.id ? 'active' : ''}"
                  @click=${() => { ordem = o.id; carregar(); }}>${o.rotulo}</button>
              `)}
            </div>
            <button class="filtros-toggle ${filtrosAbertos ? 'aberto' : ''}"
              @click=${() => { filtrosAbertos = !filtrosAbertos; $update(); }}>
              ${renderIcon($h, 'line_horizontal_3_decrease_circle', { tamanho: 16 })}
              Filtros
            </button>
          </div>

          ${filtrosAbertos ? $h`
            <div class="filtros-painel">
              <div class="filtros-linha">
                <div>
                  <label class="field-label">Localização</label>
                  <input class="input-mz" type="text" placeholder="Ex.: Maputo"
                    value=${filtros.local} @input=${(e) => { filtros.local = e.target.value; }} />
                </div>
                <div>
                  <label class="field-label">Preço máx. (MT/hora)</label>
                  <input class="input-mz" type="number" min="0" placeholder="Ex.: 1500"
                    value=${filtros.precoMax} @input=${(e) => { filtros.precoMax = e.target.value; }} />
                </div>
                <div>
                  <label class="field-label">Avaliação mínima</label>
                  <select class="input-mz" value=${filtros.notaMin}
                    @change=${(e) => { filtros.notaMin = e.target.value; }}>
                    <option value="">Qualquer</option>
                    <option value="4">★ 4+</option>
                    <option value="3">★ 3+</option>
                    <option value="2">★ 2+</option>
                  </select>
                </div>
              </div>
              <div class="filtros-rodape">
                <span class="filtros-contagem">${aplicarFiltros().length} de ${lista.length} freelancers</span>
                ${renderButton($h, { rotulo: 'Limpar', variante: 'ghost', tamanho: 'sm', onClick: limparFiltros })}
              </div>
            </div>
          ` : ''}

          <!-- Lista -->
          ${carregando ? skeletonCards($h, 6)
          : erro ? errorState($h, { mensagem: erro, onRetry: carregar })
          : aplicarFiltros().length === 0 ? $h`
            ${emptyState($h, {
              icone: 'person_2',
              titulo: 'Nenhum freelancer encontrado',
              texto: busca ? `Nada encontrado para "${busca}". Tente outro termo.` : 'Nenhum freelancer corresponde aos filtros escolhidos.',
              acao: 'Limpar busca e filtros',
              onAcao: () => { busca = ''; limparFiltros(); carregar(); },
            })}
          ` : $h`
            <div class="mz-grid">
              ${aplicarFiltros().map((f) => {
                const habs = (f.habilidades || []).filter(Boolean);
                const extras = Math.max(0, habs.length - 3);
                return $h`
                  <div class="fl-card" @click=${() => ir(`/freelancers/${f.user_id}`)}>
                    <div class="fl-top">
                      ${renderAvatar($h, f)}
                      <div style="min-width:0;">
                        <div class="fl-name">${f.nome}</div>
                        <div class="fl-title">${f.titulo || 'Freelancer'}</div>
                        <div class="fl-title" style="font-weight:600;">
                          ${renderIcon($h, 'placemark', { tamanho: 12 })}
                          ${f.cidade || f.localizacao || 'Moçambique'}
                        </div>
                      </div>
                    </div>
                    ${habs.length ? $h`<div class="fl-tags">
                      ${habs.slice(0, 3).map((hb) => $h`<span class="fl-tag">${hb.trim()}</span>`)}
                      ${extras > 0 ? $h`<span class="fl-tag">+${extras}</span>` : ''}
                    </div>` : ''}
                    <div class="fl-foot">
                      ${stars($h, f.classificacao, f.num_avaliacoes)}
                      ${Number(f.preco_por_hora) > 0
                        ? $h`<span class="fl-price">${formatarMoeda(f.preco_por_hora)}<small>/hora</small></span>`
                        : $h`<span class="fl-price">A combinar</span>`}
                    </div>
                  </div>
                `;
              })}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
