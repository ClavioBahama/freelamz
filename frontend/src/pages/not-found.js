/* FreelaMZ — Página não encontrada (404) */
export default function notFound(props, { $h, $f7router }) {
  return () => $h`
    <div class="page">
      <div class="navbar">
        <div class="navbar-bg"></div>
        <div class="navbar-inner sliding">
          <div class="title">FreelaMZ</div>
        </div>
      </div>
      <div class="page-content">
        <div class="empty-state" style="padding-top:90px;">
          <div class="empty-icon"><i class="f7-icons">compass</i></div>
          <h3>Página não encontrada</h3>
          <p>O endereço que tentou abrir não existe ou foi movido.</p>
          <a class="btn btn-primary" style="display:inline-block; padding:13px 24px; text-decoration:none;"
            @click=${() => $f7router.navigate('/home')}>
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  `;
}
