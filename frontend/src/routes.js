/* ============================================================
   FreelaMZ — Rotas (Framework7 v8, componentes-função)
   Ordem importante: rotas estáticas ANTES das dinâmicas
   (ex.: /services/create antes de /services/:id)
   ============================================================ */

export default [
  // ===== Boot / auth =====
  {
    path: '/',
    redirect: '/splash',
  },
  {
    path: '/splash',
    name: 'splash',
    asyncComponent: () => import('./pages/splash.js'),
  },
  {
    path: '/login',
    name: 'login',
    asyncComponent: () => import('./pages/login.js'),
  },
  {
    path: '/register',
    name: 'register',
    asyncComponent: () => import('./pages/register.js'),
  },

  // ===== App =====
  {
    path: '/dashboard',
    name: 'dashboard',
    asyncComponent: () => import('./pages/dashboard.js'),
  },
  {
    path: '/home',
    name: 'home',
    asyncComponent: () => import('./pages/home.js'),
  },

  // ===== Freelancers =====
  {
    path: '/freelancers',
    name: 'freelancers',
    asyncComponent: () => import('./pages/freelancers.js'),
  },
  {
    path: '/freelancers/:id',
    name: 'freelancer-detalhe',
    asyncComponent: () => import('./pages/freelancer-detalhe.js'),
  },
  {
    path: '/clientes/:id',
    name: 'cliente-detalhe',
    asyncComponent: () => import('./pages/cliente-detalhe.js'),
  },

  // ===== Serviços (create/edit ANTES de :id) =====
  {
    path: '/services',
    name: 'services',
    asyncComponent: () => import('./pages/services.js'),
  },
  {
    path: '/services/create',
    name: 'service-create',
    asyncComponent: () => import('./pages/service-create.js'),
  },
  {
    path: '/services/edit/:id',
    name: 'service-edit',
    asyncComponent: () => import('./pages/service-edit.js'),
  },
  {
    path: '/services/:id',
    name: 'service-detalhe',
    asyncComponent: () => import('./pages/service-detalhe.js'),
  },

  // ===== Projetos =====
  {
    path: '/projects/create',
    name: 'project-create',
    asyncComponent: () => import('./pages/project-create.js'),
  },
  {
    path: '/projects',
    name: 'projects',
    asyncComponent: () => import('./pages/projects.js'),
  },
  {
    path: '/projects/:id',
    name: 'project-detalhe',
    asyncComponent: () => import('./pages/project-detalhe.js'),
  },

  // ===== Propostas / mensagens / notificações =====
  {
    path: '/proposals',
    name: 'proposals',
    asyncComponent: () => import('./pages/proposals.js'),
  },
  {
    path: '/messages',
    name: 'messages',
    asyncComponent: () => import('./pages/messages.js'),
  },
  {
    path: '/messages/:id',
    name: 'message-conversa',
    asyncComponent: () => import('./pages/message-conversa.js'),
  },
  {
    path: '/notifications',
    name: 'notifications',
    asyncComponent: () => import('./pages/notifications.js'),
  },

  // ===== Favoritos / perfil / config / admin =====
  {
    path: '/favorites',
    name: 'favorites',
    asyncComponent: () => import('./pages/favorites.js'),
  },
  {
    path: '/profile',
    name: 'profile',
    asyncComponent: () => import('./pages/profile.js'),
  },
  {
    path: '/settings',
    name: 'settings',
    asyncComponent: () => import('./pages/settings.js'),
  },
  {
    path: '/sobre',
    name: 'sobre',
    asyncComponent: () => import('./pages/sobre.js'),
  },
  {
    path: '/wallet',
    name: 'wallet',
    asyncComponent: () => import('./pages/wallet.js'),
  },
  {
    path: '/admin',
    name: 'admin',
    asyncComponent: () => import('./pages/admin.js'),
  },

  // ===== 404 =====
  {
    path: '(.*)',
    name: 'not-found',
    asyncComponent: () => import('./pages/not-found.js'),
  },
];
