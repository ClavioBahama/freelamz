/* FreelaMZ — Dashboard: saudação, métricas, gráfico e projetos recentes */
import Chart from 'chart.js/auto';
import { api } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import {
  navbar, renderAvatar, statusBadge, skeletonMetricas, skeletonLista, emptyState, errorState,
} from '../js/layout.js';
import { formatarMoeda, formatarData } from '../js/utils.js';

export default function dashboard(props, { $h, $onMounted, $onUnmounted, $onUpdated, $f7router, $update }) {
  let carregando = true;
  let erro = null;
  let dash = null;
  let usuario = loadAuth().user;
  let grafico = null;

  const ir = (path) => $f7router.navigate(path);

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      usuario = loadAuth().user || usuario;
      const res = await api.get('/users/dashboard');
      dash = res.dashboard;
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  const montarGrafico = () => {
    const canvas = document.getElementById('dash-chart');
    if (!canvas || !dash) return;
    if (grafico) { grafico.destroy(); grafico = null; }
    grafico = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Pendentes', 'Em andamento', 'Concluídos'],
        datasets: [{
          data: [
            dash.projetos_pendentes || 0,
            dash.projetos_andamento || 0,
            dash.projetos_concluidos || 0,
          ],
          backgroundColor: ['#FBBF24', '#2563EB', '#10B981'],
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        cutout: '68%',
        plugins: { legend: { display: false } },
        animation: { duration: 600 },
      },
    });
  };

  $onUpdated(montarGrafico);
  $onUnmounted(() => { if (grafico) { grafico.destroy(); grafico = null; } });

  // Computados dentro do render para refletir o utilizador carregado
  const nome = () => ((usuario && usuario.nome) ? usuario.nome.split(' ')[0] : 'amigo(a)');
  const ehFreelancer = () => usuario && usuario.tipo_usuario === 'FREELANCER';

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Dashboard' })}
      <div class="page-content">
        ${carregando ? $h`
          <div class="mz-container">
            <div class="skeleton" style="height:150px; border-radius:26px;"></div>
            <div style="margin-top:18px;">${skeletonMetricas($h, 4)}</div>
            <div class="skeleton sk-line" style="width:50%; height:22px; margin-top:24px;"></div>
            ${skeletonLista($h, 4)}
          </div>
        ` : erro ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${errorState($h, { mensagem: erro, onRetry: carregar })}
          </div>
        ` : $h`
          <div class="mz-container">

            <!-- Saudação -->
            <div class="hero" style="padding:24px 22px;">
              <div>
                <div class="hero-eyebrow">Painel ${ehFreelancer() ? 'do freelancer' : 'do cliente'}</div>
                <div class="hero-title" style="font-size:24px;">Olá, ${nome()} 👋</div>
                <div class="hero-sub">
                  ${ehFreelancer()
                    ? 'Aqui está um resumo do seu trabalho no FreelaMZ.'
                    : 'Aqui está um resumo dos seus projetos e contratações.'}
                </div>
              </div>
            </div>

            <!-- Métricas -->
            <div style="margin-top:18px;" class="mz-grid-4">
              <div class="metric-card metric-blue">
                <div class="metric-icon"><i class="f7-icons">doc_text</i></div>
                <div>
                  <div class="metric-label">Projetos</div>
                  <div class="metric-value">${dash.total_projetos || 0}</div>
                </div>
              </div>
              <div class="metric-card metric-coral">
                <div class="metric-icon"><i class="f7-icons">clock</i></div>
                <div>
                  <div class="metric-label">Em andamento</div>
                  <div class="metric-value">${dash.projetos_andamento || 0}</div>
                </div>
              </div>
              <div class="metric-card metric-green">
                <div class="metric-icon"><i class="f7-icons">checkmark_circle</i></div>
                <div>
                  <div class="metric-label">Concluídos</div>
                  <div class="metric-value">${dash.projetos_concluidos || 0}</div>
                </div>
              </div>
              ${ehFreelancer() ? $h`
                <div class="metric-card metric-amber">
                  <div class="metric-icon"><i class="f7-icons">star_fill</i></div>
                  <div>
                    <div class="metric-label">Avaliação</div>
                    <div class="metric-value">${(dash.rating && dash.rating.media) || '0.0'}★</div>
                    <div class="metric-sub">${(dash.rating && dash.rating.total) || 0} avaliações</div>
                  </div>
                </div>
              ` : $h`
                <div class="metric-card metric-amber">
                  <div class="metric-icon"><i class="f7-icons">money_dollar_circle</i></div>
                  <div>
                    <div class="metric-label">Investido</div>
                    <div class="metric-value" style="font-size:24px;">${formatarMoeda(dash.valor_total_concluido)}</div>
                    <div class="metric-sub">em projetos concluídos</div>
                  </div>
                </div>
              `}
            </div>

            <!-- Carteira (FASE A) -->
            ${dash.financeiro ? $h`
              <a class="mz-card hoverable wallet-strip" style="text-decoration:none;"
                @click=${() => ir('/wallet')}>
                <div>
                  <div class="text-muted text-sm">Saldo da carteira</div>
                  <div class="wallet-strip-valor">${formatarMoeda((dash.financeiro.saldo || 0) / 100)}</div>
                </div>
                <div style="text-align:right;">
                  <div class="text-muted text-sm">${ehFreelancer() ? 'A receber (em escrow)' : 'Em escrow (pagamentos)'}</div>
                  <div class="wallet-strip-valor">${formatarMoeda((dash.financeiro.pendente || 0) / 100)}</div>
                </div>
                <i class="f7-icons" style="font-size:28px; color:var(--mz-green);">creditcard_fill</i>
              </a>
            ` : ''}

            <!-- Gráfico + ações rápidas -->
            <div class="mz-grid" style="grid-template-columns:1fr; margin-top:18px;">
              <div class="mz-card">
                <h3 style="margin:0 0 4px 0;">Projetos por estado</h3>
                <p class="text-muted text-sm" style="margin:0;">Distribuição atual da sua carteira</p>
                <div style="display:flex; align-items:center; gap:18px; margin-top:10px;">
                  <div style="width:150px; height:150px; position:relative;">
                    <canvas id="dash-chart"></canvas>
                  </div>
                  <div class="mz-form" style="gap:10px;">
                    <span class="mz-badge badge-pendente">⬤ ${(dash.projetos_pendentes || 0)} pendentes</span>
                    <span class="mz-badge badge-andamento">⬤ ${(dash.projetos_andamento || 0)} em andamento</span>
                    <span class="mz-badge badge-concluido">⬤ ${(dash.projetos_concluidos || 0)} concluídos</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Ações rápidas -->
            <div class="section-title">Ações rápidas</div>
            <div class="mz-grid-4">
              ${ehFreelancer() ? $h`
                <a class="mz-card hoverable" style="text-decoration:none; text-align:center;" @click=${() => ir('/services/create')}>
                  <i class="f7-icons" style="font-size:30px; color:var(--mz-primary);">plus_circle</i>
                  <div class="font-bold" style="margin-top:8px;">Publicar serviço</div>
                </a>
                <a class="mz-card hoverable" style="text-decoration:none; text-align:center;" @click=${() => ir('/proposals')}>
                  <i class="f7-icons" style="font-size:30px; color:var(--mz-coral);">paperplane</i>
                  <div class="font-bold" style="margin-top:8px;">Minhas propostas</div>
                </a>
                <a class="mz-card hoverable" style="text-decoration:none; text-align:center;" @click=${() => ir('/projects')}>
                  <i class="f7-icons" style="font-size:30px; color:var(--mz-green);">doc_text</i>
                  <div class="font-bold" style="margin-top:8px;">Meus projetos</div>
                </a>
                <a class="mz-card hoverable" style="text-decoration:none; text-align:center;" @click=${() => ir('/messages')}>
                  <i class="f7-icons" style="font-size:30px; color:var(--mz-indigo);">chat_bubble_fill</i>
                  <div class="font-bold" style="margin-top:8px;">Mensagens</div>
                </a>
              ` : $h`
                <a class="mz-card hoverable" style="text-decoration:none; text-align:center;" @click=${() => ir('/freelancers')}>
                  <i class="f7-icons" style="font-size:30px; color:var(--mz-primary);">person_2</i>
                  <div class="font-bold" style="margin-top:8px;">Buscar talentos</div>
                </a>
                <a class="mz-card hoverable" style="text-decoration:none; text-align:center;" @click=${() => ir('/projects/create')}>
                  <i class="f7-icons" style="font-size:30px; color:var(--mz-coral);">plus_circle</i>
                  <div class="font-bold" style="margin-top:8px;">Criar projeto</div>
                </a>
                <a class="mz-card hoverable" style="text-decoration:none; text-align:center;" @click=${() => ir('/proposals')}>
                  <i class="f7-icons" style="font-size:30px; color:var(--mz-amber);">paperplane</i>
                  <div class="font-bold" style="margin-top:8px;">Propostas recebidas</div>
                </a>
                <a class="mz-card hoverable" style="text-decoration:none; text-align:center;" @click=${() => ir('/projects')}>
                  <i class="f7-icons" style="font-size:30px; color:var(--mz-green);">doc_text</i>
                  <div class="font-bold" style="margin-top:8px;">Meus projetos</div>
                </a>
              `}
            </div>

            <!-- Projetos recentes -->
            <div class="section-title">
              <span>Projetos recentes</span>
              <a class="ver-mais" @click=${() => ir('/projects')}>Ver todos →</a>
            </div>
            ${!(dash.projetos_recentes || []).length ? $h`
              ${emptyState($h, {
                icone: 'doc_text',
                titulo: 'Sem projetos ainda',
                texto: ehFreelancer()
                  ? 'Envie propostas a projetos de clientes para começar.'
                  : 'Crie o seu primeiro projeto ou contrate um freelancer.',
                acao: ehFreelancer() ? 'Ver projetos' : 'Criar projeto',
                onAcao: () => ir(ehFreelancer() ? '/projects' : '/projects/create'),
              })}
            ` : $h`
              <div class="mz-list-card">
                ${(dash.projetos_recentes || []).map((p) => $h`
                  <a class="mz-list-item" @click=${() => ir(`/projects/${p.id}`)}>
                    ${renderAvatar($h, ehFreelancer()
                      ? { nome: p.cliente_nome, foto: p.cliente_foto }
                      : { nome: p.freelancer_nome, foto: p.freelancer_foto }, 'avatar-sm')}
                    <div class="mz-list-main">
                      <div class="mz-list-title">${p.servico_titulo || p.titulo || 'Projeto'}</div>
                      <div class="mz-list-sub">
                        ${ehFreelancer() ? 'Cliente: ' + p.cliente_nome : 'Freelancer: ' + p.freelancer_nome}
                        · ${formatarMoeda(p.valor)} · ${formatarData(p.created_at)}
                      </div>
                    </div>
                    ${statusBadge($h, p.status)}
                  </a>
                `)}
              </div>
            `}
          </div>
        `}
      </div>
    </div>
  `;
}
