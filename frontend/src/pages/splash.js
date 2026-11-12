/* FreelaMZ — Splash de abertura (~1,2s), decide login ou dashboard */
import { caminhoAtual } from '../js/nav.js';

export default function splash(props, { $h, $onMounted, $onUnmounted, $f7router }) {
  let timer = null;

  $onMounted(() => {
    timer = setTimeout(() => {
      // segurança: se a URL já mudou (ex.: F5 em rota profunda em que o
      // browserHistory empurrou a rota real por cima do splash), não redirecionar
      if (caminhoAtual() !== '/splash') return;
      const temToken = !!localStorage.getItem('freelamz_token');
      $f7router.navigate(temToken ? '/dashboard' : '/login', {
        reloadAll: true,
        animate: false,
      });
    }, 1200);
  });

  $onUnmounted(() => {
    if (timer) clearTimeout(timer);
  });

  return () => $h`
    <div class="page no-navbar">
      <div class="page-content splash-wrap">
        <div class="splash-inner">
          <div class="splash-logo">✨</div>
          <div class="splash-name">FreelaMZ</div>
          <div class="splash-slogan">Encontre talentos. Encontre oportunidades.</div>
          <div class="splash-credito">por Clávio Alfredo Chitsulete</div>
          <div class="splash-bar"><i></i></div>
        </div>
      </div>
    </div>
  `;
}
