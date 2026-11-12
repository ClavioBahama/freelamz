const Message = require('../models/Message');
const Notification = require('../models/Notification');

async function notify(userId, tipo, titulo, mensagem) {
  try { await Notification.create(userId, tipo, titulo, mensagem); } catch (e) {}
}

const messageController = {
  async send(req, res) {
    try {
      const { destinatario_id, projeto_id, texto } = req.body;
      const remetente_id = req.user.id;

      if (!destinatario_id || !texto) {
        return res.status(400).json({ success: false, message: 'Destinatário e mensagem são obrigatórios' });
      }

      const message = await Message.send({ remetente_id, destinatario_id, projeto_id, texto });

      await notify(destinatario_id, 'nova_mensagem', 'Nova mensagem', `Você recebeu uma nova mensagem de ${req.user.nome || 'um usuário'}.`);

      res.status(201).json({ success: true, message });
    } catch (err) {
      console.error('[MSG] Erro ao enviar mensagem:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async conversation(req, res) {
    try {
      const { destinatario_id, projeto_id } = req.query;
      if (!destinatario_id) {
        return res.status(400).json({ success: false, message: 'Destinatário é obrigatório' });
      }
      const mensagens = await Message.conversation(req.user.id, destinatario_id, projeto_id, { page: req.query.page, limit: req.query.limit });
      await Message.markAsRead(req.user.id, destinatario_id);
      res.json({ success: true, mensagens });
    } catch (err) {
      console.error('[MSG] Erro ao obter conversa:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async listConversations(req, res) {
    try {
      const conversas = await Message.listConversations(req.user.id);
      // Adicionar contagem de não lidas por conversa
      const result = await Promise.all(conversas.map(async (c) => {
        const unread = await Message.unreadCountForPair(req.user.id, c.outro_id || c.remetente_id || c.destinatario_id);
        return { ...c, nao_lidas: unread };
      }));
      res.json({ success: true, conversas: result });
    } catch (err) {
      console.error('[MSG] Erro ao listar conversas:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },

  async unreadCount(req, res) {
    try {
      const total = await Message.unreadCount(req.user.id);
      res.json({ success: true, total });
    } catch (err) {
      console.error('[MSG] Erro ao contar não lidas:', err);
      res.status(500).json({ success: false, message: 'Erro interno' });
    }
  },
};

// Adicionado ao model para contagem de não lidas por par
require('../models/Message').unreadCountForPair = async (userId, outroId) => {
  const db = require('../config/db');
  const sql = `SELECT COUNT(*) as total FROM messages WHERE destinatario_id = ? AND remetente_id = ? AND lida = 0`;
  const [rows] = await db.query(sql, [userId, outroId]);
  return rows[0].total;
};

module.exports = messageController;
