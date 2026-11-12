/* ============================================================
   FreelaMZ — Componentes de UI compartilhados (Framework7 v8)
   Cada helper recebe o $h (htm) da página e retorna árvores de
   vnode. Também expõe funções DOM para panel/tabbar/toast.
   ============================================================ */
import { loadAuth, clearAuth } from './auth.js';
import { api, assetUrl } from './api.js';
import { navegar } from './nav.js';
import { iniciais, corIniciais, formatarMoeda } from './utils.js';

/* ---------- Navbar padrão ---------- */
export function navbar($h, { titulo = 'FreelaMZ', voltar = false, direita = null } = {}) {
  const $ = window.f7app;
  return $h`
    <div class="navbar">
      <div class="navbar-bg"></div>
      <div class="navbar-inner sliding">
        <div class="left">
          ${voltar
            ? $h`<a class="link back"><i class="f7-icons">chevron_left</i></a>`
            : $h`<a class="link panel-open"><i class="f7-icons">menu</i></a>`}
        </div>
        <div class="title">${titulo}</div>
        <div class="right">
          ${direita || navbarDireita($h)}
        </div>
      </div>
    </div>
  `;
}

/* Sino + avatar no lado direito da navbar */
export function navbarDireita($h) {
  return $h`
    <a class="link navbar-btn-notif" data-nav="notificacoes">
      <i class="f7-icons">bell</i>
      <span class="badge-notif">0</span>
    </a>
    <a class="link" data-nav="perfil">
      <span class="navbar-avatar" id="nav-avatar"></span>
    </a>
  `;
}

/* ---------- Ícone (única forma de renderizar ícones no app) ----------
   IMPORTANTE: o $h do F7 v8 é htm — entidades HTML (&nbsp;, &amp;…)
   ficam TEXTO LITERAL, nunca usar em templates. O nome do ícone é
   sempre filho de texto de <i>, o espaçamento vem do CSS (gap). */
export function renderIcon($h, nome, { tamanho = null, cor = null, classe = '' } = {}) {
  const style = `${tamanho ? `font-size:${tamanho}px;` : ''}${cor ? `color:${cor};` : ''}`;
  return $h`<i class="icon f7-icons ${classe}" style=${style}>${nome}</i>`;
}

/* ---------- Botão com ícone (helper único) ----------
   O ícone e o rótulo são filhos diretos; o CSS .btn (inline-flex + gap)
   faz o espaçamento — nunca &nbsp;. */
export function renderButton($h, {
  icone = null, rotulo = '', variante = 'primary', tamanho = '', bloco = false,
  href = null, onClick = null, tipo = 'button', disabled = false,
  carregando = false, extraStyle = '', title = '',
} = {}) {
  const clicar = typeof onClick === 'function' ? onClick : () => {};
  const cls = `btn btn-${variante}${tamanho ? ` btn-${tamanho}` : ''}${bloco ? ' btn-block' : ''}${carregando ? ' loading' : ''}`;
  const style = `${bloco ? 'margin-bottom:16px;' : ''}${extraStyle}`;
  const iconeEl = icone ? renderIcon($h, icone) : null;
  const rotuloEl = rotulo ? $h`<span class="btn-rotulo">${rotulo}</span>` : null;
  if (href) {
    return $h`<a class=${cls} href=${href} @click=${clicar} style=${style} title=${title}>${iconeEl}${rotuloEl}</a>`;
  }
  return $h`<button class=${cls} type=${tipo} disabled=${disabled} @click=${clicar} style=${style} title=${title}>${iconeEl}${rotuloEl}</button>`;
}

/* ---------- Estrelas ---------- */
export function stars($h, media = 0, total = null) {
  const m = parseFloat(media) || 0;
  const n = total !== null && total !== undefined ? Number(total) || 0 : null;
  /* Sem avaliações: badge "Novo" em vez de 5 estrelas vazias */
  if (m <= 0 && !(n > 0)) {
    return $h`<span class="mz-badge badge-novo">Novo</span>`;
  }
  const cheias = '★'.repeat(Math.round(m));
  const vazias = '☆'.repeat(5 - Math.min(5, Math.round(m)));
  return $h`
    <span class="stars"><span>${cheias}</span><span class="off">${vazias}</span></span>
    ${n !== null ? $h`<span class="stars-txt">${m.toFixed(1)} (${n})</span>` : ''}
  `;
}

/* ---------- Avatar com iniciais (fallback) ou foto real ----------
   Função ÚNICA de avatar do app: se o utilizador tiver foto,
   renderiza <img>; senão, iniciais coloridas. Aceita:
   - user: { nome, foto } ou { user_nome, user_foto } etc.
   - size: 'sm' | '' (médio) | 'lg' | 'xl'  */
export function renderAvatar($h, user, size = '') {
  const nome = (user && (user.nome || user.user_nome || user.outro_nome || user.remetente_nome
    || user.cliente_nome || user.freelancer_nome || user.avaliador_nome)) || '?';
  const foto = user && (user.foto || user.user_foto || user.outro_foto || user.remetente_foto
    || user.cliente_foto || user.freelancer_foto || user.avaliador_foto);
  // aceita tanto 'xl' como 'avatar-xl' (evita prefixo duplicado avatar-avatar-xl)
  const classe = size ? (String(size).startsWith('avatar-') ? String(size) : `avatar-${size}`) : '';
  if (foto) {
    return $h`<span class="avatar-wrap ${classe}"><img class="avatar-img" src=${assetUrl(foto)} alt=${nome} loading="lazy" /></span>`;
  }
  return $h`<span class="avatar-initials ${corIniciais(nome)} ${classe}">${iniciais(nome)}</span>`;
}

/* Compat: avatar() antigo continua a funcionar (só iniciais) */
export function avatar($h, nome = '?', classe = '') {
  return $h`<span class="avatar-initials ${corIniciais(nome)} ${classe}">${iniciais(nome)}</span>`;
}

/* ---------- Badge de status ---------- */
const CORES_STATUS = {
  PENDENTE: 'pendente', ACEITA: 'aceita', RECUSADA: 'recusada', CANCELADA: 'cancelada',
  EM_ANDAMENTO: 'andamento', ENTREGUE: 'entregue', CONCLUIDO: 'concluido',
  AGUARDANDO_PAGAMENTO: 'pendente', EM_DISPUTA: 'disputa',
  RETIDO: 'andamento', LIBERADO: 'concluido', REEMBOLSADO: 'recusada',
  ativo: 'ativo', bloqueado: 'bloqueado', inativo: 'cancelada',
  RESOLVIDA: 'concluido', REJEITADA: 'recusada',
};
const ROTULOS_STATUS = {
  PENDENTE: 'Pendente', ACEITA: 'Aceita', RECUSADA: 'Recusada', CANCELADA: 'Cancelada',
  EM_ANDAMENTO: 'Em andamento', ENTREGUE: 'Entregue', CONCLUIDO: 'Concluído',
  AGUARDANDO_PAGAMENTO: 'Aguarda pagamento', EM_DISPUTA: 'Em disputa',
  RETIDO: 'Retido (escrow)', LIBERADO: 'Liberado', REEMBOLSADO: 'Reembolsado',
  ativo: 'Ativo', bloqueado: 'Bloqueado', inativo: 'Inativo',
  RESOLVIDA: 'Resolvida', REJEITADA: 'Rejeitada',
};
export function statusBadge($h, status = '') {
  const cls = CORES_STATUS[status] || 'pendente';
  const rot = ROTULOS_STATUS[status] || status;
  return $h`<span class="mz-badge badge-${cls}">${rot}</span>`;
}

/* ---------- Selos de verificação / reputação ---------- */
export function selos($h, user = {}, stats = {}) {
  const lista = [];
  if (user.email_verificado) lista.push({ icon: 'envelope_fill', rot: 'Email verificado', cls: 'selo-azul' });
  if (user.telefone_verificado) lista.push({ icon: 'phone_fill', rot: 'Telefone verificado', cls: 'selo-verde' });
  if (user.verificado_plataforma) lista.push({ icon: 'checkmark_seal_fill', rot: 'Verificado pela plataforma', cls: 'selo-azul' });
  if (stats && stats.top_rated) lista.push({ icon: 'star_fill', rot: 'Top Rated', cls: 'selo-coral' });
  if (!lista.length) return '';
  return $h`<span class="selos">${lista.map((s) => $h`
    <span class="selo ${s.cls}"><i class="f7-icons">${s.icon}</i>${s.rot}</span>
  `)}</span>`;
}

/* ---------- Indicador de disponibilidade ---------- */
export function indicadorDisponibilidade($h, disp = '') {
  const d = String(disp || '').toLowerCase();
  if (d === 'disponivel') return $h`<span class="disp disp-on"><span class="disp-dot"></span>Disponível</span>`;
  if (d === 'ocupado') return $h`<span class="disp disp-ocupado"><span class="disp-dot"></span>Ocupado</span>`;
  return $h`<span class="disp disp-off"><span class="disp-dot"></span>Indisponível</span>`;
}

/* ---------- Preço em MT (0 → "A combinar") ---------- */
export function preco($h, valor, sufixo = '') {
  const v = parseFloat(valor) || 0;
  if (v <= 0) {
    return $h`<span class="service-price">A combinar</span>`;
  }
  return $h`<span class="service-price">${formatarMoeda(valor)}${sufixo ? ' ' : ''}${sufixo}</span>`;
}

/* ---------- Skeletons ---------- */
export function skeletonCards($h, n = 6) {
  return $h`
    <div class="mz-grid">
      ${Array.from({ length: n }).map(() => $h`
        <div class="skeleton-card">
          <div class="skeleton sk-avatar sk-title"></div>
          <div class="skeleton sk-line" style="width:90%"></div>
          <div class="skeleton sk-line" style="width:60%"></div>
        </div>
      `)}
    </div>
  `;
}

export function skeletonLista($h, n = 4) {
  return $h`
    <div class="mz-list-card">
      ${Array.from({ length: n }).map(() => $h`
        <div class="mz-list-item">
          <div class="skeleton sk-avatar"></div>
          <div class="mz-list-main">
            <div class="skeleton sk-line" style="width:70%"></div>
            <div class="skeleton sk-line" style="width:45%"></div>
          </div>
        </div>
      `)}
    </div>
  `;
}

export function skeletonMetricas($h, n = 4) {
  return $h`
    <div class="mz-grid-4">
      ${Array.from({ length: n }).map(() => $h`
        <div class="skeleton" style="height:108px; border-radius:20px;"></div>
      `)}
    </div>
  `;
}

/* ---------- Empty state ---------- */
export function emptyState($h, { icone = 'briefcase', titulo, texto, acao, onAcao, cor = '' }) {
  return $h`
    <div class="empty-state">
      <div class="empty-icon"><i class="f7-icons">${icone}</i></div>
      <h3>${titulo}</h3>
      <p>${texto}</p>
      ${acao && onAcao ? $h`<a class="btn btn-primary btn-sm" @click=${onAcao} style="display:inline-block; padding:12px 22px; text-decoration:none;">${acao}</a>` : ''}
    </div>
  `;
}

/* ---------- Error state ---------- */
export function errorState($h, { mensagem = 'Não foi possível carregar os dados.', onRetry }) {
  return $h`
    <div class="error-state">
      <div class="empty-icon"><i class="f7-icons">wifi_exclamationmark</i></div>
      <h3>Algo correu mal</h3>
      <p>${mensagem}</p>
      <a class="btn btn-primary btn-sm" @click=${onRetry} style="display:inline-block; padding:12px 22px; text-decoration:none;">Tentar novamente</a>
    </div>
  `;
}

/* ============================================================
   Funções DOM (panel, tabbar, toasts, logout)
   ============================================================ */

/* Toast flutuante */
export function toast(mensagem, tipo = 'info') {
  let el = document.getElementById('mz-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mz-toast';
    document.body.appendChild(el);
  }
  el.className = `mz-toast ${tipo === 'error' ? 'error' : tipo === 'success' ? 'success' : ''}`;
  el.textContent = mensagem;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

/* Sair da conta */
export function logout() {
  clearAuth();
  window.freelaMZ.usuario = null;
  window.freelaMZ.token = null;
  toast('Sessão terminada. Até já!', 'success');
  setTimeout(() => { navegar('/login', { recarregar: true }); }, 400);
}

/* Atualiza avatar/nome/tipo no painel lateral + item admin */
export function atualizarPanel(user) {
  const nome = document.getElementById('panel-nome');
  const tipo = document.getElementById('panel-tipo');
  const av = document.getElementById('panel-avatar');
  const admin = document.getElementById('panel-admin');
  if (!nome) return;
  if (user) {
    nome.textContent = user.nome || 'Utilizador';
    if (user.foto) {
      av.innerHTML = '';
      const img = document.createElement('img');
      img.src = assetUrl(user.foto);
      img.alt = user.nome || 'foto';
      img.className = 'avatar-img-full';
      av.appendChild(img);
      av.className = 'avatar-photo avatar-sm';
    } else {
      av.textContent = iniciais(user.nome);
      av.className = `avatar-initials avatar-sm ${corIniciais(user.nome)}`;
    }
    const t = user.tipo_usuario === 'ADMIN' ? 'Administrador'
      : user.tipo_usuario === 'FREELANCER' ? 'Freelancer' : 'Cliente';
    tipo.textContent = t;
    if (admin) admin.style.display = user.tipo_usuario === 'ADMIN' ? '' : 'none';
  } else {
    nome.textContent = 'FreelaMZ';
    tipo.textContent = 'Bem-vindo';
    av.textContent = '?';
    if (admin) admin.style.display = 'none';
  }
}

/* Marca o item ativo da tabbar inferior */
export function atualizarTabbar(path) {
  const alvos = ['/dashboard', '/freelancers', '/services', '/messages', '/profile'];
  const atual = alvos.find((p) => path === p || path.startsWith(p + '/')) || '';
  document.querySelectorAll('#app-tabbar a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('data-path') === atual);
  });
  // item ativo do painel (startsWith cobre subpáginas: /messages/5 → Mensagens)
  document.querySelectorAll('.panel-menu .panel-link').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const ativo = href !== '' && href !== '#' && (path === href || path.startsWith(href + '/'));
    a.classList.toggle('active', ativo);
  });
}

/* Badge de mensagens não lidas na tabbar + sino da navbar */
export async function atualizarBadges() {
  const auth = loadAuth();
  if (!auth.token) return;
  try {
    const [msg, notif] = await Promise.all([
      api.get('/messages/unread-count'),
      api.get('/notifications/unread-count'),
    ]);
    const bm = document.getElementById('tab-badge-msg');
    if (bm) {
      const n = msg.total || 0;
      bm.textContent = n > 99 ? '99+' : n;
      bm.classList.toggle('on', n > 0);
    }
    document.querySelectorAll('.badge-notif').forEach((b) => {
      const n = notif.total || 0;
      b.textContent = n > 99 ? '99+' : n;
      b.classList.toggle('on', n > 0);
    });
  } catch (e) { /* silencioso */ }
}

/* Avatar na navbar das páginas autenticadas */
export function aplicarNavbarAvatar() {
  const auth = loadAuth();
  const el = document.getElementById('nav-avatar');
  if (el && auth.user) {
    if (auth.user.foto) {
      el.innerHTML = '';
      const img = document.createElement('img');
      img.src = assetUrl(auth.user.foto);
      img.alt = 'foto de perfil';
      el.appendChild(img);
      el.className = 'navbar-avatar tem-foto';
    } else {
      el.textContent = iniciais(auth.user.nome);
      el.className = `navbar-avatar ${corIniciais(auth.user.nome)}`;
    }
  }
}

/* Liga cliques globais: panel links, tabbar, botões da navbar, sair */
export function ligarNavegacaoGlobal(app) {
  // Links do painel (href) — navega e fecha
  document.querySelectorAll('.panel-menu .panel-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const href = a.getAttribute('href');
      if (app.panel) app.panel.close();
      app.views.main.router.navigate(href);
    });
  });
  // Tabbar inferior
  document.querySelectorAll('#app-tabbar a').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      app.views.main.router.navigate(a.getAttribute('data-path'));
    });
  });
  // Botões dinâmicos da navbar (sino / avatar) — delegação global
  document.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-nav]');
    if (!alvo) return;
    e.preventDefault();
    const destino = alvo.getAttribute('data-nav');
    if (destino === 'notificacoes') app.views.main.router.navigate('/notifications');
    if (destino === 'perfil') app.views.main.router.navigate('/profile');
  });
  // Sair
  const sair = document.getElementById('panel-sair');
  if (sair) sair.addEventListener('click', (e) => { e.preventDefault(); logout(); });
}
