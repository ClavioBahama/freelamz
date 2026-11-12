/* FreelaMZ — Editar serviço (freelancer dono) */
import { api } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import { navbar, toast, errorState } from '../js/layout.js';

export default function serviceEdit(props, { $h, $onMounted, $f7route, $f7router, $update }) {
  const id = $f7route.params.id;
  let carregando = true;
  let erro = null;
  let form = null; // null enquanto carrega
  let categorias = [];
  let enviando = false;
  let erroForm = '';

  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const [resS, resC] = await Promise.all([
        api.get(`/services/${id}`),
        api.get('/categories'),
      ]);
      const s = resS.service;
      categorias = resC.categories || [];
      const eu = loadAuth().user || {};
      if (!s || s.freelancer_id !== eu.id) {
        erro = 'Você só pode editar os seus próprios serviços.';
      } else {
        form = {
          titulo: s.titulo || '',
          descricao: s.descricao || '',
          categoria_id: String(s.categoria_id || ''),
          preco: String(s.preco || ''),
          prazo_entrega: s.prazo_entrega || '',
        };
      }
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  const set = (campo) => (e) => { form[campo] = e.target.value; };

  const salvar = async (e) => {
    if (e) e.preventDefault();
    if (!form.titulo || !form.descricao || !form.categoria_id || !form.preco || !form.prazo_entrega) {
      erroForm = 'Preencha todos os campos.';
      $update();
      return;
    }
    erroForm = '';
    enviando = true;
    $update();
    try {
      await api.put(`/services/${id}`, {
        titulo: form.titulo,
        descricao: form.descricao,
        categoria_id: Number(form.categoria_id),
        preco: Number(form.preco),
        prazo_entrega: form.prazo_entrega,
      });
      toast('Serviço atualizado! ✅', 'success');
      $f7router.navigate(`/services/${id}`);
    } catch (err) {
      erroForm = err.message || 'Não foi possível salvar.';
      enviando = false;
      $update();
    }
  };

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Editar serviço', voltar: true })}
      <div class="page-content">
        <div class="mz-container" style="max-width:560px;">
          ${carregando ? $h`
            <div class="skeleton" style="height:420px; border-radius:24px;"></div>
          ` : erro ? errorState($h, { mensagem: erro, onRetry: carregar })
          : $h`
            <div class="mz-card" style="padding:24px;">
              ${erroForm ? $h`<div class="mz-badge badge-recusada" style="display:flex; justify-content:center; margin-bottom:14px;">${erroForm}</div>` : ''}
              <form class="mz-form" @submit=${salvar}>
                <div>
                  <label class="field-label">Título *</label>
                  <div class="field-input">
                    <i class="f7-icons">textformat</i>
                    <input type="text" value=${form.titulo} @input=${set('titulo')} />
                  </div>
                </div>
                <div>
                  <label class="field-label">Descrição *</label>
                  <div class="field-input">
                    <i class="f7-icons">doc_text</i>
                    <textarea @input=${set('descricao')}>${form.descricao}</textarea>
                  </div>
                </div>
                <div>
                  <label class="field-label">Categoria *</label>
                  <div class="field-input">
                    <i class="f7-icons">folder</i>
                    <select value=${form.categoria_id} @change=${set('categoria_id')}>
                      ${categorias.map((c) => $h`
                        <option value=${c.id} selected=${String(form.categoria_id) === String(c.id)}>${c.nome}</option>
                      `)}
                    </select>
                  </div>
                </div>
                <div>
                  <label class="field-label">Preço (MT) *</label>
                  <div class="field-input">
                    <i class="f7-icons">money_dollar_circle</i>
                    <input type="number" min="0" step="1" value=${form.preco} @input=${set('preco')} />
                  </div>
                </div>
                <div>
                  <label class="field-label">Prazo de entrega *</label>
                  <div class="field-input">
                    <i class="f7-icons">clock</i>
                    <input type="text" value=${form.prazo_entrega} @input=${set('prazo_entrega')} />
                  </div>
                </div>
                <button class="btn btn-primary btn-block ${enviando ? 'loading' : ''}" type="submit" disabled=${enviando}>
                  Salvar alterações
                </button>
              </form>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
