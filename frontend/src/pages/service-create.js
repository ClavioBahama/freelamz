/* FreelaMZ — Publicar novo serviço (freelancer) */
import { api } from '../js/api.js';
import { loadAuth } from '../js/auth.js';
import { navbar, toast } from '../js/layout.js';
import { formatarMoeda } from '../js/utils.js';

export default function serviceCreate(props, { $h, $onMounted, $f7router, $update }) {
  let form = { titulo: '', descricao: '', categoria_id: '', preco: '', prazo_entrega: '' };
  let categorias = [];
  let enviando = false;
  let erro = '';
  let carregandoCats = true;

  $onMounted(async () => {
    try {
      const res = await api.get('/categories');
      categorias = res.categories || [];
    } catch (e) {
      erro = 'Não foi possível carregar categorias: ' + e.message;
    }
    carregandoCats = false;
    $update();
  });

  const set = (campo) => (e) => { form[campo] = e.target.value; };

  const salvar = async (e) => {
    if (e) e.preventDefault();
    if (!form.titulo || !form.descricao || !form.categoria_id || !form.preco || !form.prazo_entrega) {
      erro = 'Preencha todos os campos.';
      $update();
      return;
    }
    erro = '';
    enviando = true;
    $update();
    try {
      await api.post('/services', {
        titulo: form.titulo,
        descricao: form.descricao,
        categoria_id: Number(form.categoria_id),
        preco: Number(form.preco),
        prazo_entrega: form.prazo_entrega,
      });
      toast('Serviço publicado com sucesso! 🎉', 'success');
      $f7router.navigate('/services');
    } catch (err) {
      erro = err.message || 'Não foi possível publicar.';
      enviando = false;
      $update();
    }
  };

  const usuario = loadAuth().user || {};

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Publicar serviço', voltar: true })}
      <div class="page-content">
        <div class="mz-container" style="max-width:560px;">
          ${usuario.tipo_usuario !== 'FREELANCER' ? $h`
            <div class="empty-state">
              <div class="empty-icon"><i class="f7-icons">person_2</i></div>
              <h3>Apenas freelancers</h3>
              <p>Só contas de freelancer podem publicar serviços. Crie uma conta de freelancer para começar.</p>
              <a class="btn btn-primary btn-sm" style="text-decoration:none;" @click=${() => $f7router.navigate('/services')}>Ver serviços</a>
            </div>
          ` : $h`
            <div class="mz-card" style="padding:24px;">
              ${erro ? $h`<div class="mz-badge badge-recusada" style="display:flex; justify-content:center; margin-bottom:14px;">${erro}</div>` : ''}
              <form class="mz-form" @submit=${salvar}>
                <div>
                  <label class="field-label">Título *</label>
                  <div class="field-input">
                    <i class="f7-icons">textformat</i>
                    <input type="text" placeholder="Ex.: Design de logo profissional"
                      value=${form.titulo} @input=${set('titulo')} />
                  </div>
                </div>
                <div>
                  <label class="field-label">Descrição *</label>
                  <div class="field-input">
                    <i class="f7-icons">doc_text</i>
                    <textarea placeholder="Descreva o que está incluído no serviço, número de revisões, o que precisa do cliente…"
                      @input=${set('descricao')}>${form.descricao}</textarea>
                  </div>
                </div>
                <div>
                  <label class="field-label">Categoria *</label>
                  <div class="field-input">
                    <i class="f7-icons">folder</i>
                    <select value=${form.categoria_id} @change=${set('categoria_id')}>
                      <option value="" disabled selected=${!form.categoria_id}>Escolha a categoria…</option>
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
                    <input type="number" min="0" step="1" placeholder="Ex.: 4500"
                      value=${form.preco} @input=${set('preco')} />
                  </div>
                  <div class="field-help">Valor em Meticais (MT). Ex.: 4 500 MT</div>
                </div>
                <div>
                  <label class="field-label">Prazo de entrega *</label>
                  <div class="field-input">
                    <i class="f7-icons">clock</i>
                    <input type="text" placeholder="Ex.: 3 dias"
                      value=${form.prazo_entrega} @input=${set('prazo_entrega')} />
                  </div>
                </div>
                <button class="btn btn-primary btn-block ${enviando ? 'loading' : ''}" type="submit" disabled=${enviando || carregandoCats}>
                  Publicar serviço
                </button>
              </form>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
