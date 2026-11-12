const User = require('../models/User');
const Profile = require('../models/Profile');
const Portfolio = require('../models/Portfolio');
const Project = require('../models/Project');
const Review = require('../models/Review');
const db = require('../config/db');
const {
  salvarImagem, apagarArquivo, verificarRateLimit,
} = require('../services/imagem');
const {
  limparTexto, limparLista, limparRegistros, limparMetodos,
  telefoneOk, urlOk, PROVINCIAS, RE_USERNAME,
} = require('../services/sanitize');
const bcrypt = require('bcryptjs');

const userController = {
  /* ---------------- Perfil profissional (freelancer) ---------------- */
  async getProfile(req, res) {
    try {
      const profile = await Profile.getByUserId(req.user.id);
      const stats = await Profile.estatisticas(req.user.id);
      const comp = await Profile.completude(req.user.id);
      res.json({ success: true, profile: { ...profile, estatisticas: stats, completude: comp } });
    } catch (err) {
      console.error('[USER] Erro ao obter perfil:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async updateProfile(req, res) {
    try {
      // ATENÇÃO: o payload do JWT usa tipo_usuario (snake_case)
      const tipoUsuario = req.user.tipo_usuario;
      const dados = { ...req.body };

      if (tipoUsuario === 'FREELANCER') {
        // sanitização dos campos de texto livres
        if (dados.titulo !== undefined) dados.titulo = limparTexto(dados.titulo, 150);
        if (dados.descricao !== undefined) dados.descricao = limparTexto(dados.descricao, 1000);
        if (dados.localizacao !== undefined) dados.localizacao = limparTexto(dados.localizacao, 100);
        if (dados.experiencia !== undefined) dados.experiencia = limparTexto(dados.experiencia, 100);
        if (dados.habilidades !== undefined) dados.habilidades = limparLista(dados.habilidades, 15, 40);
        if (dados.idiomas !== undefined) dados.idiomas = limparLista(dados.idiomas, 10, 30);
        if (dados.educacao !== undefined) dados.educacao = limparRegistros(dados.educacao);
        if (dados.experiencia_prof !== undefined) dados.experiencia_prof = limparRegistros(dados.experiencia_prof);
        if (dados.certificacoes !== undefined) dados.certificacoes = limparRegistros(dados.certificacoes);
        if (dados.metodos_recebimento !== undefined) dados.metodos_recebimento = limparMetodos(dados.metodos_recebimento);
        if (dados.nivel !== undefined && !['iniciante', 'intermedio', 'especialista'].includes(dados.nivel)) {
          return res.status(400).json({ success: false, message: 'Nível inválido' });
        }
        if (dados.anos_experiencia !== undefined) {
          dados.anos_experiencia = Math.max(0, Math.min(60, parseInt(dados.anos_experiencia, 10) || 0));
        }
        if (dados.preco_por_hora !== undefined) {
          const p = Number(dados.preco_por_hora);
          if (Number.isNaN(p) || p < 0 || p > 1000000) {
            return res.status(400).json({ success: false, message: 'Preço por hora inválido' });
          }
          dados.preco_por_hora = p;
        }

        await Profile.createOrUpdate(req.user.id, dados);
        const profile = await Profile.getByUserId(req.user.id);
        const stats = await Profile.estatisticas(req.user.id);
        res.json({ success: true, message: 'Perfil atualizado', profile: { ...profile, estatisticas: stats } });
      } else {
        // cliente/admin — campos básicos via users
        const user = await User.update(req.user.id, dados);
        const { senha_hash: _, ...userSemSenha } = user;
        res.json({ success: true, message: 'Perfil atualizado', user: userSemSenha });
      }
    } catch (err) {
      console.error('[USER] Erro ao atualizar perfil:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  /* ---------------- Avatar e capa ---------------- */
  async uploadAvatar(req, res) {
    try {
      if (!verificarRateLimit(req.user.id)) {
        return res.status(429).json({ success: false, message: 'Demasiados envios. Aguarde um minuto.' });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada' });
      }
      const url = await salvarImagem(req.file.buffer, 'avatar');
      const user = await User.findById(req.user.id);
      if (user && user.foto && user.foto !== url) apagarArquivo(user.foto);
      const atualizado = await User.update(req.user.id, { foto: url });
      const { senha_hash: _, ...semSenha } = atualizado;
      res.json({ success: true, message: 'Foto de perfil atualizada', url, user: semSenha });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ success: false, message: err.message || 'Erro no envio' });
    }
  },

  async removerAvatar(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (user && user.foto) {
        apagarArquivo(user.foto);
        await User.update(req.user.id, { foto: null });
      }
      const atualizado = await User.findById(req.user.id);
      const { senha_hash: _, ...semSenha } = atualizado;
      res.json({ success: true, message: 'Foto de perfil removida', user: semSenha });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async uploadCapa(req, res) {
    try {
      if (!verificarRateLimit(req.user.id)) {
        return res.status(429).json({ success: false, message: 'Demasiados envios. Aguarde um minuto.' });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada' });
      }
      const url = await salvarImagem(req.file.buffer, 'capa');
      const user = await User.findById(req.user.id);
      if (user && user.capa && user.capa !== url) apagarArquivo(user.capa);
      const atualizado = await User.update(req.user.id, { capa: url });
      const { senha_hash: _, ...semSenha } = atualizado;
      res.json({ success: true, message: 'Capa atualizada', url, user: semSenha });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ success: false, message: err.message || 'Erro no envio' });
    }
  },

  async removerCapa(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (user && user.capa) {
        apagarArquivo(user.capa);
        await User.update(req.user.id, { capa: null });
      }
      const atualizado = await User.findById(req.user.id);
      const { senha_hash: _, ...semSenha } = atualizado;
      res.json({ success: true, message: 'Capa removida', user: semSenha });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  /* ---------------- Dados da conta (todos os tipos) ---------------- */
  async updateMe(req, res) {
    try {
      const b = req.body || {};
      const campos = {};

      if (b.nome !== undefined) {
        const nome = limparTexto(b.nome, 100);
        if (!nome || nome.length < 2) return res.status(400).json({ success: false, message: 'Nome inválido' });
        campos.nome = nome;
      }
      if (b.nome_utilizador !== undefined) {
        const u = String(b.nome_utilizador || '').trim();
        if (!RE_USERNAME.test(u)) {
          return res.status(400).json({ success: false, message: 'Nome de utilizador inválido (3-40 caracteres, letras, números, ponto ou _)' });
        }
        const [dup] = await db.query('SELECT id FROM users WHERE nome_utilizador = ? AND id != ?', [u, req.user.id]);
        if (dup.length) return res.status(409).json({ success: false, message: 'Nome de utilizador já está em uso' });
        campos.nome_utilizador = u;
      }
      if (b.email !== undefined) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email))) {
          return res.status(400).json({ success: false, message: 'Email inválido' });
        }
        const [dup] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [b.email, req.user.id]);
        if (dup.length) return res.status(409).json({ success: false, message: 'Email já está em uso' });
        campos.email = b.email;
        campos.email_verificado = 0; // email novo precisa de reverificação
      }
      if (b.telefone !== undefined) {
        const t = limparTexto(b.telefone, 30);
        if (t && !telefoneOk(t)) {
          return res.status(400).json({ success: false, message: 'Telefone inválido — use o formato +258 8X XXX XXXX' });
        }
        campos.telefone = t;
        if (t !== (await User.findById(req.user.id)).telefone) campos.telefone_verificado = 0;
      }
      if (b.whatsapp !== undefined) {
        const w = limparTexto(b.whatsapp, 30);
        if (w && !telefoneOk(w)) {
          return res.status(400).json({ success: false, message: 'WhatsApp inválido — use o formato +258 8X XXX XXXX' });
        }
        campos.whatsapp = w;
      }
      if (b.bio !== undefined) campos.bio = limparTexto(b.bio, 160);
      if (b.sobre_mim !== undefined) campos.sobre_mim = limparTexto(b.sobre_mim, 1000);
      if (b.provincia !== undefined) {
        const p = limparTexto(b.provincia, 60);
        if (p && !PROVINCIAS.includes(p)) {
          return res.status(400).json({ success: false, message: 'Província inválida' });
        }
        campos.provincia = p;
      }
      if (b.cidade !== undefined) campos.cidade = limparTexto(b.cidade, 60);
      if (b.idiomas !== undefined) campos.idiomas = limparLista(b.idiomas, 10, 30);
      for (const social of ['linkedin', 'instagram', 'facebook', 'site_pessoal']) {
        if (b[social] !== undefined) {
          const v = limparTexto(b[social], 255);
          if (v && !urlOk(v)) {
            return res.status(400).json({ success: false, message: `URL inválida em ${social}` });
          }
          campos[social] = v;
        }
      }
      if (b.tipo_cliente !== undefined) {
        if (!['pessoa', 'empresa'].includes(b.tipo_cliente)) {
          return res.status(400).json({ success: false, message: 'Tipo de cliente inválido' });
        }
        campos.tipo_cliente = b.tipo_cliente;
      }
      if (b.nome_empresa !== undefined) campos.nome_empresa = limparTexto(b.nome_empresa, 120);
      if (b.setor !== undefined) campos.setor = limparTexto(b.setor, 80);
      if (b.tamanho_equipa !== undefined) campos.tamanho_equipa = limparTexto(b.tamanho_equipa, 30);
      if (b.foto !== undefined) campos.foto = b.foto; // usado só pelo fluxo interno

      const user = await User.update(req.user.id, campos);
      const { senha_hash: _, ...userSemSenha } = user;
      res.json({ success: true, message: 'Dados atualizados', user: userSemSenha });
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Valor já em uso' });
      }
      console.error('[USER] Erro ao atualizar dados:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  /* ---------------- Senha ---------------- */
  async alterarSenha(req, res) {
    try {
      const { senhaAtual, novaSenha } = req.body || {};
      if (!senhaAtual || !novaSenha) {
        return res.status(400).json({ success: false, message: 'Indique a senha atual e a nova senha' });
      }
      if (String(novaSenha).length < 8) {
        return res.status(400).json({ success: false, message: 'A nova senha deve ter pelo menos 8 caracteres' });
      }
      const user = await User.findById(req.user.id);
      const ok = await bcrypt.compare(senhaAtual, user.senha_hash);
      if (!ok) {
        return res.status(403).json({ success: false, message: 'Senha atual incorreta' });
      }
      const hash = await bcrypt.hash(novaSenha, 10);
      await User.updateSenha(req.user.id, hash);
      res.json({ success: true, message: 'Senha alterada com sucesso' });
    } catch (err) {
      console.error('[USER] Erro ao alterar senha:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  /* ---------------- Completude ---------------- */
  async getCompletude(req, res) {
    try {
      const c = await Profile.completude(req.user.id);
      res.json({ success: true, completude: c });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  /* ---------------- Verificação de telefone (DEV: código fixo) ---------------- */
  async pedirCodigoTelefone(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user.telefone) {
        return res.status(400).json({ success: false, message: 'Guarde primeiro o seu número de telefone' });
      }
      /* ⚠️ MODO DESENVOLVIMENTO: código fixo 123456 (não há serviço SMS no ambiente local).
         Em produção, integrar um provedor (ex.: Twilio/Vodacom SMS) e NUNCA devolver o código. */
      const CODIGO_DEV = '123456';
      res.json({
        success: true,
        message: 'Código enviado para o seu telefone',
        ...(process.env.NODE_ENV === 'production' ? {} : { codigo_dev: CODIGO_DEV }),
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async verificarTelefone(req, res) {
    try {
      const { codigo } = req.body || {};
      /* ⚠️ DEV: aceita o código fixo 123456 (ver comentário acima) */
      const CODIGO_DEV = '123456';
      if (String(codigo || '') !== CODIGO_DEV) {
        return res.status(400).json({ success: false, message: 'Código incorreto' });
      }
      await User.update(req.user.id, { telefone_verificado: 1 });
      const user = await User.findById(req.user.id);
      const { senha_hash: _, ...semSenha } = user;
      res.json({ success: true, message: 'Telefone verificado ✓', user: semSenha });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  /* ---------------- Freelancers ---------------- */
  async listFreelancers(req, res) {
    try {
      const { categoria, busca, ordem, page, limit } = req.query;
      const freelancers = await Profile.listFreelancers({ categoria, busca, ordem, page, limit });
      res.json({ success: true, freelancers });
    } catch (err) {
      console.error('[USER] Erro ao listar freelancers:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async getFreelancerById(req, res) {
    try {
      const profile = await Profile.getByUserId(req.params.id);
      if (!profile) {
        return res.status(404).json({ success: false, message: 'Freelancer não encontrado' });
      }
      const stats = await Profile.estatisticas(req.params.id);
      const portfolio = await Portfolio.listarPorUser(req.params.id);
      // perfil público: sem métodos de recebimento (privado)
      const publico = Profile.semPrivados(profile);
      res.json({ success: true, profile: { ...publico, estatisticas: stats, portfolio } });
    } catch (err) {
      console.error('[USER] Erro ao obter freelancer:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  /* ---------------- Perfil público de cliente (simples) ---------------- */
  async getClientePublico(req, res) {
    try {
      const user = await User.findByIdPublico(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilizador não encontrado' });
      }
      const [dados] = await db.query(
        "SELECT COUNT(*) as projetos_publicados, COALESCE(SUM(valor),0) as total_investido FROM projects WHERE cliente_id = ? AND status IN ('CONCLUIDO','EM_ANDAMENTO','ENTREGUE')",
        [req.params.id]
      );
      const [aval] = await db.query(
        'SELECT COALESCE(ROUND(AVG(nota),1),0) as media, COUNT(*) as total FROM reviews WHERE avaliado_id = ?',
        [req.params.id]
      );
      res.json({
        success: true,
        cliente: {
          id: user.id, nome: user.nome, nome_utilizador: user.nome_utilizador,
          foto: user.foto, capa: user.capa, bio: user.bio, sobre_mim: user.sobre_mim,
          cidade: user.cidade, provincia: user.provincia, pais: user.pais,
          tipo_cliente: user.tipo_cliente, nome_empresa: user.nome_empresa, setor: user.setor,
          email_verificado: user.email_verificado, telefone_verificado: user.telefone_verificado,
          verificado_plataforma: user.verificado_plataforma,
          membro_desde: user.created_at,
          estatisticas: {
            projetos_publicados: Number(dados[0].projetos_publicados || 0),
            total_investido: parseFloat(dados[0].total_investido || 0),
            avaliacao_media: parseFloat(aval[0].media || 0),
            total_avaliacoes: Number(aval[0].total || 0),
          },
        },
      });
    } catch (err) {
      console.error('[USER] Erro ao obter cliente:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  /* ---------------- Dashboard (inalterado na forma) ---------------- */
  async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      const tipo = req.user.tipo_usuario;

      const col = tipo === 'CLIENTE' ? 'cliente_id' : 'freelancer_id';

      const [totalProjs] = await db.query(`SELECT COUNT(*) as total FROM projects WHERE ${col} = ?`, [userId]);
      const [concluidos] = await db.query(`SELECT COUNT(*) as total FROM projects WHERE ${col} = ? AND status = 'CONCLUIDO'`, [userId]);
      const [andamento] = await db.query(`SELECT COUNT(*) as total FROM projects WHERE ${col} = ? AND status = 'EM_ANDAMENTO'`, [userId]);
      const [pendentes] = await db.query(`SELECT COUNT(*) as total FROM projects WHERE ${col} = ? AND status = 'PENDENTE'`, [userId]);

      const [valorTotal] = await db.query(`SELECT COALESCE(SUM(valor),0) as total FROM projects WHERE ${col} = ? AND status = 'CONCLUIDO'`, [userId]);

      let rating = { media: 0, total: 0 };
      if (tipo === 'FREELANCER') {
        rating = await Review.averageRating(userId);
      }

      /* FASE A: métricas financeiras reais (carteira + escrow) */
      const financeiro = { saldo: 0, pendente: 0 };
      try {
        const [[w]] = await db.query('SELECT balance FROM wallets WHERE user_id = ?', [userId]);
        financeiro.saldo = Number(w ? w.balance : 0);
        if (tipo === 'FREELANCER') {
          const [rows] = await db.query(`
            SELECT COALESCE(SUM(amount_held - platform_fee), 0) as total
            FROM escrow e JOIN projects p ON p.id = e.project_id
            WHERE p.freelancer_id = ? AND e.status = 'RETIDO'
          `, [userId]);
          financeiro.pendente = Number(rows[0].total);
        } else {
          const [rows] = await db.query(`
            SELECT COALESCE(SUM(amount_held), 0) as total
            FROM escrow e JOIN projects p ON p.id = e.project_id
            WHERE p.cliente_id = ? AND e.status IN ('RETIDO','EM_DISPUTA')
          `, [userId]);
          financeiro.pendente = Number(rows[0].total);
        }
      } catch (e) { /* carteira ainda não existe */ }

      const [recentes] = await db.query(`
        SELECT pr.*, c.nome as cliente_nome, c.foto as cliente_foto, f.nome as freelancer_nome, f.foto as freelancer_foto, s.titulo as servico_titulo
        FROM projects pr
        JOIN users c ON pr.cliente_id = c.id
        JOIN users f ON pr.freelancer_id = f.id
        LEFT JOIN services s ON pr.servico_id = s.id
        WHERE pr.${col} = ?
        ORDER BY pr.created_at DESC LIMIT 5
      `, [userId]);

      res.json({
        success: true,
        dashboard: {
          total_projetos: totalProjs[0].total,
          projetos_concluidos: concluidos[0].total,
          projetos_andamento: andamento[0].total,
          projetos_pendentes: pendentes[0].total,
          valor_total_concluido: parseFloat(valorTotal[0].total || 0),
          financeiro,
          rating,
          projetos_recentes: recentes,
        },
      });
    } catch (err) {
      console.error('[USER] Erro no dashboard:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },
};

module.exports = userController;
