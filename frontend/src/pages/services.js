/* FreelaMZ — Lista de serviços: busca, categorias, ordenação e favoritos */
import { api } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import {
  navbar, preco, toast, skeletonCards, emptyState, errorState, renderButton,
} from '../js/layout.js';

export default function services(props, { $h, $onMounted, $f7route, $f7router, $update }) {
  let carregando = true;
  let erro = null;
  let servicos = [];
  let categorias = [];
  let favoritos = new Set();
  let busca = ($f7route.query && $f7route.query.busca) || '';
  let categoria = ($f7route.query && $f7route.query.categoria) || '';
  let ordem = 'recente';

  const ir = (path) => $f7router.navigate(path);

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const qs = new URLSearchParams();
      if (busca) qs.set('busca', busca);
      if (categoria) qs.set('categoria', categoria);
      if (ordem) qs.set('ordem', ordem);
      const [resS, resC] = await Promise.all([
        api.get(`/services?${qs.toString()}`),
        categorias.length ? Promise.resolve({ categories: categorias }) : api.get('/categories'),
      ]);
      servicos = resS.services || [];
      categorias = resC.categories || [];
      // Estado dos favoritos (para pintar os corações)
      try {
        const fav = await api.get('/favorites?tipo=servico');
        favoritos = new Set((fav.itens || []).map((i) => i.id));
      } catch (e) { /* ignora */ }
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  const alternarFav = async (e, id) => {
    e.stopPropagation();
    try {
      if (favoritos.has(id)) {
        await api.delete('/favorites', { tipo: 'servico', alvo_id: id });
        favoritos.delete(id);
        toast('Removido dos favoritos');
      } else {
        await api.post('/favorites', { tipo: 'servico', alvo_id: id });
        favoritos.add(id);
        toast('Adicionado aos favoritos ❤️', 'success');
      }
      $update();
    } catch (err) {
      toast(err.message || 'Erro ao favoritar', 'error');
    }
  };

  const souFreelancer = (loadAuth().user || {}).tipo_usuario === 'FREELANCER';

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Serviços' })}
      <div class="page-content">
        <div class="mz-container">

          ${souFreelancer ? renderButton($h, {
            icone: 'plus_circle', rotulo: 'Publicar novo serviço', variante: 'primary', bloco: true,
            onClick: () => ir('/services/create'),
          }) : ''}

          <!-- Busca -->
          <form class="searchbar-mz" @submit=${(e) => { e.preventDefault(); carregar(); }}>
            <i class="f7-icons search-icon">search</i>
            <input type="search" placeholder="Buscar serviços… ex.: logo, website…"
              value=${busca} @input=${(e) => { busca = e.target.value; }} />
          </form>

          <!-- Categorias -->
          <div class="chips-row" style="margin-top:14px;">
            <button class="category-chip ${categoria === '' ? 'active' : ''}"
              @click=${() => { categoria = ''; carregar(); }}>Todos</button>
            ${categorias.map((c) => $h`
              <button class="category-chip ${String(categoria) === String(c.id) ? 'active' : ''}"
                @click=${() => { categoria = c.id; carregar(); }}>
                <span class="chip-dot" style="background:${c.cor || '#2563EB'}"></span>
                ${c.nome}
              </button>
            `)}
          </div>

          <!-- Ordenação -->
          <div class="filter-bar">
            ${[['recente', 'Recentes'], ['menor_preco', 'Menor preço'], ['maior_preco', 'Maior preço']].map(([id, rot]) => $h`
              <button class="filter-pill ${ordem === id ? 'active' : ''}"
                @click=${() => { ordem = id; carregar(); }}>${rot}</button>
            `)}
          </div>

          <!-- Lista -->
          ${carregando ? skeletonCards($h, 6)
          : erro ? errorState($h, { mensagem: erro, onRetry: carregar })
          : servicos.length === 0 ? $h`
            ${emptyState($h, {
              icone: 'briefcase',
              titulo: 'Nenhum serviço encontrado',
              texto: busca ? `Nada para "${busca}". Tente outro termo ou categoria.` : 'Ainda não há serviços publicados nesta categoria.',
              acao: 'Limpar filtros',
              onAcao: () => { busca = ''; categoria = ''; carregar(); },
            })}
          ` : $h`
            <div class="mz-grid">
              ${servicos.map((s) => $h`
                <div class="service-card" @click=${() => ir(`/services/${s.id}`)}>
                  <div class="service-card-head">
                    <div class="svc-icon" style="background:${s.categoria_cor || '#2563EB'}">
                      <i class="f7-icons">${s.categoria_icone || 'briefcase'}</i>
                    </div>
                    <button class="btn-heart ${favoritos.has(s.id) ? 'on' : ''}"
                      @click=${(e) => alternarFav(e, s.id)}>
                      <i class="f7-icons">${favoritos.has(s.id) ? 'heart_fill' : 'heart'}</i>
                    </button>
                  </div>
                  <div class="service-card-body">
                    <div class="service-card-title">${s.titulo}</div>
                    <div class="service-card-meta">
                      <i class="f7-icons" style="font-size:13px;">person</i> ${s.freelancer_nome}
                    </div>
                    <div class="service-card-meta">
                      <i class="f7-icons" style="font-size:13px;">placemark</i> ${s.cidade || 'Moçambique'}
                    </div>
                    <div class="service-card-price">
                      ${preco($h, s.preco)}
                      <small style="font-size:11px; color:var(--mz-text-2);">${s.prazo_entrega}</small>
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
