/* FreelaMZ — Criar projeto (contratar freelancer) */
import { api } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import { navbar, renderAvatar, toast, errorState } from '../js/layout.js';
import { formatarMoeda } from '../js/utils.js';

export default function projectCreate(props, { $h, $onMounted, $f7route, $f7router, $update }) {
  const qs = $f7route.query || {};
  let freelancerId = qs.freelancer ? Number(qs.freelancer) : '';
  let servicoId = qs.servico ? Number(qs.servico) : null;
  let form = { valor: '', prazo: '' };

  let carregando = true;
  let erro = null;
  let freelancer = null;
  let servico = null;
  let freelancers = [];
  let enviando = false;
  let erroForm = '';

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const resF = await api.get('/users/freelancers');
      freelancers = resF.freelancers || [];
      if (freelancerId) {
        freelancer = freelancers.find((f) => f.user_id === freelancerId) || null;
        try {
          const resP = await api.get(`/users/freelancers/${freelancerId}`);
          freelancer = resP.profile || freelancer;
        } catch (e) { /* usa o da lista */ }
      }
      if (servicoId) {
        try {
          const resS = await api.get(`/services/${servicoId}`);
          servico = resS.service;
          if (servico) {
            form.valor = String(servico.preco || '');
            form.prazo = servico.prazo_entrega || '';
            if (!freelancer) freelancerId = servico.freelancer_id;
          }
        } catch (e) { /* segue */ }
      }
      if (freelancer && !form.prazo) {
        form.prazo = '7 dias';
      }
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  const set = (campo) => (e) => { form[campo] = e.target.value; };

  const criar = async (e) => {
    if (e) e.preventDefault();
    if (!freelancerId || !form.valor || !form.prazo) {
      erroForm = 'Escolha o freelancer, o valor e o prazo.';
      $update();
      return;
    }
    erroForm = '';
    enviando = true;
    $update();
    try {
      await api.post('/projects', {
        freelancerId: Number(freelancerId),
        servicoId: servicoId || undefined,
        valor: Number(form.valor),
        prazo: form.prazo,
      });
      toast('Projeto criado e enviado ao freelancer! 🚀', 'success');
      $f7router.navigate('/projects');
    } catch (err) {
      erroForm = err.message || 'Não foi possível criar o projeto.';
      enviando = false;
      $update();
    }
  };

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Criar projeto', voltar: true })}
      <div class="page-content">
        <div class="mz-container" style="max-width:560px;">
          ${carregando ? $h`
            <div class="skeleton" style="height:420px; border-radius:24px;"></div>
          ` : erro ? errorState($h, { mensagem: erro, onRetry: carregar })
          : $h`
            <div class="mz-card" style="padding:24px;">
              ${erroForm ? $h`<div class="mz-badge badge-recusada" style="display:flex; justify-content:center; margin-bottom:14px;">${erroForm}</div>` : ''}

              ${servico ? $h`
                <div class="mz-card" style="background:#eff6ff; border-color:#bfdbfe; margin-bottom:16px;">
                  <div class="fl-top">
                    <div class="svc-icon" style="width:44px; height:44px; border-radius:14px; background:${servico.categoria_cor || '#2563EB'}; display:flex; align-items:center; justify-content:center; color:#fff; font-size:21px;">
                      <i class="f7-icons">${servico.categoria_icone || 'briefcase'}</i>
                    </div>
                    <div>
                      <div class="fl-name">${servico.titulo}</div>
                      <div class="fl-title">${servico.categoria_nome} · ${formatarMoeda(servico.preco)}</div>
                    </div>
                  </div>
                </div>
              ` : ''}

              <form class="mz-form" @submit=${criar}>
                <div>
                  <label class="field-label">Freelancer *</label>
                  ${freelancer ? $h`
                    <div class="mz-card" style="display:flex; align-items:center; gap:12px;">
                      ${renderAvatar($h, freelancer, 'avatar-sm')}
                      <div style="flex:1;">
                        <div class="fl-name">${freelancer.nome}</div>
                        <div class="fl-title">${freelancer.titulo || 'Freelancer'}</div>
                      </div>
                      <a class="btn btn-ghost btn-sm" style="text-decoration:none;" @click=${() => {
                        freelancer = null; freelancerId = ''; $update();
                      }}>Trocar</a>
                    </div>
                  ` : $h`
                    <div class="field-input">
                      <i class="f7-icons">person_2</i>
                      <select value=${freelancerId} @change=${(ev) => {
                        freelancerId = ev.target.value ? Number(ev.target.value) : '';
                        freelancer = freelancers.find((f) => f.user_id === freelancerId) || null;
                        $update();
                      }}>
                        <option value="" disabled selected=${!freelancerId}>Escolha um freelancer…</option>
                        ${freelancers.map((f) => $h`
                          <option value=${f.user_id} selected=${Number(freelancerId) === f.user_id}>
                            ${f.nome} — ${f.titulo || 'Freelancer'}
                          </option>
                        `)}
                      </select>
                    </div>
                  `}
                </div>
                <div>
                  <label class="field-label">Valor do projeto (MT) *</label>
                  <div class="field-input">
                    <i class="f7-icons">money_dollar_circle</i>
                    <input type="number" min="0" step="1" placeholder="Ex.: 4500"
                      value=${form.valor} @input=${set('valor')} />
                  </div>
                </div>
                <div>
                  <label class="field-label">Prazo *</label>
                  <div class="field-input">
                    <i class="f7-icons">clock</i>
                    <input type="text" placeholder="Ex.: 7 dias"
                      value=${form.prazo} @input=${set('prazo')} />
                  </div>
                </div>
                <button class="btn btn-primary btn-block ${enviando ? 'loading' : ''}" type="submit" disabled=${enviando}>
                  Criar projeto
                </button>
              </form>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
