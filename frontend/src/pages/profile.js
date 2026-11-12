/* ============================================================
   FreelaMZ — Meu perfil (conta rica)
   Abas: Geral · Profissional · Portfólio · Pagamentos · Segurança
   - Upload de avatar (2 MB) e capa (4 MB) com pré-visualização
   - Completude X% com checklist clicável
   - Portfólio com 1-4 imagens por item e photo browser
   - Métodos de recebimento (privados, só o dono vê)
   - Verificação de telefone (DEV: código 123456) e alteração de senha
   ============================================================ */
import { api, assetUrl } from '../js/api.js';
import { loadAuth, saveAuth } from '../js/auth.js';
import {
  navbar, renderAvatar, selos, toast, errorState, atualizarPanel, aplicarNavbarAvatar,
} from '../js/layout.js';

const PROVINCIAS = [
  'Maputo Cidade', 'Maputo', 'Gaza', 'Inhambane', 'Sofala',
  'Manica', 'Tete', 'Zambézia', 'Nampula', 'Cabo Delgado', 'Niassa',
];
const IDIOMAS_SUGERIDOS = [
  'Português', 'Inglês', 'Changana', 'Emakhuwa', 'Xitswa', 'Cisena',
  'Elomwe', 'Chope', 'Ronga', 'Koti', 'Bitonga', 'Suaíli', 'Francês', 'Espanhol', 'Chinês',
];

export default function profile(props, { $h, $onMounted, $update }) {
  let carregando = true;
  let erro = null;
  let usuario = null;
  let perfil = null;         // perfil profissional (freelancer)
  let completude = { percentual: 0, itens: [] };
  let categorias = [];
  let portfolio = [];
  let aba = 'geral';

  /* formulários */
  let formGeral = {};
  let formProf = {};
  let formPagamentos = { mpesa: '', emola: '', mkesh: '', banco: '' };
  let enviandoGeral = false;
  let enviandoProf = false;
  let enviandoPag = false;
  let enviandoSenha = false;
  let erroGeral = '';
  let erroProf = '';
  let enviandoFoto = false;

  /* senha */
  let senhaAtual = '';
  let senhaNova = '';
  let senhaConf = '';

  /* telefone */
  let codigoTel = '';
  let esperandoCodigo = false;

  /* portfólio */
  let portFormAberto = false;
  let portEditando = null;   // item em edição
  let portTitulo = '';
  let portDescricao = '';
  let portLink = '';
  let portFicheiros = [];    // File[]
  let portPreviews = [];     // dataURL[]
  let enviandoPort = false;

  /* photo browser simples */
  let fotos = [];
  let fotoIdx = 0;

  /* ---------- carregamento ---------- */
  const carregar = async () => {
    carregando = true; erro = null; $update();
    try {
      const me = await api.get('/auth/me');
      usuario = me.user;
      saveAuth(loadAuth().token, usuario);
      window.freelaMZ.usuario = usuario;
      atualizarPanel(usuario);
      aplicarNavbarAvatar();

      const [resC, resComp] = await Promise.all([
        api.get('/categories').catch(() => ({ categories: [] })),
        api.get('/users/me/completude').catch(() => null),
      ]);
      categorias = resC.categories || [];
      if (resComp && resComp.completude) completude = resComp.completude;

      if (usuario.tipo_usuario === 'FREELANCER') {
        const [resP, resPort] = await Promise.all([
          api.get('/users/profile'),
          api.get(`/users/${usuario.id}/portfolio`),
        ]);
        perfil = resP.profile || {};
        portfolio = resPort.itens || [];
        if (perfil.completude) completude = perfil.completude;
        formProf = {
          titulo: perfil.titulo || '',
          descricao: perfil.descricao || '',
          categoria_id: perfil.categoria_id ? String(perfil.categoria_id) : '',
          nivel: perfil.nivel || 'iniciante',
          anos_experiencia: String(perfil.anos_experiencia || 0),
          habilidades: perfil.habilidades || [],
          preco_por_hora: String(perfil.preco_por_hora || ''),
          disponibilidade: perfil.disponibilidade || 'disponivel',
          localizacao: perfil.localizacao || '',
        };
        const met = perfil.metodos_recebimento || {};
        formPagamentos = {
          mpesa: met.mpesa || '', emola: met.emola || '',
          mkesh: met.mkesh || '', banco: met.banco || '',
        };
      }

      formGeral = {
        nome: usuario.nome || '',
        nome_utilizador: usuario.nome_utilizador || '',
        bio: usuario.bio || '',
        sobre_mim: usuario.sobre_mim || '',
        telefone: usuario.telefone || '',
        whatsapp: usuario.whatsapp || '',
        provincia: usuario.provincia || '',
        cidade: usuario.cidade || '',
        idiomas: usuario.idiomas ? String(usuario.idiomas).split(',').map((s) => s.trim()).filter(Boolean) : [],
        linkedin: usuario.linkedin || '',
        instagram: usuario.instagram || '',
        facebook: usuario.facebook || '',
        site_pessoal: usuario.site_pessoal || '',
        tipo_cliente: usuario.tipo_cliente || 'pessoa',
        nome_empresa: usuario.nome_empresa || '',
        setor: usuario.setor || '',
        tamanho_equipa: usuario.tamanho_equipa || '',
      };
    } catch (e) {
      erro = e.message;
    }
    carregando = false;
    $update();
  };

  $onMounted(carregar);

  const souFreelancer = () => usuario && usuario.tipo_usuario === 'FREELANCER';

  const setGeral = (campo) => (e) => { formGeral[campo] = e.target.value; };
  const setProf = (campo) => (e) => { formProf[campo] = e.target.value; };
  const setPag = (campo) => (e) => { formPagamentos[campo] = e.target.value; };

  /* ---------- tags (habilidades / idiomas) ---------- */
  const addTag = (form, campo, max = 15) => (e) => {
    if (e.key !== 'Enter' && e.type !== 'blur') return;
    if (e.key === 'Enter') e.preventDefault();
    const input = e.target;
    const v = (input.value || '').trim().replace(/,+$/, '');
    if (!v) return;
    const arr = form[campo];
    if (arr.length >= max) { toast(`Máximo de ${max} itens`); return; }
    if (!arr.some((x) => x.toLowerCase() === v.toLowerCase())) arr.push(v);
    input.value = '';
    $update();
  };
  const removeTag = (form, campo, i) => () => {
    form[campo].splice(i, 1);
    $update();
  };

  /* ---------- salvar (geral) ---------- */
  const salvarGeral = async (e) => {
    if (e) e.preventDefault();
    if (!formGeral.nome || formGeral.nome.trim().length < 2) {
      erroGeral = 'Nome inválido.'; $update(); return;
    }
    erroGeral = '';
    enviandoGeral = true; $update();
    try {
      const payload = {
        nome: formGeral.nome,
        nome_utilizador: formGeral.nome_utilizador,
        bio: formGeral.bio,
        sobre_mim: formGeral.sobre_mim,
        telefone: formGeral.telefone,
        whatsapp: formGeral.whatsapp,
        provincia: formGeral.provincia,
        cidade: formGeral.cidade,
        idiomas: formGeral.idiomas.join(', '),
        linkedin: formGeral.linkedin,
        instagram: formGeral.instagram,
        facebook: formGeral.facebook,
        site_pessoal: formGeral.site_pessoal,
      };
      if (!souFreelancer()) {
        payload.tipo_cliente = formGeral.tipo_cliente;
        payload.nome_empresa = formGeral.nome_empresa;
        payload.setor = formGeral.setor;
        payload.tamanho_equipa = formGeral.tamanho_equipa;
      }
      const res = await api.put('/users/me', payload);
      if (res.user) {
        usuario = { ...usuario, ...res.user };
        saveAuth(loadAuth().token, usuario);
        window.freelaMZ.usuario = usuario;
        atualizarPanel(usuario);
      }
      toast('Dados atualizados! ✅', 'success');
      const resComp = await api.get('/users/me/completude').catch(() => null);
      if (resComp && resComp.completude) completude = resComp.completude;
    } catch (err) {
      erroGeral = err.message || 'Erro ao salvar.';
    }
    enviandoGeral = false; $update();
  };

  /* ---------- salvar (profissional) ---------- */
  const salvarProfissional = async (e) => {
    if (e) e.preventDefault();
    if (!formProf.titulo || !formProf.preco_por_hora) {
      erroProf = 'Preencha o título profissional e o preço por hora.'; $update(); return;
    }
    erroProf = '';
    enviandoProf = true; $update();
    try {
      await api.put('/users/profile', {
        titulo: formProf.titulo,
        descricao: formProf.descricao,
        categoria_id: formProf.categoria_id ? Number(formProf.categoria_id) : null,
        nivel: formProf.nivel,
        anos_experiencia: Number(formProf.anos_experiencia || 0),
        habilidades: formProf.habilidades.join(', '),
        preco_por_hora: Number(formProf.preco_por_hora),
        disponibilidade: formProf.disponibilidade,
        localizacao: formProf.localizacao,
      });
      toast('Perfil profissional atualizado! ✅', 'success');
      const resComp = await api.get('/users/me/completude').catch(() => null);
      if (resComp && resComp.completude) completude = resComp.completude;
    } catch (err) {
      erroProf = err.message || 'Erro ao salvar.';
    }
    enviandoProf = false; $update();
  };

  /* ---------- salvar (pagamentos) ---------- */
  const salvarPagamentos = async (e) => {
    if (e) e.preventDefault();
    enviandoPag = true; $update();
    try {
      const metodos = {};
      if (formPagamentos.mpesa) metodos.mpesa = formPagamentos.mpesa;
      if (formPagamentos.emola) metodos.emola = formPagamentos.emola;
      if (formPagamentos.mkesh) metodos.mkesh = formPagamentos.mkesh;
      if (formPagamentos.banco) metodos.banco = formPagamentos.banco;
      await api.put('/users/profile', { metodos_recebimento: metodos });
      toast('Métodos de recebimento guardados 🔒', 'success');
    } catch (err) {
      toast(err.message || 'Erro ao salvar', 'error');
    }
    enviandoPag = false; $update();
  };

  /* ---------- avatar / capa ---------- */
  const escolherAvatar = () => {
    const inp = document.getElementById('input-avatar');
    if (inp) inp.click();
  };
  const escolherCapa = () => {
    const inp = document.getElementById('input-capa');
    if (inp) inp.click();
  };

  const enviarAvatar = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    e.target.value = '';
    if (f.size > 2 * 1024 * 1024) { toast('Foto demasiado grande (máx. 2 MB)', 'error'); return; }
    enviandoFoto = true; $update();
    try {
      const fd = new FormData();
      fd.append('imagem', f);
      const res = await api.postForm('/users/me/avatar', fd);
      if (res.user) {
        usuario = { ...usuario, ...res.user };
        saveAuth(loadAuth().token, usuario);
        window.freelaMZ.usuario = usuario;
        atualizarPanel(usuario);
        aplicarNavbarAvatar();
      }
      toast('Foto de perfil atualizada ✨', 'success');
      const resComp = await api.get('/users/me/completude').catch(() => null);
      if (resComp && resComp.completude) completude = resComp.completude;
    } catch (err) {
      toast(err.message || 'Erro no upload', 'error');
    }
    enviandoFoto = false; $update();
  };

  const removerFoto = async () => {
    try {
      const res = await api.delete('/users/me/avatar');
      if (res.user) {
        usuario = { ...usuario, ...res.user };
        saveAuth(loadAuth().token, usuario);
        window.freelaMZ.usuario = usuario;
        atualizarPanel(usuario);
        aplicarNavbarAvatar();
      }
      toast('Foto removida');
      const resComp = await api.get('/users/me/completude').catch(() => null);
      if (resComp && resComp.completude) completude = resComp.completude;
    } catch (err) {
      toast(err.message || 'Erro', 'error');
    }
    $update();
  };

  const enviarCapa = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    e.target.value = '';
    if (f.size > 4 * 1024 * 1024) { toast('Capa demasiado grande (máx. 4 MB)', 'error'); return; }
    enviandoFoto = true; $update();
    try {
      const fd = new FormData();
      fd.append('imagem', f);
      const res = await api.postForm('/users/me/cover', fd);
      if (res.user) {
        usuario = { ...usuario, ...res.user };
        saveAuth(loadAuth().token, usuario);
        window.freelaMZ.usuario = usuario;
      }
      toast('Capa atualizada ✨', 'success');
      const resComp = await api.get('/users/me/completude').catch(() => null);
      if (resComp && resComp.completude) completude = resComp.completude;
    } catch (err) {
      toast(err.message || 'Erro no upload', 'error');
    }
    enviandoFoto = false; $update();
  };

  const removerCapaImg = async () => {
    try {
      const res = await api.delete('/users/me/cover');
      if (res.user) {
        usuario = { ...usuario, ...res.user };
        saveAuth(loadAuth().token, usuario);
        window.freelaMZ.usuario = usuario;
      }
      toast('Capa removida');
      const resComp = await api.get('/users/me/completude').catch(() => null);
      if (resComp && resComp.completude) completude = resComp.completude;
    } catch (err) {
      toast(err.message || 'Erro', 'error');
    }
    $update();
  };

  /* ---------- completude: checklist clicável ---------- */
  const DESTINO_CHECK = {
    foto: 'avatar', capa: 'capa', bio: 'geral:campo-bio', sobre_mim: 'geral:campo-sobre',
    telefone: 'geral:campo-telefone', whatsapp: 'geral:campo-whatsapp', localizacao: 'geral:campo-cidade',
    idiomas: 'geral:campo-idiomas', titulo: 'profissional:campo-titulo', categoria_id: 'profissional:campo-categoria',
    habilidades3: 'profissional:campo-habilidades', preco_por_hora: 'profissional:campo-preco',
    educacao1: 'profissional:secao-educacao', experiencia1: 'profissional:secao-experiencia',
    certificacoes1: 'profissional:secao-certificacoes', portfolio1: 'portfolio:null',
    metodos: 'pagamentos:null', empresa: 'geral:campo-tipo-cliente', site_pessoal: 'geral:campo-site',
  };

  const clicarCheck = (item) => async () => {
    if (item.ok) return;
    const destino = DESTINO_CHECK[item.chave];
    if (!destino) return;
    if (destino === 'avatar') { escolherAvatar(); return; }
    if (destino === 'capa') { escolherCapa(); return; }
    const [abaDestino, idCampo] = destino.split(':');
    aba = abaDestino;
    $update();
    setTimeout(() => {
      if (idCampo && idCampo !== 'null') {
        const el = document.getElementById(idCampo);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
      } else {
        const sec = document.getElementById(`secao-${abaDestino}`);
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  /* ---------- senha ---------- */
  const alterarSenha = async (e) => {
    if (e) e.preventDefault();
    if (!senhaAtual || !senhaNova) { toast('Preencha a senha atual e a nova', 'error'); return; }
    if (senhaNova.length < 8) { toast('A nova senha deve ter pelo menos 8 caracteres', 'error'); return; }
    if (senhaNova !== senhaConf) { toast('As senhas não coincidem', 'error'); return; }
    enviandoSenha = true; $update();
    try {
      await api.put('/users/me/password', { senhaAtual, novaSenha: senhaNova });
      toast('Senha alterada com sucesso 🔐', 'success');
      senhaAtual = ''; senhaNova = ''; senhaConf = '';
    } catch (err) {
      toast(err.message || 'Erro', 'error');
    }
    enviandoSenha = false; $update();
  };

  /* ---------- verificação de telefone ---------- */
  const pedirCodigo = async () => {
    if (!usuario.telefone) { toast('Guarde primeiro o seu número de telefone (aba Geral)', 'error'); return; }
    esperandoCodigo = true; codigoTel = '';
    $update();
    try {
      const res = await api.post('/users/me/phone/request-code');
      if (res.codigo_dev) {
        codigoTel = res.codigo_dev;
        toast(`Código enviado (DEV: ${res.codigo_dev})`, 'success');
      } else {
        toast('Código enviado para o seu telefone 📱', 'success');
      }
    } catch (err) {
      esperandoCodigo = false;
      toast(err.message || 'Erro', 'error');
    }
    $update();
  };

  const confirmarCodigo = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await api.post('/users/me/phone/verify', { codigo: codigoTel });
      if (res.user) {
        usuario = { ...usuario, ...res.user };
        saveAuth(loadAuth().token, usuario);
        window.freelaMZ.usuario = usuario;
      }
      toast('Telefone verificado ✓', 'success');
      esperandoCodigo = false;
    } catch (err) {
      toast(err.message || 'Erro', 'error');
    }
    $update();
  };

  /* ---------- portfólio ---------- */
  const abrirPortForm = () => {
    if (portfolio.length >= 12) { toast('Limite de 12 itens atingido', 'error'); return; }
    portFormAberto = true; portEditando = null;
    portTitulo = ''; portDescricao = ''; portLink = '';
    portFicheiros = []; portPreviews = [];
    $update();
    setTimeout(() => {
      const el = document.getElementById('secao-portform');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const editarPortItem = (item) => () => {
    portFormAberto = true; portEditando = item;
    portTitulo = item.titulo || '';
    portDescricao = item.descricao || '';
    portLink = item.link || '';
    portFicheiros = []; portPreviews = [];
    $update();
    setTimeout(() => {
      const el = document.getElementById('secao-portform');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const escolherPortImagens = () => {
    const inp = document.getElementById('input-port-imagens');
    if (inp) inp.click();
  };

  const trocarPortImagens = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    for (const f of files) {
      if (portFicheiros.length >= 4) { toast('Máximo de 4 imagens por item', 'error'); break; }
      if (f.size > 4 * 1024 * 1024) { toast(`${f.name} é maior que 4 MB`, 'error'); continue; }
      portFicheiros.push(f);
      const r = new FileReader();
      r.onload = () => { portPreviews.push(r.result); $update(); };
      r.readAsDataURL(f);
    }
    $update();
  };

  const removerPortImagem = (i) => () => {
    portFicheiros.splice(i, 1);
    portPreviews.splice(i, 1);
    $update();
  };

  const cancelarPortForm = () => {
    portFormAberto = false; portEditando = null;
    portFicheiros = []; portPreviews = [];
    $update();
  };

  const salvarPortItem = async (e) => {
    if (e) e.preventDefault();
    if (!portTitulo.trim()) { toast('Dê um título ao trabalho', 'error'); return; }
    const ehEdicao = !!portEditando;
    if (!ehEdicao && portFicheiros.length === 0) {
      toast('Envie pelo menos 1 imagem do trabalho', 'error'); return;
    }
    enviandoPort = true; $update();
    try {
      const fd = new FormData();
      fd.append('titulo', portTitulo);
      fd.append('descricao', portDescricao);
      fd.append('link', portLink);
      if (portFicheiros.length) portFicheiros.forEach((f) => fd.append('imagens', f));
      if (ehEdicao) {
        await api.putForm(`/users/portfolio/${portEditando.id}`, fd);
        toast('Item atualizado ✅', 'success');
      } else {
        await api.postForm('/users/portfolio', fd);
        toast('Item adicionado ao portfólio 🎨', 'success');
      }
      const res = await api.get(`/users/${usuario.id}/portfolio`);
      portfolio = res.itens || [];
      cancelarPortForm();
      const resComp = await api.get('/users/me/completude').catch(() => null);
      if (resComp && resComp.completude) completude = resComp.completude;
    } catch (err) {
      toast(err.message || 'Erro ao guardar', 'error');
    }
    enviandoPort = false; $update();
  };

  const apagarPortItem = (item) => async () => {
    if (!confirm(`Apagar "${item.titulo}" do portfólio?`)) return;
    try {
      await api.delete(`/users/portfolio/${item.id}`);
      portfolio = portfolio.filter((i) => i.id !== item.id);
      toast('Item removido');
      const resComp = await api.get('/users/me/completude').catch(() => null);
      if (resComp && resComp.completude) completude = resComp.completude;
    } catch (err) {
      toast(err.message || 'Erro', 'error');
    }
    $update();
  };

  const verFotos = (item) => () => {
    fotos = (item.imagens || []).slice();
    fotoIdx = 0;
    $update();
  };

  const fotoAnterior = () => { fotoIdx = (fotoIdx - 1 + fotos.length) % fotos.length; $update(); };
  const fotoSeguinte = () => { fotoIdx = (fotoIdx + 1) % fotos.length; $update(); };
  const fecharFotos = () => { fotos = []; $update(); };

  /* ---------- render: abas ---------- */
  const ABAS = [
    { id: 'geral', rot: 'Geral', icon: 'person_crop_circle' },
    ...(souFreelancer() ? [
      { id: 'profissional', rot: 'Profissional', icon: 'briefcase_fill' },
      { id: 'portfolio', rot: 'Portfólio', icon: 'photos' },
      { id: 'pagamentos', rot: 'Pagamentos', icon: 'creditcard_fill' },
    ] : []),
    { id: 'seguranca', rot: 'Segurança', icon: 'lock_shield_fill' },
  ];

  const setAba = (id) => () => { aba = id; $update(); };

  /* ---------- render: campos de registro (educação etc.) ---------- */
  const novosReg = {
    educacao: { titulo: '', local: '', periodo: '', descricao: '' },
    experiencia_prof: { titulo: '', local: '', periodo: '', descricao: '' },
    certificacoes: { titulo: '', local: '', periodo: '', descricao: '' },
  };

  const apagarRegistro = (chave, i) => async () => {
    (perfil[chave] || []).splice(i, 1);
    try {
      await api.put('/users/profile', { [chave]: perfil[chave] || [] });
      toast('Registo removido');
    } catch (err) {
      toast(err.message || 'Erro', 'error');
    }
    $update();
  };

  const addRegistro = (chave) => async (e) => {
    if (e) e.preventDefault();
    const r = novosReg[chave];
    if (!r.titulo.trim()) { toast('Preencha o título do registo', 'error'); return; }
    perfil[chave] = perfil[chave] || [];
    perfil[chave].push({ ...r });
    try {
      await api.put('/users/profile', { [chave]: perfil[chave] });
      toast('Registo adicionado ✅', 'success');
    } catch (err) {
      toast(err.message || 'Erro', 'error');
    }
    novosReg[chave] = { titulo: '', local: '', periodo: '', descricao: '' };
    $update();
  };

  const setNovoReg = (chave, campo) => (e) => { novosReg[chave][campo] = e.target.value; };

  const editorRegistro = (chave, phTitulo, phLocal) => $h`
    <form style="margin-top:12px; border-top:1px dashed var(--mz-border); padding-top:14px;" @submit=${addRegistro(chave)}>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <input class="input-mz" placeholder=${phTitulo} value=${novosReg[chave].titulo} @input=${setNovoReg(chave, 'titulo')} />
        <input class="input-mz" placeholder=${phLocal} value=${novosReg[chave].local} @input=${setNovoReg(chave, 'local')} />
      </div>
      <input class="input-mz" style="margin-top:8px;" placeholder="Período (ex.: 2019-2023)" maxlength="60"
        value=${novosReg[chave].periodo} @input=${setNovoReg(chave, 'periodo')} />
      <input class="input-mz" style="margin-top:8px;" placeholder="Descrição (opcional)" maxlength="400"
        value=${novosReg[chave].descricao} @input=${setNovoReg(chave, 'descricao')} />
      <button class="btn-mz secundario" style="margin-top:10px; width:100%;" type="submit">
        <i class="f7-icons" style="font-size:13px;">plus</i> Adicionar registo
      </button>
    </form>
  `;

  const registro = (r, chave, i) => $h`
    <div class="registro-item">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px;">
        <div>
          <div class="titulo">${r.titulo}</div>
          ${r.local ? $h`<div class="local">${r.local}</div>` : ''}
          ${r.periodo ? $h`<span class="periodo">${r.periodo}</span>` : ''}
        </div>
        <button class="btn-mz fantasma" style="padding:6px 10px;" type="button"
          @click=${apagarRegistro(chave, i)}>✕</button>
      </div>
      ${r.descricao ? $h`<div class="descricao">${r.descricao}</div>` : ''}
    </div>
  `;

  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Meu perfil' })}
      <div class="page-content">

        ${fotos.length ? $h`
          <div class="photo-browser-overlay" @click=${fecharFotos}>
            <button class="pb-close" @click=${fecharFotos}><i class="f7-icons">xmark</i></button>
            <img class="pb-foto" src=${assetUrl(fotos[fotoIdx])} alt="foto do portfólio" @click=${(e) => e.stopPropagation()} />
            <div class="pb-controles">
              <button @click=${(e) => { e.stopPropagation(); fotoAnterior(); }}><i class="f7-icons">chevron_left</i></button>
              <span>${fotoIdx + 1} / ${fotos.length}</span>
              <button @click=${(e) => { e.stopPropagation(); fotoSeguinte(); }}><i class="f7-icons">chevron_right</i></button>
            </div>
          </div>
        ` : ''}

        <input type="file" id="input-avatar" accept="image/jpeg,image/png,image/webp" style="display:none;" @change=${enviarAvatar} />
        <input type="file" id="input-capa" accept="image/jpeg,image/png,image/webp" style="display:none;" @change=${enviarCapa} />
        <input type="file" id="input-port-imagens" accept="image/jpeg,image/png,image/webp" multiple style="display:none;" @change=${trocarPortImagens} />

        ${carregando ? $h`
          <div class="mz-container">
            <div class="skeleton" style="height:150px; border-radius:20px;"></div>
            <div class="skeleton" style="height:120px; border-radius:20px; margin-top:14px;"></div>
            <div class="skeleton" style="height:300px; border-radius:20px; margin-top:14px;"></div>
          </div>
        ` : erro ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${errorState($h, { mensagem: erro, onRetry: carregar })}
          </div>
        ` : !usuario ? $h`
          <div class="mz-container" style="padding-top:30px;">
            ${errorState($h, { mensagem: 'Utilizador não encontrado.' })}
          </div>
        ` : $h`
          <div>

            <!-- Capa + avatar sobreposto -->
            <div class="perfil-capa">
              ${usuario.capa ? $h`<img src=${assetUrl(usuario.capa)} alt="capa" />` : ''}
              <button class="capa-editar-btn" type="button" @click=${escolherCapa}>
                <i class="f7-icons">photo</i> ${usuario.capa ? 'Trocar capa' : 'Adicionar capa'}
              </button>
              ${usuario.capa ? $h`
                <button class="capa-editar-btn" style="right:auto; left:12px;" type="button" @click=${removerCapaImg}>
                  <i class="f7-icons">trash</i> Remover
                </button>
              ` : ''}
            </div>

            <div class="mz-container" style="max-width:680px;">

              <div class="perfil-topo">
                <div class="avatar-editavel">
                  ${renderAvatar($h, usuario, 'avatar-xl')}
                  <button class="avatar-editar-btn" type="button" @click=${escolherAvatar} title="Trocar foto">
                    <i class="f7-icons">${enviandoFoto ? 'hourglass' : 'camera_fill'}</i>
                  </button>
                </div>
                <div class="perfil-topo-info">
                  <div class="perfil-nome">
                    ${usuario.nome}
                    ${selos($h, usuario, (perfil && perfil.estatisticas) || {})}
                  </div>
                  <div class="perfil-username">@${usuario.nome_utilizador || '—'} ·
                    ${usuario.tipo_usuario === 'ADMIN' ? 'Administrador' : souFreelancer() ? 'Freelancer' : 'Cliente'}</div>
                  ${usuario.foto ? $h`
                    <button class="btn-mz fantasma" style="padding:6px 12px; font-size:12px; margin-top:8px;" type="button" @click=${removerFoto}>
                      <i class="f7-icons" style="font-size:13px;">trash</i> Remover foto
                    </button>
                  ` : ''}
                </div>
              </div>

              <!-- Completude -->
              <div class="completude-card">
                <div class="completude-head">
                  <div>
                    <div style="font-size:13px; font-weight:800; color:var(--mz-navy);">Perfil completo</div>
                    <div class="text-sm text-muted">Quanto mais completo, mais visível você é</div>
                  </div>
                  <div class="completude-pct">${completude.percentual || 0}%</div>
                </div>
                <div class="completude-barra">
                  <div class="completudo-fill" style="width:${completude.percentual || 0}%;"></div>
                </div>
                <div class="completude-lista">
                  ${(completude.itens || []).map((item) => $h`
                    <button class="check-item ${item.ok ? '' : 'pendente'}" type="button" @click=${clicarCheck(item)}>
                      <span class="check-bolha"><i class="f7-icons">checkmark</i></span>
                      <span style="flex:1;">${item.rotulo}</span>
                      ${item.ok ? '' : $h`<i class="f7-icons" style="font-size:13px; color:var(--mz-primary);">chevron_right</i>`}
                    </button>
                  `)}
                </div>
              </div>

              <!-- Abas -->
              <div class="abas-perfil">
                ${ABAS.map((a) => $h`
                  <button class="aba-perfil ${aba === a.id ? 'active' : ''}" type="button" @click=${setAba(a.id)}>
                    <i class="f7-icons">${a.icon}</i> ${a.rot}
                  </button>
                `)}
              </div>

              <!-- ============ ABA: GERAL ============ -->
              ${aba === 'geral' ? $h`
                <form @submit=${salvarGeral}>
                  ${erroGeral ? $h`<div class="mz-badge badge-recusada" style="display:flex; justify-content:center; margin-bottom:14px;">${erroGeral}</div>` : ''}
                  <div class="mz-card" style="padding:20px;">
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Nome completo</div>
                      <input class="input-mz" type="text" value=${formGeral.nome} @input=${setGeral('nome')} />
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Nome de utilizador <small>único · ex.: maria.joao</small></div>
                      <input class="input-mz" type="text" id="campo-username" value=${formGeral.nome_utilizador} @input=${setGeral('nome_utilizador')} />
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Bio curta <small>${formGeral.bio ? formGeral.bio.length : 0}/160</small></div>
                      <input class="input-mz" id="campo-bio" maxlength="160" placeholder="Ex.: Designer gráfico · Maputo"
                        value=${formGeral.bio} @input=${setGeral('bio')} />
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Sobre mim <small>${formGeral.sobre_mim ? formGeral.sobre_mim.length : 0}/1000</small></div>
                      <textarea class="input-mz" id="campo-sobre" maxlength="1000" rows="5"
                        placeholder="Conte a sua história, o que faz e como trabalha…"
                        @input=${setGeral('sobre_mim')}>${formGeral.sobre_mim}</textarea>
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Telefone <small>+258 8X XXX XXXX</small></div>
                      <input class="input-mz" id="campo-telefone" type="tel" placeholder="+258 84 123 4567"
                        value=${formGeral.telefone} @input=${setGeral('telefone')} />
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">WhatsApp</div>
                      <input class="input-mz" id="campo-whatsapp" type="tel" placeholder="+258 84 123 4567"
                        value=${formGeral.whatsapp} @input=${setGeral('whatsapp')} />
                    </div>
                    <div class="campo-grupo" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                      <div>
                        <div class="campo-rotulo">Província</div>
                        <select class="input-mz" @change=${setGeral('provincia')}>
                          <option value="" selected=${!formGeral.provincia}>— escolher —</option>
                          ${PROVINCIAS.map((p) => $h`<option value=${p} selected=${formGeral.provincia === p}>${p}</option>`)}
                        </select>
                      </div>
                      <div>
                        <div class="campo-rotulo">Cidade</div>
                        <input class="input-mz" id="campo-cidade" type="text" placeholder="Ex.: Maputo"
                          value=${formGeral.cidade} @input=${setGeral('cidade')} />
                      </div>
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Idiomas <small>Enter para adicionar</small></div>
                      <div class="tags-lista" id="campo-idiomas" style="margin-bottom:8px;">
                        ${formGeral.idiomas.map((idioma, i) => $h`
                          <span class="tag-skill" style="cursor:pointer;" @click=${removeTag(formGeral, 'idiomas', i)}>
                            ${idioma} ✕
                          </span>
                        `)}
                      </div>
                      <input class="input-mz" list="lista-idiomas" placeholder="Ex.: Português"
                        @keydown=${addTag(formGeral, 'idiomas', 10)} @blur=${addTag(formGeral, 'idiomas', 10)} />
                      <datalist id="lista-idiomas">
                        ${IDIOMAS_SUGERIDOS.map((i) => $h`<option value=${i}></option>`)}
                      </datalist>
                    </div>

                    ${souFreelancer() ? '' : $h`
                      <div class="campo-grupo">
                        <div class="campo-rotulo">Sou</div>
                        <select class="input-mz" id="campo-tipo-cliente" @change=${setGeral('tipo_cliente')}>
                          <option value="pessoa" selected=${formGeral.tipo_cliente !== 'empresa'}>Pessoa individual</option>
                          <option value="empresa" selected=${formGeral.tipo_cliente === 'empresa'}>Empresa</option>
                        </select>
                      </div>
                      ${formGeral.tipo_cliente === 'empresa' ? $h`
                        <div class="campo-grupo">
                          <div class="campo-rotulo">Nome da empresa</div>
                          <input class="input-mz" value=${formGeral.nome_empresa} @input=${setGeral('nome_empresa')} />
                        </div>
                        <div class="campo-grupo">
                          <div class="campo-rotulo">Setor</div>
                          <input class="input-mz" value=${formGeral.setor} @input=${setGeral('setor')} />
                        </div>
                        <div class="campo-grupo">
                          <div class="campo-rotulo">Tamanho da equipa</div>
                          <input class="input-mz" placeholder="Ex.: 1-4, 5-10, 10+"
                            value=${formGeral.tamanho_equipa} @input=${setGeral('tamanho_equipa')} />
                        </div>
                      ` : ''}
                    `}

                    <div class="secao-head"><div class="secao-titulo"><i class="f7-icons">globe</i> Redes e contacto</div></div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">LinkedIn</div>
                      <input class="input-mz" placeholder="https://linkedin.com/in/…" value=${formGeral.linkedin} @input=${setGeral('linkedin')} />
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Instagram</div>
                      <input class="input-mz" placeholder="https://instagram.com/…" value=${formGeral.instagram} @input=${setGeral('instagram')} />
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Facebook</div>
                      <input class="input-mz" placeholder="https://facebook.com/…" value=${formGeral.facebook} @input=${setGeral('facebook')} />
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Site pessoal</div>
                      <input class="input-mz" id="campo-site" placeholder="https://oseusite.co.mz" value=${formGeral.site_pessoal} @input=${setGeral('site_pessoal')} />
                    </div>
                  </div>
                  <button class="btn-mz w-full" type="submit" disabled=${enviandoGeral} style="margin-top:4px;">
                    ${enviandoGeral ? 'A guardar…' : 'Guardar dados gerais'}
                  </button>
                </form>
              ` : ''}

              <!-- ============ ABA: PROFISSIONAL ============ -->
              ${aba === 'profissional' && souFreelancer() && perfil ? $h`
                <form @submit=${salvarProfissional}>
                  ${erroProf ? $h`<div class="mz-badge badge-recusada" style="display:flex; justify-content:center; margin-bottom:14px;">${erroProf}</div>` : ''}
                  <div class="mz-card" style="padding:20px;">
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Título profissional</div>
                      <input class="input-mz" id="campo-titulo" placeholder="Ex.: Designer gráfico sénior"
                        value=${formProf.titulo} @input=${setProf('titulo')} />
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Descrição do serviço</div>
                      <textarea class="input-mz" rows="4" placeholder="O que faz, para quem e diferenciais…"
                        @input=${setProf('descricao')}>${formProf.descricao}</textarea>
                    </div>
                    <div class="campo-grupo" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                      <div>
                        <div class="campo-rotulo">Categoria principal</div>
                        <select class="input-mz" id="campo-categoria" @change=${setProf('categoria_id')}>
                          <option value="" selected=${!formProf.categoria_id}>— escolher —</option>
                          ${categorias.map((c) => $h`<option value=${String(c.id)} selected=${formProf.categoria_id === String(c.id)}>${c.nome}</option>`)}
                        </select>
                      </div>
                      <div>
                        <div class="campo-rotulo">Nível</div>
                        <select class="input-mz" @change=${setProf('nivel')}>
                          <option value="iniciante" selected=${formProf.nivel === 'iniciante'}>Iniciante</option>
                          <option value="intermedio" selected=${formProf.nivel === 'intermedio'}>Intermédio</option>
                          <option value="especialista" selected=${formProf.nivel === 'especialista'}>Especialista</option>
                        </select>
                      </div>
                    </div>
                    <div class="campo-grupo" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                      <div>
                        <div class="campo-rotulo">Anos de experiência</div>
                        <input class="input-mz" type="number" min="0" max="60" value=${formProf.anos_experiencia} @input=${setProf('anos_experiencia')} />
                      </div>
                      <div>
                        <div class="campo-rotulo">Preço por hora (MT)</div>
                        <input class="input-mz" id="campo-preco" type="number" min="0" placeholder="Ex.: 750"
                          value=${formProf.preco_por_hora} @input=${setProf('preco_por_hora')} />
                      </div>
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Habilidades <small>Enter para adicionar · máx. 15</small></div>
                      <div class="tags-lista" id="campo-habilidades" style="margin-bottom:8px;">
                        ${formProf.habilidades.map((hab, i) => $h`
                          <span class="tag-skill" style="cursor:pointer;" @click=${removeTag(formProf, 'habilidades', i)}>${hab} ✕</span>
                        `)}
                      </div>
                      <input class="input-mz" placeholder="Ex.: React, Photoshop, Edição de vídeo…"
                        @keydown=${addTag(formProf, 'habilidades', 15)} @blur=${addTag(formProf, 'habilidades', 15)} />
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Disponibilidade</div>
                      <select class="input-mz" @change=${setProf('disponibilidade')}>
                        <option value="disponivel" selected=${formProf.disponibilidade === 'disponivel'}>Disponível para novos projetos</option>
                        <option value="ocupado" selected=${formProf.disponibilidade === 'ocupado'}>Ocupado</option>
                        <option value="indisponivel" selected=${formProf.disponibilidade === 'indisponivel'}>Indisponível</option>
                      </select>
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Localização de trabalho <small>ex.: Remoto · Maputo</small></div>
                      <input class="input-mz" value=${formProf.localizacao} @input=${setProf('localizacao')} />
                    </div>
                  </div>
                  <button class="btn-mz w-full" type="submit" disabled=${enviandoProf} style="margin-top:4px;">
                    ${enviandoProf ? 'A guardar…' : 'Guardar perfil profissional'}
                  </button>
                </form>

                ${''}
                <!-- Educação -->
                <div class="secao-head" id="secao-educacao">
                  <div class="secao-titulo"><i class="f7-icons">book</i> Educação</div>
                </div>
                <div class="mz-card" style="padding:16px;">
                  ${(perfil.educacao || []).map((r, i) => registro(r, 'educacao', i))}
                  ${editorRegistro('educacao', 'Ex.: Licenciatura em Informática', 'Ex.: UEM')}
                </div>

                <!-- Experiência -->
                <div class="secao-head" id="secao-experiencia">
                  <div class="secao-titulo"><i class="f7-icons">briefcase</i> Experiência profissional</div>
                </div>
                <div class="mz-card" style="padding:16px;">
                  ${(perfil.experiencia_prof || []).map((r, i) => registro(r, 'experiencia_prof', i))}
                  ${editorRegistro('experiencia_prof', 'Ex.: Designer na Agência X', 'Ex.: Agência X · Maputo')}
                </div>

                <!-- Certificações -->
                <div class="secao-head" id="secao-certificacoes">
                  <div class="secao-titulo"><i class="f7-icons">rosette</i> Certificações</div>
                </div>
                <div class="mz-card" style="padding:16px;">
                  ${(perfil.certificacoes || []).map((r, i) => registro(r, 'certificacoes', i))}
                  ${editorRegistro('certificacoes', 'Ex.: Google UX Design', 'Ex.: Coursera')}
                </div>
              ` : ''}

              <!-- ============ ABA: PORTFÓLIO ============ -->
              ${aba === 'portfolio' && souFreelancer() ? $h`
                <div class="secao-head">
                  <div class="secao-titulo"><i class="f7-icons">photos</i> Portfólio (${portfolio.length}/12)</div>
                  ${!portFormAberto ? $h`
                    <button class="btn-mz secundario" style="padding:8px 14px; font-size:12.5px;" type="button" @click=${abrirPortForm}>
                      <i class="f7-icons" style="font-size:13px;">plus</i> Adicionar
                    </button>
                  ` : ''}
                </div>

                ${portFormAberto ? $h`
                  <form class="mz-card" id="secao-portform" style="padding:20px;" @submit=${salvarPortItem}>
                    <div class="secao-titulo" style="margin-bottom:12px;">
                      <i class="f7-icons">plus_circle</i> ${portEditando ? 'Editar item' : 'Novo trabalho no portfólio'}
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Título *</div>
                      <input class="input-mz" placeholder="Ex.: Website para loja de roupa" value=${portTitulo}
                        @input=${(e) => { portTitulo = e.target.value; }} />
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Descrição</div>
                      <textarea class="input-mz" rows="3" placeholder="O que fez, ferramentas, resultado…"
                        @input=${(e) => { portDescricao = e.target.value; }}>${portDescricao}</textarea>
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Link do projeto <small>opcional</small></div>
                      <input class="input-mz" type="url" placeholder="https://…" value=${portLink}
                        @input=${(e) => { portLink = e.target.value; }} />
                    </div>
                    <div class="campo-grupo">
                      <div class="campo-rotulo">Imagens * <small>1-4 por item · JPG/PNG/WEBP · máx. 4 MB cada</small></div>
                      ${portEditando && (portEditando.imagens || []).length ? $h`
                        <div class="text-sm text-muted" style="margin-bottom:8px;">
                          Imagens atuais (enviar novas substitui):
                        </div>
                        <div class="portfolio-grid" style="margin-bottom:10px;">
                          ${portEditando.imagens.map((img) => $h`<img class="portfolio-thumb" src=${assetUrl(img)} alt="imagem atual" />`)}
                        </div>
                      ` : ''}
                      ${portPreviews.length ? $h`
                        <div class="portfolio-grid" style="margin-bottom:10px;">
                          ${portPreviews.map((p, i) => $h`
                            <div class="portfolio-item">
                              <img class="portfolio-thumb" src=${assetUrl(p)} alt="nova imagem" />
                              <button class="portfolio-badge-fotos" style="background:var(--mz-red);" type="button" @click=${removerPortImagem(i)}>✕ remover</button>
                            </div>
                          `)}
                        </div>
                      ` : ''}
                      <div class="uploadzona" type="button" @click=${escolherPortImagens}>
                        <i class="f7-icons">plus_circle_fill</i>
                        ${portFicheiros.length ? `${portFicheiros.length} imagem(ns) selecionada(s) — toque para trocar`
                          : 'Toque para escolher imagens do trabalho'}
                      </div>
                    </div>
                    <div style="display:flex; gap:10px;">
                      <button class="btn-mz" style="flex:1;" type="submit" disabled=${enviandoPort}>
                        ${enviandoPort ? 'A guardar…' : (portEditando ? 'Guardar alterações' : 'Adicionar ao portfólio')}
                      </button>
                      <button class="btn-mz secundario" type="button" @click=${cancelarPortForm}>Cancelar</button>
                    </div>
                  </form>
                ` : ''}

                ${portfolio.length === 0 && !portFormAberto ? $h`
                  <div class="mz-card portfolio-vazio">
                    <i class="f7-icons">photos</i>
                    <b>Sem trabalhos no portfólio</b>
                    <div class="text-sm text-muted">Adicione imagens dos seus melhores trabalhos para atrair clientes.</div>
                  </div>
                ` : $h`
                  <div class="portfolio-grid">
                    ${portfolio.map((item) => $h`
                      <div class="portfolio-item">
                        <div class="portfolio-thumb-multi" @click=${verFotos(item)}>
                          ${(item.imagens && item.imagens.length) ? $h`
                            <img src=${assetUrl(item.imagens[0])} alt=${item.titulo} />
                            ${item.imagens.length > 1 ? $h`
                              <span class="portfolio-badge-fotos"><i class="f7-icons">photos</i> ${item.imagens.length}</span>
                            ` : ''}
                          ` : $h`<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#94a3b8;"><i class="f7-icons">photos</i></div>`}
                        </div>
                        <div class="portfolio-info">
                          <div class="portfolio-titulo">${item.titulo}</div>
                          <div class="portfolio-acoes">
                            <button type="button" @click=${editarPortItem(item)}><i class="f7-icons">pencil</i> Editar</button>
                            <button type="button" class="apagar" @click=${apagarPortItem(item)}><i class="f7-icons">trash</i> Apagar</button>
                          </div>
                        </div>
                      </div>
                    `)}
                  </div>
                `}
              ` : ''}

              <!-- ============ ABA: PAGAMENTOS ============ -->
              ${aba === 'pagamentos' && souFreelancer() ? $h`
                <div class="mz-badge badge-andamento" style="display:flex; align-items:center; gap:6px; margin-bottom:12px;">
                  <i class="f7-icons" style="font-size:13px;">lock_fill</i> Privado — só você vê estas informações
                </div>
                <form class="mz-card" style="padding:20px;" @submit=${salvarPagamentos}>
                  <p class="text-sm text-muted" style="margin:0 0 14px 0; line-height:1.5;">
                    Como quer receber dos seus clientes? Estes dados nunca aparecem no seu perfil público.
                  </p>
                  <div class="campo-grupo">
                    <div class="campo-rotulo">M-Pesa <small>número</small></div>
                    <input class="input-mz" placeholder="+258 84 123 4567" value=${formPagamentos.mpesa} @input=${setPag('mpesa')} />
                  </div>
                  <div class="campo-grupo">
                    <div class="campo-rotulo">e-Mola <small>número</small></div>
                    <input class="input-mz" placeholder="+258 85 123 4567" value=${formPagamentos.emola} @input=${setPag('emola')} />
                  </div>
                  <div class="campo-grupo">
                    <div class="campo-rotulo">MKesh <small>número</small></div>
                    <input class="input-mz" placeholder="+258 82 123 4567" value=${formPagamentos.mkesh} @input=${setPag('mkesh')} />
                  </div>
                  <div class="campo-grupo">
                    <div class="campo-rotulo">Conta bancária <small>banco e número</small></div>
                    <input class="input-mz" placeholder="Ex.: BCI 1234567890" value=${formPagamentos.banco} @input=${setPag('banco')} />
                  </div>
                  <button class="btn-mz w-full" type="submit" disabled=${enviandoPag}>
                    ${enviandoPag ? 'A guardar…' : 'Guardar métodos de recebimento'}
                  </button>
                </form>
              ` : ''}

              <!-- ============ ABA: SEGURANÇA ============ -->
              ${aba === 'seguranca' ? $h`
                <div class="mz-card" style="padding:20px; margin-bottom:16px;">
                  <div class="secao-titulo" style="margin-bottom:12px;"><i class="f7-icons">checkmark_seal</i> Verificações</div>

                  <div class="check-item ${usuario.email_verificado ? '' : 'pendente'}" style="cursor:default;">
                    <span class="check-bolha"><i class="f7-icons">checkmark</i></span>
                    <span style="flex:1;">Email verificado</span>
                    ${usuario.email_verificado
                      ? $h`<span class="mz-badge badge-verificado">Verificado</span>`
                      : $h`<span class="mz-badge badge-pendente">${usuario.email}</span>`}
                  </div>

                  <div class="check-item ${usuario.telefone_verificado ? '' : 'pendente'}" style="cursor:default;">
                    <span class="check-bolha"><i class="f7-icons">checkmark</i></span>
                    <span style="flex:1;">Telefone verificado</span>
                    ${usuario.telefone_verificado
                      ? $h`<span class="mz-badge badge-verificado">${usuario.telefone || '—'}</span>`
                      : $h`<button class="btn-mz secundario" style="padding:8px 14px; font-size:12px;" type="button" @click=${pedirCodigo}>Verificar</button>`}
                  </div>

                  ${esperandoCodigo && !usuario.telefone_verificado ? $h`
                    <form style="margin-top:12px; display:flex; gap:10px; align-items:center;" @submit=${confirmarCodigo}>
                      <input class="input-mz" style="flex:1;" placeholder="Código de 6 dígitos" maxlength="6"
                        value=${codigoTel} @input=${(e) => { codigoTel = e.target.value; }} />
                      <button class="btn-mz" type="submit">Confirmar</button>
                    </form>
                  ` : ''}
                </div>

                <form class="mz-card" style="padding:20px;" @submit=${alterarSenha}>
                  <div class="secao-titulo" style="margin-bottom:12px;"><i class="f7-icons">lock_shield</i> Alterar senha</div>
                  <div class="campo-grupo">
                    <div class="campo-rotulo">Senha atual</div>
                    <input class="input-mz" type="password" autocomplete="current-password"
                      value=${senhaAtual} @input=${(e) => { senhaAtual = e.target.value; }} />
                  </div>
                  <div class="campo-grupo">
                    <div class="campo-rotulo">Nova senha <small>mínimo 8 caracteres</small></div>
                    <input class="input-mz" type="password" autocomplete="new-password"
                      value=${senhaNova} @input=${(e) => { senhaNova = e.target.value; }} />
                  </div>
                  <div class="campo-grupo">
                    <div class="campo-rotulo">Confirmar nova senha</div>
                    <input class="input-mz" type="password" autocomplete="new-password"
                      value=${senhaConf} @input=${(e) => { senhaConf = e.target.value; }} />
                  </div>
                  <button class="btn-mz w-full" type="submit" disabled=${enviandoSenha}>
                    ${enviandoSenha ? 'A alterar…' : 'Alterar senha'}
                  </button>
                </form>
              ` : ''}
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}
