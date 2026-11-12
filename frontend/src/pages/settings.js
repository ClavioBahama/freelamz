/* FreelaMZ — Configurações: dados básicos, aparência e sessão */
import { api } from '../js/api.js';
import { loadAuth, saveAuth } from '../js/auth.js';
import {
  navbar, renderAvatar, toast, logout, errorState, atualizarPanel, renderButton,
} from '../js/layout.js';

export default function settings(props, { $h, $onMounted, $update }) {
  let usuario = loadAuth().user || {};
  let form = {
    nome: usuario.nome || '',
    email: usuario.email || '',
    telefone: usuario.telefone || '',
    cidade: usuario.cidade || '',
    provincia: usuario.provincia || '',
  };
  let enviando = false;
  let erroForm = '';
  let carregando = false;

  $onMounted(() => { $update(); });

  const set = (campo) => (e) => { form[campo] = e.target.value; };

  const salvarDados = async (e) => {
    if (e) e.preventDefault();
    if (!form.nome || !form.email) {
      erroForm = 'Nome e email são obrigatórios.';
      $update();
      return;
    }
    erroForm = '';
    enviando = true;
    $update();
    try {
      const res = await api.put('/users/me', {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        cidade: form.cidade,
        provincia: form.provincia,
      });
      if (res.user) {
        usuario = { ...usuario, ...res.user };
        saveAuth(loadAuth().token, usuario);
        window.freelaMZ.usuario = usuario;
        atualizarPanel(usuario);
      }
      toast('Dados atualizados! ✅', 'success');
    } catch (err) {
      erroForm = err.message || 'Erro ao salvar.';
    }
    enviando = false;
    $update();
  };

  const limparCache = () => {
    toast('Cache local limpo');
  };

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Configurações' })}
      <div class="page-content">
        <div class="mz-container" style="max-width:560px;">

          ${carregando ? $h`<div class="skeleton" style="height:380px; border-radius:24px;"></div>` : $h`
            <!-- Conta -->
            <div class="section-title">Dados da conta</div>
            <div class="mz-card" style="padding:22px;">
              <div class="detail-row" style="margin-bottom:16px;">
                ${renderAvatar($h, usuario)}
                <div>
                  <div class="fl-name">${usuario.nome || 'Utilizador'}</div>
                  <div class="fl-title">${usuario.email}</div>
                </div>
              </div>
              ${erroForm ? $h`<div class="mz-badge badge-recusada" style="display:flex; justify-content:center; margin-bottom:14px;">${erroForm}</div>` : ''}
              <form class="mz-form" @submit=${salvarDados}>
                <div>
                  <label class="field-label">Nome</label>
                  <div class="field-input">
                    <i class="f7-icons">person</i>
                    <input type="text" value=${form.nome} @input=${set('nome')} />
                  </div>
                </div>
                <div>
                  <label class="field-label">Email</label>
                  <div class="field-input">
                    <i class="f7-icons">envelope</i>
                    <input type="email" value=${form.email} @input=${set('email')} />
                  </div>
                </div>
                <div>
                  <label class="field-label">Telefone</label>
                  <div class="field-input">
                    <i class="f7-icons">phone_fill</i>
                    <input type="tel" value=${form.telefone || ''} @input=${set('telefone')} />
                  </div>
                </div>
                <div>
                  <label class="field-label">Cidade</label>
                  <div class="field-input no-icon">
                    <input type="text" value=${form.cidade || ''} @input=${set('cidade')} />
                  </div>
                </div>
                <div>
                  <label class="field-label">Província</label>
                  <div class="field-input no-icon">
                    <input type="text" value=${form.provincia || ''} @input=${set('provincia')} />
                  </div>
                </div>
                <button class="btn btn-primary btn-block ${enviando ? 'loading' : ''}" type="submit" disabled=${enviando}>
                  Salvar dados
                </button>
              </form>
            </div>

            <!-- Sobre -->
            <div class="section-title">Sobre</div>
            <div class="mz-list-card">
              <div class="mz-list-item">
                <div class="notif-icon-box" style="background:var(--grad-primary); width:38px; height:38px; min-width:38px; border-radius:12px; font-size:17px;">
                  <i class="f7-icons">info_circle</i>
                </div>
                <div class="mz-list-main">
                  <div class="mz-list-title">FreelaMZ</div>
                  <div class="mz-list-sub">Versão 1.0.0 — marketplace de talentos moçambicanos</div>
                </div>
              </div>
              <div class="mz-list-item" @click=${limparCache}>
                <div class="notif-icon-box" style="background:var(--grad-amber); width:38px; height:38px; min-width:38px; border-radius:12px; font-size:17px;">
                  <i class="f7-icons">trash</i>
                </div>
                <div class="mz-list-main">
                  <div class="mz-list-title">Limpar cache local</div>
                  <div class="mz-list-sub">Remove dados temporários do navegador</div>
                </div>
              </div>
            </div>

            <!-- Sessão -->
            <div class="section-title">Sessão</div>
            ${renderButton($h, {
              icone: 'arrow_right_to_line', rotulo: 'Terminar sessão',
              variante: 'danger', bloco: true, onClick: logout,
            })}
          `}
        </div>
      </div>
    </div>
  `;
}
