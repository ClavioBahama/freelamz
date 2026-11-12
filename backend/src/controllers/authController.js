const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Notification = require('../models/Notification');

const JWT_SECRET = process.env.JWT_SECRET || 'freelamz_secret_dev_2024_mudar_em_producao';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, tipo_usuario: user.tipo_usuario },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function sendNotification(userId, tipo, titulo, mensagem) {
  try {
    await Notification.create(userId, tipo, titulo, mensagem);
  } catch (e) {
    console.error('[NOTIF] Erro ao criar notificação:', e.message);
  }
}

const authController = {
  async register(req, res) {
    try {
      const { nome, email, telefone, senha, tipoUsuario, cidade, provincia, pais } = req.body;

      if (!nome || !email || !senha || !tipoUsuario) {
        return res.status(400).json({ success: false, message: 'Nome, email, senha e tipo de usuário são obrigatórios' });
      }

      const existente = await User.findByEmail(email);
      if (existente) {
        return res.status(409).json({ success: false, message: 'Email já cadastrado' });
      }

      const senhaHash = await bcrypt.hash(senha, 10);

      const user = await User.create({
        nome, email, telefone: telefone || null, senhaHash, tipoUsuario,
        cidade: cidade || null, provincia: provincia || null, pais: pais || 'Moçambique',
      });

      // Criar perfil vazio para freelancer
      if (tipoUsuario === 'FREELANCER') {
        await Profile.createOrUpdate(user.id, {});
      }

      await sendNotification(user.id, 'boas_vindas', 'Bem-vindo(a) ao FreelaMZ!', 'Sua conta foi criada com sucesso. Comece a explorar oportunidades.');

      const token = generateToken(user);
      const { senha_hash: _, ...userSemSenha } = user;

      res.status(201).json({
        success: true,
        message: 'Cadastro realizado com sucesso',
        token,
        user: userSemSenha,
      });
    } catch (err) {
      console.error('[AUTH] Erro no registro:', err);
      res.status(500).json({ success: false, message: 'Erro interno ao cadastrar' });
    }
  },

  async login(req, res) {
    try {
      const { email, senha } = req.body;
      if (!email || !senha) {
        return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios' });
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Email ou senha inválidos' });
      }

      const senhaValida = await bcrypt.compare(senha, user.senha_hash);
      if (!senhaValida) {
        return res.status(401).json({ success: false, message: 'Email ou senha inválidos' });
      }

      if (user.status === 'bloqueado') {
        return res.status(403).json({ success: false, message: 'Sua conta está bloqueada. Entre em contato com o suporte.' });
      }

      // último acesso
      User.registrarAtividade(user.id).catch(() => {});
      const token = generateToken(user);
      const { senha_hash: _, ...userSemSenha } = user;

      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        token,
        user: userSemSenha,
      });
    } catch (err) {
      console.error('[AUTH] Erro no login:', err);
      res.status(500).json({ success: false, message: 'Erro interno ao fazer login' });
    }
  },

  async me(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      }
      User.registrarAtividade(user.id).catch(() => {});
      const { senha_hash: _, ...userSemSenha } = user;
      res.json({ success: true, user: userSemSenha });
    } catch (err) {
      console.error('[AUTH] Erro ao obter usuário:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async logout(req, res) {
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  },
};

module.exports = authController;
