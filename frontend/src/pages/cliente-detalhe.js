/* ============================================================
   FreelaMZ — Perfil público de cliente (simples)
   Acessível a partir de propostas, projetos e mensagens.
   ============================================================ */
import { api, assetUrl } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import {
  navbar, renderAvatar, selos, statusBadge, toast, errorState, emptyState,
} from '../js/layout.js';
import { formatarMoeda, formatarData } from '../js/utils.js';

export default function clienteDetalhe(props, { $h, $onMounted, $f7route, $f7router, $update }) {
  const id = $f7route.params.id;
  let carregando = true;
  let erro = null;
  let cliente = null;

  const ir = (path) => $f7router.navigate(path);

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const res = await api.get(`/users/clientes/${id}/publico`);
      cliente = res.cliente;
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  const eu = loadAuth().user || {};
  const souEu = () => eu.id === Number(id);
  const stats = () => (cliente && cliente.estatisticas) || {};

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Cliente', voltar: true })}
      <div class="page-content">

        ${carregando ? $h`
          <div class="mz-container">
            <div class="skeleton" style="height:150px; border-radius:20px;"></div>
            <div class="skeleton" style="height:180px; border-radius:20px; margin-top:14px;"></div>
          </div>
        ` : erro ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${errorState($h, { mensagem: erro, onRetry: carregar })}
          </div>
        ` : !cliente ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${emptyState($h, { icone: 'person_2', titulo: 'Cliente não encontrado', texto: 'Este perfil pode ter sido removido.' })}
          </div>
        ` : $h`
          <div>

            <div class="perfil-capa">
              ${cliente.capa ? $h`<img src=${assetUrl(cliente.capa)} alt="capa" />` : ''}
            </div>

            <div class="mz-container" style="max-width:640px;">

              <div class="perfil-topo">
                ${renderAvatar($h, cliente, 'avatar-xl')}
                <div class="perfil-topo-info">
                  <div class="perfil-nome">${cliente.nome_empresa && cliente.tipo_cliente === 'empresa' ? cliente.nome_empresa : cliente.nome}</div>
                  <div class="perfil-username">
                    @${cliente.nome_utilizador || cliente.id}
                    · ${cliente.tipo_cliente === 'empresa' ? 'Empresa' : 'Cliente'}
                    ${cliente.nome_empresa && cliente.tipo_cliente !== 'empresa' ? ` · ${cliente.nome_empresa}` : ''}
                  </div>
                  <div style="margin-top:7px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span style="display:inline-flex; align-items:center; gap:4px; font-size:12.5px; color:var(--mz-text-2); font-weight:600;">
                      <i class="f7-icons" style="font-size:13px;">placemark</i>
                      ${cliente.cidade || cliente.provincia || 'Moçambique'}
                    </span>
                    ${cliente.setor ? $h`
                      <span style="display:inline-flex; align-items:center; gap:4px; font-size:12.5px; color:var(--mz-text-2); font-weight:600;">
                        <i class="f7-icons" style="font-size:13px;">briefcase</i> ${cliente.setor}
                      </span>
                    ` : ''}
                  </div>
                  <div style="margin-top:8px;">
                    ${selos($h, cliente, {})}
                  </div>
                </div>
              </div>

              <!-- Estatísticas -->
              <div class="perfil-stats">
                <div class="stat">
                  <div class="valor">${stats().projetos_publicados || 0}</div>
                  <div class="rotulo">projetos</div>
                </div>
                <div class="stat">
                  <div class="valor"><i class="f7-icons">star_fill</i>${stats().avaliacao_media || '0.0'}</div>
                  <div class="rotulo">${stats().total_avaliacoes || 0} avaliações</div>
                </div>
                <div class="stat">
                  <div class="valor">${formatarMoeda(stats().total_investido || 0)}</div>
                  <div class="rotulo">investido</div>
                </div>
                <div class="stat">
                  <div class="valor">${formatarData(cliente.membro_desde).slice(-4)}</div>
                  <div class="rotulo">membro desde</div>
                </div>
              </div>

              ${!souEu() ? $h`
                <div style="display:flex; gap:10px; margin-bottom:16px;">
                  <a class="btn-mz" style="text-decoration:none;" @click=${() => ir(`/messages/${cliente.id}`)}>
                    <i class="f7-icons" style="font-size:15px;">chat_bubble_fill</i> Enviar mensagem
                  </a>
                </div>
              ` : ''}

              <!-- Sobre -->
              <div class="mz-card">
                <div class="secao-titulo" style="margin-bottom:10px;"><i class="f7-icons">person_crop_circle</i> Sobre o cliente</div>
                ${cliente.bio || cliente.sobre_mim
                  ? $h`<p style="margin:0; font-size:14px; line-height:1.65; color:var(--mz-text); white-space:pre-line;">${cliente.bio || cliente.sobre_mim}</p>`
                  : $h`<p class="text-sm text-muted" style="margin:0;">Este cliente ainda não escreveu uma apresentação.</p>`}
                <p class="text-sm text-muted" style="margin:14px 0 0 0;">
                  <i class="f7-icons" style="font-size:12px; vertical-align:-2px;">clock</i>
                  Membro desde ${formatarData(cliente.membro_desde)}
                </p>
              </div>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}
