/* FreelaMZ — Login */
import { api, setToken } from '../js/api.js';
import { saveAuth } from '../js/auth.js';
import { toast } from '../js/layout.js';

export default function login(props, { $h, $onMounted, $f7route, $f7router, $update }) {
  let email = '';
  let senha = '';
  let enviando = false;
  let erro = '';
  let aviso = '';

  $onMounted(() => {
    if ($f7route && $f7route.query && $f7route.query.expirada) {
      aviso = 'A sua sessão expirou. Entre novamente.';
      $update();
    }
  });

  const setEmail = (e) => { email = e.target.value; };
  const setSenha = (e) => { senha = e.target.value; };

  const entrar = async (e) => {
    if (e) e.preventDefault();
    if (!email || !senha) {
      erro = 'Preencha o email e a senha.';
      $update();
      return;
    }
    erro = '';
    enviando = true;
    $update();
    try {
      const res = await api.post('/auth/login', { email, senha });
      if (res.success && res.token) {
        setToken(res.token);
        saveAuth(res.token, res.user);
        window.freelaMZ.usuario = res.user;
        window.freelaMZ.token = res.token;
        toast(`Bem-vindo de volta, ${(res.user.nome || 'amigo').split(' ')[0]}! 👋`, 'success');
        $f7router.navigate('/dashboard', { reloadAll: true, animate: false });
      } else {
        erro = res.message || 'Não foi possível entrar.';
        enviando = false;
        $update();
      }
    } catch (err) {
      erro = err.message || 'Não foi possível entrar.';
      enviando = false;
      $update();
    }
  };

  return () => $h`
    <div class="page no-navbar">
      <div class="page-content auth-page">
        <div class="auth-card">
          <div class="auth-logo">
            <div class="logo-badge">✨</div>
            <h1>FreelaMZ</h1>
            <p>Encontre talentos. Encontre oportunidades.</p>
          </div>

          ${aviso ? $h`<div class="mz-badge badge-recusada" style="display:flex; justify-content:center; margin-bottom:14px;">${aviso}</div>` : ''}
          ${erro ? $h`<div class="mz-badge badge-recusada" style="display:flex; justify-content:center; margin-bottom:14px;">${erro}</div>` : ''}

          <form class="mz-form" @submit=${entrar}>
            <div>
              <label class="field-label">Email</label>
              <div class="field-input">
                <i class="f7-icons">envelope</i>
                <input type="email" name="email" placeholder="ovoce@exemplo.co.mz" value=${email}
                  @input=${setEmail} autocomplete="email" />
              </div>
            </div>
            <div>
              <label class="field-label">Senha</label>
              <div class="field-input">
                <i class="f7-icons">lock</i>
                <input type="password" name="senha" placeholder="••••••" value=${senha}
                  @input=${setSenha} autocomplete="current-password" />
              </div>
            </div>
            <button class="btn btn-primary btn-block ${enviando ? 'loading' : ''}"
              type="submit" disabled=${enviando}>
              Entrar
            </button>
          </form>

          <div class="auth-footer">
            Não tem conta?
            <a href="/register" @click=${(e) => { e.preventDefault(); $f7router.navigate('/register'); }}>Criar conta grátis</a>
          </div>
        </div>
      </div>
    </div>
  `;
}
