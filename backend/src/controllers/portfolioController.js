const Portfolio = require('../models/Portfolio');
const User = require('../models/User');
const { salvarImagem, apagarArquivo, verificarRateLimit } = require('../services/imagem');
const { limparTexto, urlOk } = require('../services/sanitize');

/* Valida o payload comum de item de portfólio */
function validarCampos(body) {
  const titulo = limparTexto(body.titulo, 150);
  if (!titulo) return { erro: 'O título é obrigatório (até 150 caracteres)' };
  const descricao = limparTexto(body.descricao, 1000);
  const link = limparTexto(body.link, 255);
  if (link && !urlOk(link)) return { erro: 'Link inválido (deve começar por http:// ou https://)' };
  return { titulo, descricao, link };
}

const portfolioController = {
  /* Público: portfólio de qualquer utilizador */
  async listar(req, res) {
    try {
      const itens = await Portfolio.listarPorUser(req.params.id);
      res.json({ success: true, itens });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async criar(req, res) {
    try {
      if (!verificarRateLimit(req.user.id)) {
        return res.status(429).json({ success: false, message: 'Demasiados envios. Aguarde um minuto.' });
      }
      if (req.user.tipo_usuario !== 'FREELANCER') {
        return res.status(403).json({ success: false, message: 'Apenas freelancers gerem portfólio' });
      }
      const total = await Portfolio.contarPorUser(req.user.id);
      if (total >= 12) {
        return res.status(400).json({ success: false, message: 'Limite de 12 itens no portfólio atingido' });
      }
      const v = validarCampos(req.body || {});
      if (v.erro) return res.status(400).json({ success: false, message: v.erro });

      // imagens: multer.fields('imagens') — até 4
      const files = req.files && req.files.imagens ? req.files.imagens.slice(0, 4) : [];
      const urls = [];
      for (const f of files) {
        urls.push(await salvarImagem(f.buffer, 'portfolio'));
      }
      if (!urls.length) {
        return res.status(400).json({ success: false, message: 'Envie pelo menos 1 imagem do trabalho' });
      }
      const item = await Portfolio.criar(req.user.id, { titulo: v.titulo, descricao: v.descricao, link: v.link }, urls);
      res.status(201).json({ success: true, message: 'Item adicionado ao portfólio', item });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ success: false, message: err.message || 'Erro interno' });
    }
  },

  async atualizar(req, res) {
    try {
      const item = await Portfolio.buscarPorId(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: 'Item não encontrado' });
      if (item.user_id !== req.user.id && req.user.tipo_usuario !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Só pode editar o seu próprio portfólio' });
      }
      const v = validarCampos(req.body || {});
      if (v.erro) return res.status(400).json({ success: false, message: v.erro });

      let urlsNovas = null;
      const files = req.files && req.files.imagens ? req.files.imagens.slice(0, 4) : [];
      if (files.length) {
        urlsNovas = [];
        for (const f of files) urlsNovas.push(await salvarImagem(f.buffer, 'portfolio'));
      }
      await Portfolio.atualizar(req.params.id, { titulo: v.titulo, descricao: v.descricao, link: v.link });
      if (urlsNovas) {
        const antigas = await Portfolio.substituirImagens(req.params.id, urlsNovas);
        antigas.forEach((u) => apagarArquivo(u));
      }
      const atualizado = await Portfolio.buscarPorId(req.params.id);
      res.json({ success: true, message: 'Item atualizado', item: atualizado });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ success: false, message: err.message || 'Erro interno' });
    }
  },

  async apagar(req, res) {
    try {
      const item = await Portfolio.buscarPorId(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: 'Item não encontrado' });
      if (item.user_id !== req.user.id && req.user.tipo_usuario !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Só pode apagar o seu próprio portfólio' });
      }
      const apagado = await Portfolio.apagar(req.params.id);
      if (apagado) (apagado.imagens || []).forEach((u) => apagarArquivo(u));
      res.json({ success: true, message: 'Item removido do portfólio' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },
};

module.exports = portfolioController;
