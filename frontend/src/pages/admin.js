/* FreelaMZ — Painel Admin: estatísticas, gráficos e gestão global
   (utilizadores, serviços, projetos, propostas, avaliações e denúncias) */
import Chart from 'chart.js/auto';
import { api } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import {
  navbar, renderAvatar, statusBadge, toast, skeletonMetricas, skeletonLista, errorState, emptyState, stars,
} from '../js/layout.js';
import { formatarData, formatarMoeda } from '../js/utils.js';

const ABAS = [
  { id: 'geral', rotulo: 'Visão geral' },
  { id: 'usuarios', rotulo: 'Utilizadores' },
  { id: 'servicos', rotulo: 'Serviços' },
  { id: 'projetos', rotulo: 'Projetos' },
  { id: 'propostas', rotulo: 'Propostas' },
  { id: 'avaliacoes', rotulo: 'Avaliações' },
  { id: 'denuncias', rotulo: 'Denúncias' },
  { id: 'financeiro', rotulo: 'Financeiro' },
];

export default function admin(props, { $h, $onMounted, $onUnmounted, $onUpdated, $update, $f7router }) {
  const souAdmin = ((loadAuth().user || {}).tipo_usuario) === 'ADMIN';

  let aba = 'geral';
  let carregando = true;
  let erro = null;
  let stats = null;
  let usuarios = [];
  let servicos = [];
  let projetos = [];
  let propostas = [];
  let avaliacoes = [];
  let denuncias = [];
  /* FASE A: painel financeiro */
  let fin = null;              // stats de /admin/finance
  let saques = [];
  let comissaoNova = '';
  let decidindo = null;        // disputa em decisão (project_id)
  let decisaoForm = { decisao: 'LIBERAR_FREELANCER', percentual: '50', motivo: '' };
  let graficoFin = null;
  let busca = '';
  let editando = null; // utilizador em edição
  let form = {};
  let salvando = false;
  let graficoStatus = null;
  let graficoCategorias = null;

  const ir = (path) => $f7router.navigate(path);

  const carregarAba = async (forcar = false) => {
    carregando = true; erro = null; $update();
    try {
      if (aba === 'geral') {
        if (!stats || forcar) {
          const res = await api.get('/admin/stats');
          stats = res.stats;
        }
      } else if (aba === 'usuarios') {
        const res = await api.get('/admin/users');
        usuarios = res.users || [];
      } else if (aba === 'servicos') {
        const res = await api.get('/admin/services');
        servicos = res.services || [];
      } else if (aba === 'projetos') {
        const res = await api.get('/admin/projects');
        projetos = res.projects || [];
      } else if (aba === 'propostas') {
        const res = await api.get('/admin/proposals');
        propostas = res.proposals || [];
      } else if (aba === 'avaliacoes') {
        const res = await api.get('/admin/reviews');
        avaliacoes = res.reviews || [];
      } else if (aba === 'denuncias') {
        const res = await api.get('/admin/reports');
        denuncias = res.reports || [];
      } else if (aba === 'financeiro') {
        const [f, s] = await Promise.all([
          api.get('/admin/finance'),
          api.get('/admin/withdrawals'),
        ]);
        fin = f.finance || null;
        saques = s.saques || [];
        comissaoNova = ((fin && fin.settings && fin.settings.comissao_percentual) || '10');
      }
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  const mudarAba = (id) => {
    if (aba === id) return;
    aba = id; editando = null; busca = '';
    carregarAba();
  };

  $onMounted(() => {
    if (!souAdmin) {
      toast('Acesso restrito a administradores 🔒', 'error');
      ir('/dashboard');
      return;
    }
    carregarAba();
  });

  const montarGraficos = () => {
    if (!stats || aba !== 'geral') return;    const cS = document.getElementById('admin-chart-status');
    if (cS) {
      if (graficoStatus) graficoStatus.destroy();
      graficoStatus = new Chart(cS, {
        type: 'doughnut',
        data: {
          labels: (stats.projetos_por_status || []).map((s) => s.status),
          datasets: [{
            data: (stats.projetos_por_status || []).map((s) => s.total),
            backgroundColor: ['#FBBF24', '#2563EB', '#7C3AED', '#10B981', '#EF4444'],
            borderWidth: 0,
          }],
        },
        options: { cutout: '66%', plugins: { legend: { display: false } } },
      });
    }
    const cC = document.getElementById('admin-chart-categorias');
    if (cC) {
      if (graficoCategorias) graficoCategorias.destroy();
      graficoCategorias = new Chart(cC, {
        type: 'bar',
        data: {
          labels: (stats.servicos_por_categoria || []).slice(0, 8).map((c) => c.categoria),
          datasets: [{
            data: (stats.servicos_por_categoria || []).slice(0, 8).map((c) => c.total),
            backgroundColor: '#2563EB',
            borderRadius: 8,
            maxBarThickness: 34,
          }],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
        },
      });
    }
  };

  /* Gráfico financeiro: comissões e volume por mês (FASE A) */
  const montarGraficoFin = () => {
    if (!fin || aba !== 'financeiro') return;
    const c = document.getElementById('admin-chart-fin');
    if (!c) return;
    if (graficoFin) graficoFin.destroy();
    const meses = (fin.por_mes || []).map((m) => {
      const [ano, mes] = String(m.mes).split('-');
      return `${mes}/${String(ano).slice(2)}`;
    });
    graficoFin = new Chart(c, {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [
          {
            label: 'Comissões (MT)', data: (fin.por_mes || []).map((m) => Number(m.comissoes) / 100),
            backgroundColor: '#10B981', borderRadius: 8, maxBarThickness: 30,
          },
          {
            label: 'Volume pago (MT)', data: (fin.por_mes || []).map((m) => Number(m.volume) / 100),
            backgroundColor: '#2563EB', borderRadius: 8, maxBarThickness: 30,
          },
        ],
      },
      options: {
        plugins: { legend: { display: true, labels: { boxWidth: 12 } } },
        scales: { y: { beginAtZero: true } },
      },
    });
  };

  $onUpdated(montarGraficos);
  $onUpdated(montarGraficoFin);
  $onUnmounted(() => {
    if (graficoStatus) graficoStatus.destroy();
    if (graficoCategorias) graficoCategorias.destroy();
    if (graficoFin) graficoFin.destroy();
  });

  /* ---------- Ações ---------- */
  const alternarBloqueio = async (u) => {
    try {
      if (u.status === 'bloqueado') {
        await api.put(`/admin/users/${u.id}/unblock`);
        toast(`${u.nome} desbloqueado ✅`, 'success');
      } else {
        await api.put(`/admin/users/${u.id}/block`);
        toast(`${u.nome} bloqueado 🔒`);
      }
      carregarAba(true);
    } catch (e) {
      toast(e.message || 'Erro', 'error');
    }
  };

  const alternarVerificacao = async (u) => {
    try {
      await api.put(`/admin/users/${u.id}/verify`, { verificado: !u.verificado_plataforma });
      toast(u.verificado_plataforma
        ? `Verificação da plataforma removida de ${u.nome}`
        : `${u.nome} verificado pela plataforma ✓`, 'success');
      carregarAba(true);
    } catch (e) {
      toast(e.message || 'Erro', 'error');
    }
  };

  const removerFotoUsuario = async (u) => {
    if (!confirm(`Remover a foto de perfil de ${u.nome}? (use apenas para conteúdo inadequado)`)) return;
    try {
      await api.delete(`/admin/users/${u.id}/avatar`);
      toast('Foto removida pelo administrador');
      carregarAba(true);
    } catch (e) {
      toast(e.message || 'Erro', 'error');
    }
  };

  const abrirEdicao = (u) => {
    editando = u;
    form = { nome: u.nome, email: u.email, telefone: u.telefone || '', tipo: u.tipo_usuario, status: u.status };
    $update();
  };

  const salvarUtilizador = async (e) => {
    e.preventDefault();
    if (salvando) return;
    salvando = true; $update();
    try {
      await api.put(`/admin/users/${editando.id}`, {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        tipo_usuario: form.tipo,
        status: form.status,
      });
      toast('Utilizador atualizado ✅', 'success');
      editando = null;
      await carregarAba(true);
    } catch (err) {
      toast(err.message || 'Erro ao salvar', 'error');
    }
    salvando = false; $update();
  };

  const apagarUtilizador = async (u) => {
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast('Utilizador apagado 🗑️', 'success');
      editando = null;
      await carregarAba(true);
    } catch (err) {
      toast(err.message || 'Erro ao apagar', 'error');
    }
  };

  const apagarServico = async (s) => {
    try {
      await api.delete(`/admin/services/${s.id}`);
      toast('Serviço removido 🗑️', 'success');
      await carregarAba(true);
    } catch (err) {
      toast(err.message || 'Erro ao apagar', 'error');
    }
  };

  const mudarStatusProposta = async (p, status) => {
    try {
      await api.put(`/admin/proposals/${p.id}/status`, { status });
      toast(`Proposta #${p.id} → ${status}`, 'success');
      await carregarAba(true);
    } catch (err) {
      toast(err.message || 'Erro', 'error');
    }
  };

  const apagarAvaliacao = async (r) => {
    try {
      await api.delete(`/admin/reviews/${r.id}`);
      toast('Avaliação removida 🗑️', 'success');
      await carregarAba(true);
    } catch (err) {
      toast(err.message || 'Erro', 'error');
    }
  };

  const resolverDenuncia = async (d, status) => {
    try {
      await api.put(`/admin/reports/${d.id}`, { status });
      toast(status === 'RESOLVIDA' ? 'Denúncia resolvida ✅' : 'Denúncia rejeitada', 'success');
      await carregarAba(true);
    } catch (err) {
      toast(err.message || 'Erro', 'error');
    }
  };

  /* ---------- FASE A: ações financeiras ---------- */
  const salvarComissao = async (e) => {
    e.preventDefault();
    const valor = Number(comissaoNova);
    if (!Number.isFinite(valor)) return toast('Indique a percentagem', 'error');
    try {
      await api.put('/admin/settings', { chave: 'comissao_percentual', valor });
      toast(`Comissão da plataforma: ${valor}% ✅`, 'success');
      await carregarAba(true);
    } catch (err) {
      toast(err.message || 'Erro ao guardar comissão', 'error');
    }
  };

  const abrirDecisao = (d) => {
    decidindo = d.project_id;
    decisaoForm = { decisao: 'LIBERAR_FREELANCER', percentual: '50', motivo: '' };
    $update();
  };

  const decidirDisputa = async (e) => {
    e.preventDefault();
    const d = (fin.disputas || []).find((x) => x.project_id === decidindo);
    if (!d) return;
    if (!decisaoForm.motivo.trim()) return toast('Registre o motivo (auditoria)', 'error');
    try {
      await api.put(`/admin/disputes/${decidindo}/resolve`, {
        decisao: decisaoForm.decisao,
        percentual_freelancer: decisaoForm.decisao === 'DIVIDIR' ? Number(decisaoForm.percentual) : undefined,
        motivo: decisaoForm.motivo.trim(),
      });
      toast('Disputa decidida e registada ⚖️', 'success');
      decidindo = null;
      await carregarAba(true);
    } catch (err) {
      toast(err.message || 'Erro ao decidir disputa', 'error');
    }
    $update();
  };

  const processarSaque = async (s, aprovar) => {
    try {
      await api.put(`/admin/withdrawals/${s.id}`, { aprovar, motivo: aprovar ? 'Aprovado no painel' : 'Recusado no painel' });
      toast(aprovar ? `Saque de ${s.user_nome || ''} concluído 💸` : 'Saque recusado — valor devolvido', 'success');
      await carregarAba(true);
    } catch (err) {
      toast(err.message || 'Erro ao processar saque', 'error');
    }
  };

  /* ---------- Filtros ---------- */
  const usuariosFiltrados = () => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => `${u.nome} ${u.email}`.toLowerCase().includes(q));
  };

  const tipoBadge = (tipo) => (tipo === 'ADMIN' ? 'badge-top' : tipo === 'FREELANCER' ? 'badge-andamento' : 'badge-verificado');

  /* ---------- Render ---------- */
  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Painel Admin' })}
      <div class="page-content">
        <div class="mz-container">

          ${!souAdmin ? $h`
            ${emptyState($h, {
              icone: 'shield',
              titulo: 'Acesso restrito',
              texto: 'Esta área é exclusiva de administradores.',
              acao: 'Voltar ao início',
              onAcao: () => ir('/dashboard'),
            })}
          ` : $h`
            <!-- Abas -->
            <div class="filter-row" style="margin-bottom:16px;">
              ${ABAS.map((t) => $h`
                <button class="filter-pill ${aba === t.id ? 'active' : ''}"
                  @click=${() => mudarAba(t.id)}>${t.rotulo}</button>
              `)}
            </div>

            ${aba === 'geral' ? $h`
              ${carregando ? $h`
                ${skeletonMetricas($h, 8)}
              ` : erro ? errorState($h, { mensagem: erro, onRetry: () => carregarAba(true) })
              : $h`
                <div class="mz-grid-4">
                  <div class="metric-card metric-blue">
                    <div class="metric-icon"><i class="f7-icons">person_2</i></div>
                    <div>
                      <div class="metric-label">Utilizadores</div>
                      <div class="metric-value">${stats.total_usuarios}</div>
                    </div>
                  </div>
                  <div class="metric-card metric-green">
                    <div class="metric-icon"><i class="f7-icons">person_crop_circle</i></div>
                    <div>
                      <div class="metric-label">Freelancers</div>
                      <div class="metric-value">${stats.total_freelancers}</div>
                    </div>
                  </div>
                  <div class="metric-card metric-coral">
                    <div class="metric-icon"><i class="f7-icons">briefcase</i></div>
                    <div>
                      <div class="metric-label">Serviços</div>
                      <div class="metric-value">${stats.total_servicos}</div>
                    </div>
                  </div>
                  <div class="metric-card metric-amber">
                    <div class="metric-icon"><i class="f7-icons">doc_text</i></div>
                    <div>
                      <div class="metric-label">Projetos</div>
                      <div class="metric-value">${stats.total_projetos}</div>
                    </div>
                  </div>
                  <div class="metric-card metric-blue">
                    <div class="metric-icon"><i class="f7-icons">doc_plaintext</i></div>
                    <div>
                      <div class="metric-label">Propostas</div>
                      <div class="metric-value">${stats.total_propostas}</div>
                    </div>
                  </div>
                  <div class="metric-card metric-navy">
                    <div class="metric-icon"><i class="f7-icons">star</i></div>
                    <div>
                      <div class="metric-label">Avaliações</div>
                      <div class="metric-value">${stats.total_avaliacoes}</div>
                    </div>
                  </div>
                  <div class="metric-card metric-coral">
                    <div class="metric-icon"><i class="f7-icons">flag</i></div>
                    <div>
                      <div class="metric-label">Denúncias pendentes</div>
                      <div class="metric-value">${stats.denuncias_pendentes}</div>
                    </div>
                  </div>
                  <div class="metric-card metric-navy">
                    <div class="metric-icon"><i class="f7-icons">person_crop_circle_badge_xmark</i></div>
                    <div>
                      <div class="metric-label">Bloqueados</div>
                      <div class="metric-value">${stats.total_bloqueados}</div>
                    </div>
                  </div>
                </div>

                <div class="mz-grid" style="margin-top:18px;">
                  <div class="mz-card">
                    <h3 style="margin:0 0 10px 0;">Projetos por estado</h3>
                    <div style="height:230px; position:relative;">
                      <canvas id="admin-chart-status"></canvas>
                    </div>
                  </div>
                  <div class="mz-card">
                    <h3 style="margin:0 0 10px 0;">Serviços por categoria</h3>
                    <div style="height:230px; position:relative;">
                      <canvas id="admin-chart-categorias"></canvas>
                    </div>
                  </div>
                </div>
              `}

            ` : carregando ? $h`
              ${skeletonLista($h, 6)}
            ` : erro ? errorState($h, { mensagem: erro, onRetry: () => carregarAba(true) })
            : $h`
              ${aba === 'usuarios' ? $h`
                <div class="field-input" style="margin-bottom:14px;">
                  <i class="f7-icons">search</i>
                  <input type="text" placeholder="Buscar por nome ou email…"
                    value=${busca} @input=${(e) => { busca = e.target.value; $update(); }} />
                </div>

                ${editando ? $h`
                  <div class="mz-card" style="padding:20px; margin-bottom:16px;">
                    <div class="section-title" style="margin-bottom:12px;">Editar: ${editando.nome}</div>
                    <form class="mz-form" @submit=${salvarUtilizador}>
                      <div>
                        <label class="field-label">Nome</label>
                        <div class="field-input">
                          <i class="f7-icons">person_2</i>
                          <input type="text" value=${form.nome}
                            @input=${(e) => { form.nome = e.target.value; $update(); }} />
                        </div>
                      </div>
                      <div>
                        <label class="field-label">Email</label>
                        <div class="field-input">
                          <i class="f7-icons">at_circle</i>
                          <input type="email" value=${form.email}
                            @input=${(e) => { form.email = e.target.value; $update(); }} />
                        </div>
                      </div>
                      <div>
                        <label class="field-label">Telefone</label>
                        <div class="field-input">
                          <i class="f7-icons">phone_fill</i>
                          <input type="text" value=${form.telefone}
                            @input=${(e) => { form.telefone = e.target.value; $update(); }} />
                        </div>
                      </div>
                      <div>
                        <label class="field-label">Tipo de conta</label>
                        <div class="field-input">
                          <i class="f7-icons">person_crop_circle</i>
                          <select value=${form.tipo} @change=${(e) => { form.tipo = e.target.value; $update(); }}>
                            <option value="CLIENTE" selected=${form.tipo === 'CLIENTE'}>CLIENTE</option>
                            <option value="FREELANCER" selected=${form.tipo === 'FREELANCER'}>FREELANCER</option>
                            <option value="ADMIN" selected=${form.tipo === 'ADMIN'}>ADMIN</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label class="field-label">Status</label>
                        <div class="field-input">
                          <i class="f7-icons">checkmark</i>
                          <select value=${form.status} @change=${(e) => { form.status = e.target.value; $update(); }}>
                            <option value="ativo" selected=${form.status === 'ativo'}>ativo</option>
                            <option value="bloqueado" selected=${form.status === 'bloqueado'}>bloqueado</option>
                            <option value="inativo" selected=${form.status === 'inativo'}>inativo</option>
                          </select>
                        </div>
                      </div>
                      <div style="display:flex; gap:10px;">
                        <button class="btn btn-primary" type="submit" disabled=${salvando}>
                          ${salvando ? 'A guardar…' : 'Guardar'}
                        </button>
                        <button class="btn btn-danger" type="button" @click=${() => apagarUtilizador(editando)}>Apagar</button>
                        <button class="btn" type="button"
                          @click=${() => { editando = null; $update(); }}>Cancelar</button>
                      </div>
                    </form>
                  </div>
                ` : ''}

                <div class="section-title">Utilizadores (${usuariosFiltrados().length})</div>
                <div class="mz-list-card">
                  ${usuariosFiltrados().length === 0 ? $h`
                    ${emptyState($h, { icone: 'person_2', titulo: 'Nenhum resultado', texto: 'Nenhum utilizador corresponde à busca.' })}
                  ` : usuariosFiltrados().map((u) => $h`
                    <div class="admin-user-row">
                      ${renderAvatar($h, u, 'avatar-sm')}
                      <div class="mz-list-main">
                        <div class="mz-list-title">${u.nome}${u.verificado_plataforma ? ' ✓' : ''}</div>
                        <div class="mz-list-sub">${u.email} · ${formatarData(u.created_at)}</div>
                      </div>
                      <span class="mz-badge ${tipoBadge(u.tipo_usuario)}">${u.tipo_usuario}</span>
                      ${statusBadge($h, u.status)}
                      <a class="btn ${u.verificado_plataforma ? 'btn-danger' : 'btn-green'} btn-sm" style="text-decoration:none;"
                        title="Selo de verificação da plataforma"
                        @click=${() => alternarVerificacao(u)}>
                        ${u.verificado_plataforma ? 'Desverificar' : 'Verificar'}
                      </a>
                      ${u.foto ? $h`
                        <a class="btn btn-sm" style="text-decoration:none;" title="Remover foto inadequada"
                          @click=${() => removerFotoUsuario(u)}>Foto</a>
                      ` : ''}
                      ${u.tipo_usuario !== 'ADMIN' ? $h`
                        <a class="btn ${u.status === 'bloqueado' ? 'btn-green' : 'btn-danger'} btn-sm" style="text-decoration:none;"
                          @click=${() => alternarBloqueio(u)}>
                          ${u.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                        </a>
                      ` : ''}
                      <a class="btn btn-sm" style="text-decoration:none;"
                        @click=${() => abrirEdicao(u)}>Editar</a>
                    </div>
                  `)}
                </div>
              ` : ''}

              ${aba === 'servicos' ? $h`
                <div class="section-title">Serviços (${servicos.length})</div>
                <div class="mz-list-card">
                  ${servicos.length === 0 ? $h`
                    ${emptyState($h, { icone: 'briefcase', titulo: 'Sem serviços' })}
                  ` : servicos.map((s) => $h`
                    <div class="admin-user-row">
                      <div class="mz-list-main">
                        <div class="mz-list-title">${s.titulo}</div>
                        <div class="mz-list-sub">${s.freelancer_nome || ''} · ${s.categoria_nome || ''} · ${formatarMoeda(s.preco)}</div>
                      </div>
                      ${statusBadge($h, s.status)}
                      <a class="btn btn-danger btn-sm" style="text-decoration:none;"
                        @click=${() => apagarServico(s)}>Apagar</a>
                    </div>
                  `)}
                </div>
              ` : ''}

              ${aba === 'projetos' ? $h`
                <div class="section-title">Projetos (${projetos.length})</div>
                <div class="mz-list-card">
                  ${projetos.length === 0 ? $h`
                    ${emptyState($h, { icone: 'doc_text', titulo: 'Sem projetos' })}
                  ` : projetos.map((p) => $h`
                    <div class="admin-user-row">
                      <div class="mz-list-main">
                        <div class="mz-list-title">${p.servico_titulo || ('Projeto #' + p.id)}</div>
                        <div class="mz-list-sub">${p.cliente_nome || ''} → ${p.freelancer_nome || ''} · ${formatarMoeda(p.valor)} · ${formatarData(p.created_at)}</div>
                      </div>
                      ${statusBadge($h, p.status)}
                    </div>
                  `)}
                </div>
              ` : ''}

              ${aba === 'propostas' ? $h`
                <div class="section-title">Propostas (${propostas.length})</div>
                <div class="mz-list-card">
                  ${propostas.length === 0 ? $h`
                    ${emptyState($h, { icone: 'doc_plaintext', titulo: 'Sem propostas' })}
                  ` : propostas.map((p) => $h`
                    <div class="admin-user-row">
                      <div class="mz-list-main">
                        <div class="mz-list-title">${p.freelancer_nome} → ${p.projeto_titulo || ('Projeto #' + p.projeto_id)}</div>
                        <div class="mz-list-sub">${formatarMoeda(p.preco)} · ${p.prazo} · cliente: ${p.cliente_nome || ''}</div>
                      </div>
                      ${statusBadge($h, p.status)}
                      ${p.status !== 'ACEITA' ? $h`
                        <a class="btn btn-green btn-sm" style="text-decoration:none;"
                          @click=${() => mudarStatusProposta(p, 'ACEITA')}>Aceitar</a>
                      ` : ''}
                      ${p.status === 'PENDENTE' ? $h`
                        <a class="btn btn-danger btn-sm" style="text-decoration:none;"
                          @click=${() => mudarStatusProposta(p, 'RECUSADA')}>Recusar</a>
                      ` : ''}
                    </div>
                  `)}
                </div>
              ` : ''}

              ${aba === 'avaliacoes' ? $h`
                <div class="section-title">Avaliações (${avaliacoes.length})</div>
                <div class="mz-list-card">
                  ${avaliacoes.length === 0 ? $h`
                    ${emptyState($h, { icone: 'star', titulo: 'Sem avaliações' })}
                  ` : avaliacoes.map((r) => $h`
                    <div class="admin-user-row">
                      <div class="mz-list-main">
                        <div class="mz-list-title">${r.avaliador_nome} → ${r.avaliado_nome} ${stars($h, r.nota)}</div>
                        <div class="mz-list-sub">${r.projeto_titulo ? (r.projeto_titulo + ' · ') : ''}${formatarData(r.created_at)}</div>
                        ${r.comentario ? $h`<div class="mz-list-sub" style="margin-top:4px;">"${r.comentario}"</div>` : ''}
                      </div>
                      <a class="btn btn-danger btn-sm" style="text-decoration:none;"
                        @click=${() => apagarAvaliacao(r)}>Apagar</a>
                    </div>
                  `)}
                </div>
              ` : ''}

              ${aba === 'denuncias' ? $h`
                <div class="section-title">Denúncias (${denuncias.length})</div>
                <div class="mz-list-card">
                  ${denuncias.length === 0 ? $h`
                    ${emptyState($h, { icone: 'flag', titulo: 'Sem denúncias', texto: 'Nada pendente. Boa notícia! 🎉' })}
                  ` : denuncias.map((d) => $h`
                    <div class="admin-user-row">
                      <div class="mz-list-main">
                        <div class="mz-list-title">${d.motivo} (${d.tipo} #${d.alvo_id})</div>
                        <div class="mz-list-sub">Por ${d.denunciante_nome} · ${formatarData(d.created_at)}</div>
                        ${d.descricao ? $h`<div class="mz-list-sub" style="margin-top:4px;">"${d.descricao}"</div>` : ''}
                      </div>
                      ${statusBadge($h, d.status)}
                      ${d.status === 'PENDENTE' ? $h`
                        <a class="btn btn-green btn-sm" style="text-decoration:none;"
                          @click=${() => resolverDenuncia(d, 'RESOLVIDA')}>Resolver</a>
                        <a class="btn btn-danger btn-sm" style="text-decoration:none;"
                          @click=${() => resolverDenuncia(d, 'REJEITADA')}>Rejeitar</a>
                      ` : ''}
                    </div>
                  `)}
                </div>
              ` : ''}
              ${aba === 'financeiro' ? $h`
                ${!fin ? $h`<div class="text-muted" style="padding:20px 0;">Sem dados financeiros.</div>` : $h`
                  <div class="mz-grid-4">
                    <div class="metric-card metric-green">
                      <div class="metric-icon"><i class="f7-icons">percent</i></div>
                      <div>
                        <div class="metric-label">Comissões (liberadas)</div>
                        <div class="metric-value" style="font-size:24px;">${formatarMoeda(fin.comissoes_total / 100)}</div>
                      </div>
                    </div>
                    <div class="metric-card metric-blue">
                      <div class="metric-icon"><i class="f7-icons">lock_fill</i></div>
                      <div>
                        <div class="metric-label">Escrow retido</div>
                        <div class="metric-value" style="font-size:24px;">${formatarMoeda(fin.escrow_retido / 100)}</div>
                        <div class="metric-sub">${fin.escrow_retido_n} projeto(s)</div>
                      </div>
                    </div>
                    <div class="metric-card metric-coral">
                      <div class="metric-icon"><i class="f7-icons">scale_3d</i></div>
                      <div>
                        <div class="metric-label">Em disputa</div>
                        <div class="metric-value" style="font-size:24px;">${formatarMoeda(fin.escrow_disputa / 100)}</div>
                        <div class="metric-sub">${fin.disputas_n} disputa(s)</div>
                      </div>
                    </div>
                    <div class="metric-card metric-amber">
                      <div class="metric-icon"><i class="f7-icons">arrow_down_circle_fill</i></div>
                      <div>
                        <div class="metric-label">Saques pendentes</div>
                        <div class="metric-value" style="font-size:24px;">${formatarMoeda(fin.saques_pendentes_total / 100)}</div>
                        <div class="metric-sub">${fin.saques_pendentes_n} pedido(s)</div>
                      </div>
                    </div>
                    <div class="metric-card metric-green">
                      <div class="metric-icon"><i class="f7-icons">lock_open_fill</i></div>
                      <div>
                        <div class="metric-label">Liberado aos freelancers</div>
                        <div class="metric-value" style="font-size:24px;">${formatarMoeda(fin.liberado_total / 100)}</div>
                      </div>
                    </div>
                    <div class="metric-card metric-navy">
                      <div class="metric-icon"><i class="f7-icons">arrow_uturn_left</i></div>
                      <div>
                        <div class="metric-label">Reembolsado</div>
                        <div class="metric-value" style="font-size:24px;">${formatarMoeda(fin.reembolsado_total / 100)}</div>
                      </div>
                    </div>
                  </div>

                  <!-- Comissões e volume por mês -->
                  <div class="mz-card" style="margin-top:18px;">
                    <h3 style="margin:0 0 10px 0;">Comissões e volume por mês (últimos 6 meses)</h3>
                    <div style="height:260px; position:relative;">
                      <canvas id="admin-chart-fin"></canvas>
                    </div>
                  </div>

                  <!-- Comissão editável -->
                  <div class="mz-card" style="padding:18px; margin-top:16px;">
                    <div class="section-title" style="margin:0 0 10px 0;">Comissão da plataforma</div>
                    <form class="mz-form" @submit=${salvarComissao}>
                      <div>
                        <label class="field-label">Percentagem (%) — 0 a 30</label>
                        <div class="field-input">
                          <i class="f7-icons">percent</i>
                          <input type="number" min="0" max="30" step="0.5"
                            value=${comissaoNova} @input=${(e) => { comissaoNova = e.target.value; }} />
                        </div>
                      </div>
                      <button class="btn btn-primary" type="submit">Guardar comissão</button>
                    </form>
                  </div>

                  <!-- Disputas -->
                  <div class="section-title">Disputas (${(fin.disputas || []).length})</div>
                  ${(fin.disputas || []).length === 0 ? $h`
                    ${emptyState($h, { icone: 'scale_3d', titulo: 'Sem disputas', texto: 'Nada em análise. Boa notícia! 🎉' })}
                  ` : $h`
                    <div class="mz-list-card">
                      ${(fin.disputas || []).map((d) => $h`
                        <div class="admin-user-row" style="align-items:flex-start;">
                          <div class="mz-list-main">
                            <div class="mz-list-title">
                              ${d.project_titulo || ('Projeto #' + d.project_id)} · ${formatarMoeda(d.amount_held / 100)}
                            </div>
                            <div class="mz-list-sub">
                              Cliente: ${d.cliente_nome} · Freelancer: ${d.freelancer_nome} · ${formatarData(d.updated_at)}
                            </div>
                            <div class="mz-list-sub" style="margin-top:4px;">Motivo: "${d.dispute_reason}"</div>
                            ${decidindo === d.project_id ? $h`
                              <form class="mz-form" style="margin-top:12px;" @submit=${decidirDisputa}>
                                <div>
                                  <label class="field-label">Decisão</label>
                                  <div class="field-input">
                                    <i class="f7-icons">scale_3d</i>
                                    <select value=${decisaoForm.decisao}
                                      @change=${(e) => { decisaoForm.decisao = e.target.value; $update(); }}>
                                      <option value="LIBERAR_FREELANCER" selected=${decisaoForm.decisao === 'LIBERAR_FREELANCER'}>
                                        Liberar ao freelancer (com comissão)</option>
                                      <option value="REEMBOLSAR_CLIENTE" selected=${decisaoForm.decisao === 'REEMBOLSAR_CLIENTE'}>
                                        Reembolsar o cliente (total)</option>
                                      <option value="DIVIDIR" selected=${decisaoForm.decisao === 'DIVIDIR'}>
                                        Dividir por percentagem</option>
                                    </select>
                                  </div>
                                </div>
                                ${decisaoForm.decisao === 'DIVIDIR' ? $h`
                                  <div>
                                    <label class="field-label">Percentagem para o freelancer (%)</label>
                                    <div class="field-input">
                                      <i class="f7-icons">percent</i>
                                      <input type="number" min="0" max="100"
                                        value=${decisaoForm.percentual}
                                        @input=${(e) => { decisaoForm.percentual = e.target.value; }} />
                                    </div>
                                  </div>
                                ` : ''}
                                <div>
                                  <label class="field-label">Motivo da decisão (auditoria)</label>
                                  <div class="field-input">
                                    <i class="f7-icons">chat_bubble_text</i>
                                    <textarea rows="2" placeholder="Explique a decisão…"
                                      @input=${(e) => { decisaoForm.motivo = e.target.value; }}>${decisaoForm.motivo}</textarea>
                                  </div>
                                </div>
                                <div style="display:flex; gap:10px;">
                                  <button class="btn btn-primary" type="submit">Aplicar decisão</button>
                                  <button class="btn" type="button"
                                    @click=${() => { decidindo = null; $update(); }}>Cancelar</button>
                                </div>
                              </form>
                            ` : $h`
                              <div style="margin-top:8px;">
                                <a class="btn btn-primary btn-sm" style="text-decoration:none;"
                                  @click=${() => abrirDecisao(d)}>Decidir</a>
                              </div>
                            `}
                          </div>
                          ${statusBadge($h, d.status)}
                        </div>
                      `)}
                    </div>
                  `}

                  <!-- Saques -->
                  <div class="section-title">Saques (${saques.length})</div>
                  ${saques.length === 0 ? $h`
                    ${emptyState($h, { icone: 'arrow_down_circle', titulo: 'Sem saques' })}
                  ` : $h`
                    <div class="mz-list-card">
                      ${saques.map((s) => $h`
                        <div class="admin-user-row">
                          <div class="mz-list-main">
                            <div class="mz-list-title">${s.user_nome} · ${formatarMoeda(s.valor / 100)}</div>
                            <div class="mz-list-sub">${s.metodo} → ${s.destino} · ${formatarData(s.created_at)}</div>
                          </div>
                          ${statusBadge($h, s.status)}
                          ${s.status === 'PENDENTE' ? $h`
                            <a class="btn btn-green btn-sm" style="text-decoration:none;"
                              @click=${() => processarSaque(s, true)}>Aprovar</a>
                            <a class="btn btn-danger btn-sm" style="text-decoration:none;"
                              @click=${() => processarSaque(s, false)}>Recusar</a>
                          ` : ''}
                        </div>
                      `)}
                    </div>
                  `}

                  <!-- Transações recentes -->
                  <div class="section-title">Transações recentes</div>
                  <div class="mz-list-card">
                    ${(fin.transacoes_recentes || []).length === 0 ? $h`
                      ${emptyState($h, { icone: 'doc_text_search', titulo: 'Sem transações' })}
                    ` : (fin.transacoes_recentes || []).map((t) => $h`
                      <div class="mz-list-item">
                        <i class="f7-icons" style="font-size:20px; color:var(--mz-primary);">money_yen_circle</i>
                        <div class="mz-list-main">
                          <div class="mz-list-title">${t.tipo} · ${formatarMoeda(t.valor / 100)}</div>
                          <div class="mz-list-sub">
                            ${(t.origem_nome || '—')} → ${(t.destino_nome || 'plataforma')} · ${formatarData(t.created_at)}
                          </div>
                          ${t.descricao ? $h`<div class="mz-list-sub" style="margin-top:2px;">${t.descricao}</div>` : ''}
                        </div>
                        <span class="mz-badge badge-pendente">${t.reference || ''}</span>
                      </div>
                    `)}
                  </div>
                `}
              ` : ''}
            `}
          `}
        </div>
      </div>
    </div>
  `;
}
