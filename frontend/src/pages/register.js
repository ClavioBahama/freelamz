/* FreelaMZ — Criar conta (cliente ou freelancer) */
import { api, setToken } from '../js/api.js';
import { saveAuth } from '../js/auth.js';
import { toast, renderButton } from '../js/layout.js';

export default function register(props, { $h, $f7router, $update }) {
  let form = {
    nome: '', email: '', telefone: '', senha: '', confirmar: '',
    tipoUsuario: 'CLIENTE', cidade: 'Maputo', provincia: 'Maputo',
  };
  let enviando = false;
  let erro = '';

  const set = (campo) => (e) => { form[campo] = e.target.value; };

  const criarConta = async (e) => {
    if (e) e.preventDefault();
    if (!form.nome || !form.email || !form.senha || !form.tipoUsuario) {
      erro = 'Preencha todos os campos obrigatórios.';
      $update();
      return;
    }
    if (form.senha.length < 6) {
      erro = 'A senha deve ter pelo menos 6 caracteres.';
      $update();
      return;
    }
    if (form.senha !== form.confirmar) {
      erro = 'As senhas não coincidem.';
      $update();
      return;
    }
    erro = '';
    enviando = true;
    $update();
    try {
      const res = await api.post('/auth/register', {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        senha: form.senha,
        tipoUsuario: form.tipoUsuario,
        cidade: form.cidade,
        provincia: form.provincia,
        pais: 'Moçambique',
      });
      if (res.success && res.token) {
        setToken(res.token);
        saveAuth(res.token, res.user);
        window.freelaMZ.usuario = res.user;
        window.freelaMZ.token = res.token;
        toast('Conta criada com sucesso! Bem-vindo(a) ao FreelaMZ 🎉', 'success');
        $f7router.navigate('/dashboard', { reloadAll: true, animate: false });
      } else {
        erro = res.message || 'Não foi possível criar a conta.';
        enviando = false;
        $update();
      }
    } catch (err) {
      erro = err.message || 'Não foi possível criar a conta.';
      enviando = false;
      $update();
    }
  };

  return () => $h`
    <div class="page">
      <div class="navbar">
        <div class="navbar-bg"></div>
        <div class="navbar-inner sliding">
          <div class="left">
            <a class="link" @click=${() => $f7router.back('/login', { force: true })}>
              <i class="f7-icons">chevron_left</i>
            </a>
          </div>
          <div class="title">Criar conta</div>
        </div>
      </div>
      <div class="page-content">
        <div class="mz-container" style="max-width:520px;">
          <div class="mz-card" style="padding:26px;">
            ${erro ? $h`<div class="mz-badge badge-recusada" style="display:flex; justify-content:center; margin-bottom:14px;">${erro}</div>` : ''}

            <form class="mz-form" @submit=${criarConta}>
              <div>
                <label class="field-label">Nome completo *</label>
                <div class="field-input">
                  <i class="f7-icons">person</i>
                  <input type="text" placeholder="Ex.: Ana Maria Sitoe" value=${form.nome} @input=${set('nome')} />
                </div>
              </div>
              <div>
                <label class="field-label">Email *</label>
                <div class="field-input">
                  <i class="f7-icons">envelope</i>
                  <input type="email" placeholder="ovoce@exemplo.co.mz" value=${form.email} @input=${set('email')} />
                </div>
              </div>
              <div>
                <label class="field-label">Telefone</label>
                <div class="field-input">
                  <i class="f7-icons">phone_fill</i>
                  <input type="tel" placeholder="+258 84 000 0000" value=${form.telefone} @input=${set('telefone')} />
                </div>
              </div>
              <div>
                <label class="field-label">Quero…</label>
                <div class="flex gap-2" style="gap:10px;">
                  ${renderButton($h, {
                    icone: 'briefcase', rotulo: 'Contratar',
                    variante: form.tipoUsuario === 'CLIENTE' ? 'primary' : 'ghost',
                    extraStyle: 'flex:1;',
                    onClick: () => { form.tipoUsuario = 'CLIENTE'; $update(); },
                  })}
                  ${renderButton($h, {
                    icone: 'person_2', rotulo: 'Trabalhar',
                    variante: form.tipoUsuario === 'FREELANCER' ? 'primary' : 'ghost',
                    extraStyle: 'flex:1;',
                    onClick: () => { form.tipoUsuario = 'FREELANCER'; $update(); },
                  })}
                </div>
                <div class="field-help">
                  ${form.tipoUsuario === 'FREELANCER'
                    ? 'Como freelancer você cria serviços, envia propostas e recebe projetos.'
                    : 'Como cliente você explora talentos, cria projetos e contrata freelancers.'}
                </div>
              </div>
              <div>
                <label class="field-label">Cidade</label>
                <div class="field-input no-icon">
                  <input type="text" placeholder="Maputo" value=${form.cidade} @input=${set('cidade')} />
                </div>
              </div>
              <div>
                <label class="field-label">Senha *</label>
                <div class="field-input">
                  <i class="f7-icons">lock</i>
                  <input type="password" placeholder="Mínimo 6 caracteres" value=${form.senha} @input=${set('senha')} />
                </div>
              </div>
              <div>
                <label class="field-label">Confirmar senha *</label>
                <div class="field-input">
                  <i class="f7-icons">lock_circle</i>
                  <input type="password" placeholder="Repita a senha" value=${form.confirmar} @input=${set('confirmar')} />
                </div>
              </div>
              <button class="btn btn-primary btn-block ${enviando ? 'loading' : ''}" type="submit" disabled=${enviando}>
                Criar conta
              </button>
            </form>

            <div class="auth-footer">
              Já tem conta?
              <a href="/login" @click=${(e) => { e.preventDefault(); $f7router.navigate('/login'); }}>Entrar</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
