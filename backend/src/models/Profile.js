const db = require('../config/db');

/* Normaliza JSON (educacao/experiencia/certificacoes/metodos) que o mysql2 devolve como string */
function parseListas(p) {
  if (!p) return p;
  const parse = (v) => {
    if (v == null) return [];
    if (Array.isArray(v)) return v;
    try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch (e) { return []; }
  };
  const parseObj = (v) => {
    if (v == null) return {};
    if (typeof v === 'object' && !Array.isArray(v)) return v;
    try { return JSON.parse(v); } catch (e) { return {}; }
  };
  return {
    ...p,
    habilidades: p.habilidades ? p.habilidades.split(',').map((s) => s.trim()).filter(Boolean) : [],
    idiomas: p.idiomas ? p.idiomas.split(',').map((s) => s.trim()).filter(Boolean) : [],
    educacao: parse(p.educacao),
    experiencia_prof: parse(p.experiencia_prof),
    certificacoes: parse(p.certificacoes),
    metodos_recebimento: parseObj(p.metodos_recebimento),
  };
}

/* Remove campos sensíveis (visíveis só para o dono/admin) */
function semPrivados(profile) {
  if (!profile) return null;
  const { metodos_recebimento, ...resto } = profile;
  return resto;
}

/* ---------- Estatísticas calculadas por utilizador ---------- */
async function estatisticas(userId) {
  const [av] = await db.query(
    'SELECT COALESCE(ROUND(AVG(nota),1),0) as media, COUNT(*) as total FROM reviews WHERE avaliado_id = ?', [userId]
  );
  const [pj] = await db.query(
    "SELECT COUNT(*) as concluidos, COALESCE(SUM(valor),0) as ganho FROM projects WHERE freelancer_id = ? AND status = 'CONCLUIDO'", [userId]
  );
  // Taxa de resposta: remetentes distintos que escreveram ao utilizador e que receberam resposta
  const [tr] = await db.query(
    `SELECT
       COUNT(DISTINCT m1.remetente_id) as recebidos,
       COUNT(DISTINCT m2.destinatario_id) as respondidos
     FROM messages m1
     LEFT JOIN messages m2
       ON m2.remetente_id = m1.destinatario_id
      AND m2.destinatario_id = m1.remetente_id
      AND m2.created_at >= m1.created_at
     WHERE m1.destinatario_id = ?`,
    [userId]
  );
  const recebidos = Number(tr[0].recebidos || 0);
  const respondidos = Number(tr[0].respondidos || 0);
  const taxa = recebidos > 0 ? Math.min(100, Math.round((respondidos / recebidos) * 100)) : 0;
  const concluidos = Number(pj[0].concluidos || 0);
  const media = parseFloat(av[0].media || 0);
  return {
    nota_media: media,
    total_avaliacoes: Number(av[0].total || 0),
    projetos_concluidos: concluidos,
    total_ganho: parseFloat(pj[0].ganho || 0),
    taxa_resposta: taxa,
    top_rated: media >= 4.7 && concluidos >= 5,
  };
}

const Profile = {
  async getByUserId(userId) {
    const sql = `
      SELECT p.*, u.nome, u.nome_utilizador, u.foto as user_foto, u.capa as user_capa,
        u.status as user_status, u.bio, u.sobre_mim as user_sobre, u.cidade as user_cidade,
        u.provincia as user_provincia, u.idiomas as user_idiomas, u.whatsapp,
        u.email_verificado, u.telefone_verificado, u.verificado_plataforma,
        u.created_at as membro_desde, u.linkedin, u.instagram, u.facebook, u.site_pessoal
      FROM profiles p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ?
    `;
    const [rows] = await db.query(sql, [userId]);
    return parseListas(rows[0] || null);
  },

  async createOrUpdate(userId, data) {
    const existing = await this.getByUserId(userId);
    const educacao = data.educacao !== undefined ? JSON.stringify(data.educacao || []) : existing ? JSON.stringify(existing.educacao || []) : '[]';
    const experienciaProf = data.experiencia_prof !== undefined ? JSON.stringify(data.experiencia_prof || []) : existing ? JSON.stringify(existing.experiencia_prof || []) : '[]';
    const certificacoes = data.certificacoes !== undefined ? JSON.stringify(data.certificacoes || []) : existing ? JSON.stringify(existing.certificacoes || []) : '[]';
    const metodos = data.metodos_recebimento !== undefined ? JSON.stringify(data.metodos_recebimento || {}) : existing ? JSON.stringify(existing.metodos_recebimento || {}) : '{}';

    const campos = {
      titulo: data.titulo !== undefined ? data.titulo : (existing && existing.titulo),
      descricao: data.descricao !== undefined ? data.descricao : (existing && existing.descricao),
      localizacao: data.localizacao !== undefined ? data.localizacao : (existing && existing.localizacao),
      habilidades: data.habilidades !== undefined ? data.habilidades : (existing && existing.habilidades && existing.habilidades.join(', ')),
      experiencia: data.experiencia !== undefined ? data.experiencia : (existing && existing.experiencia),
      idiomas: data.idiomas !== undefined ? data.idiomas : (existing && existing.idiomas && existing.idiomas.join(', ')),
      preco_por_hora: data.preco_por_hora !== undefined ? data.preco_por_hora : (existing && existing.preco_por_hora),
      disponibilidade: data.disponibilidade !== undefined ? data.disponibilidade : (existing && existing.disponibilidade) || 'disponivel',
      foto: data.foto !== undefined ? data.foto : (existing && existing.foto),
      categoria_id: data.categoria_id !== undefined ? data.categoria_id : (existing && existing.categoria_id),
      nivel: data.nivel !== undefined ? data.nivel : (existing && existing.nivel) || 'iniciante',
      anos_experiencia: data.anos_experiencia !== undefined ? data.anos_experiencia : (existing && existing.anos_experiencia) || 0,
    };
    if (existing) {
      const sql = `
        UPDATE profiles SET
          titulo = ?, descricao = ?, localizacao = ?, habilidades = ?, experiencia = ?,
          idiomas = ?, preco_por_hora = ?, disponibilidade = ?, foto = ?,
          categoria_id = ?, nivel = ?, anos_experiencia = ?,
          educacao = ?, experiencia_prof = ?, certificacoes = ?, metodos_recebimento = ?
        WHERE user_id = ?
      `;
      await db.query(sql, [
        campos.titulo, campos.descricao, campos.localizacao, campos.habilidades, campos.experiencia,
        campos.idiomas, campos.preco_por_hora, campos.disponibilidade, campos.foto,
        campos.categoria_id, campos.nivel, campos.anos_experiencia,
        educacao, experienciaProf, certificacoes, metodos, userId,
      ]);
      return this.getByUserId(userId);
    }
    const sql = `
      INSERT INTO profiles (user_id, titulo, descricao, localizacao, habilidades, experiencia, idiomas,
        preco_por_hora, disponibilidade, foto, categoria_id, nivel, anos_experiencia,
        educacao, experiencia_prof, certificacoes, metodos_recebimento,
        classificacao, trabalhos_concluidos, num_avaliacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
    `;
    await db.query(sql, [
      userId, campos.titulo, campos.descricao, campos.localizacao, campos.habilidades, campos.experiencia,
      campos.idiomas, campos.preco_por_hora, campos.disponibilidade, campos.foto || null,
      campos.categoria_id, campos.nivel, campos.anos_experiencia,
      educacao, experienciaProf, certificacoes, metodos,
    ]);
    return this.getByUserId(userId);
  },

  async listFreelancers({ page = 1, limit = 20, categoria, busca, ordem = 'recente' }) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT p.*, u.id as user_id, u.nome, u.email, u.foto as user_foto, u.capa as user_capa,
        u.cidade, u.provincia, u.status, u.verificado_plataforma, u.telefone_verificado
      FROM profiles p
      JOIN users u ON p.user_id = u.id
      WHERE u.tipo_usuario = 'FREELANCER' AND u.status = 'ativo'
    `;
    const values = [];
    if (busca) {
      sql += ' AND (p.titulo LIKE ? OR p.descricao LIKE ? OR p.habilidades LIKE ?)';
      values.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
    }
    if (categoria) {
      sql += ` AND EXISTS (
        SELECT 1 FROM user_skills us JOIN categories c ON us.categoria_id = c.id
        WHERE us.user_id = u.id AND c.id = ?
      )`;
      values.push(categoria);
    }
    if (ordem === 'menor_preco') sql += ' ORDER BY p.preco_por_hora ASC';
    else if (ordem === 'maior_preco') sql += ' ORDER BY p.preco_por_hora DESC';
    else if (ordem === 'melhor_avaliacao') sql += ' ORDER BY p.classificacao DESC';
    else sql += ' ORDER BY p.created_at DESC';
    sql += ' LIMIT ? OFFSET ?';
    values.push(parseInt(limit, 10), parseInt(offset, 10));
    const [rows] = await db.query(sql, values);
    return rows.map((r) => semPrivados(parseListas(r)));
  },
};

/* ---------- Completude do perfil ---------- */
const REGRAS_FREELANCER = [
  ['foto', 'Foto de perfil', 10],
  ['capa', 'Foto de capa', 5],
  ['bio', 'Bio curta', 5],
  ['sobre_mim', 'Sobre mim', 10],
  ['telefone', 'Telefone', 5],
  ['whatsapp', 'WhatsApp', 5],
  ['localizacao', 'Província e cidade', 5],
  ['idiomas', 'Idiomas', 5],
  ['titulo', 'Título profissional', 5],
  ['categoria_id', 'Categoria principal', 5],
  ['habilidades3', 'Pelo menos 3 habilidades', 10],
  ['preco_por_hora', 'Preço por hora', 5],
  ['educacao1', 'Educação registada', 5],
  ['experiencia1', 'Experiência registada', 5],
  ['portfolio1', 'Item no portfólio', 10],
  ['metodos', 'Método de recebimento', 5],
];

const REGRAS_CLIENTE = [
  ['foto', 'Foto de perfil', 15],
  ['capa', 'Foto de capa', 10],
  ['bio', 'Bio curta', 10],
  ['sobre_mim', 'Sobre mim', 15],
  ['telefone', 'Telefone', 10],
  ['whatsapp', 'WhatsApp', 5],
  ['localizacao', 'Província e cidade', 10],
  ['idiomas', 'Idiomas', 5],
  ['empresa', 'Dados de empresa/pessoa', 10],
  ['site_pessoal', 'Site ou rede social', 10],
];

async function completude(userId) {
  const [u] = await db.query(
    'SELECT foto, capa, bio, sobre_mim, telefone, whatsapp, provincia, cidade, idiomas, tipo_usuario, site_pessoal, linkedin, instagram, facebook, tipo_cliente, nome_empresa FROM users WHERE id = ?',
    [userId]
  );
  if (!u.length) return { percentual: 0, itens: [] };
  const user = u[0];
  const [p] = await db.query('SELECT titulo, categoria_id, preco_por_hora, habilidades, educacao, experiencia_prof, metodos_recebimento FROM profiles WHERE user_id = ?', [userId]);
  const [pf] = await db.query('SELECT COUNT(*) as total FROM portfolio_items WHERE user_id = ?', [userId]);
  const profile = p[0] || {};
  const temPortfolio = Number(pf[0].total || 0) > 0;
  const hab = (profile.habilidades || '').split(',').map((s) => s.trim()).filter(Boolean);
  const educ = (() => { try { const j = JSON.parse(profile.educacao || '[]'); return Array.isArray(j) ? j : []; } catch (e) { return []; } })();
  const exp = (() => { try { const j = JSON.parse(profile.experiencia_prof || '[]'); return Array.isArray(j) ? j : []; } catch (e) { return []; } })();
  const metodos = (() => { try { const j = JSON.parse(profile.metodos_recebimento || '{}'); return Object.keys(j).filter((k) => j[k]); } catch (e) { return []; } })();

  const valores = {
    foto: !!user.foto,
    capa: !!user.capa,
    bio: !!(user.bio && user.bio.trim()),
    sobre_mim: !!(user.sobre_mim && user.sobre_mim.trim()),
    telefone: !!user.telefone,
    whatsapp: !!user.whatsapp,
    localizacao: !!(user.provincia && user.cidade),
    idiomas: !!(user.idiomas && user.idiomas.trim()),
    titulo: !!(profile.titulo && profile.titulo.trim()),
    categoria_id: !!profile.categoria_id,
    habilidades3: hab.length >= 3,
    preco_por_hora: parseFloat(profile.preco_por_hora || 0) > 0,
    educacao1: educ.length > 0,
    experiencia1: exp.length > 0,
    portfolio1: temPortfolio,
    metodos: metodos.length > 0,
    empresa: !!(user.tipo_cliente && (user.tipo_cliente === 'pessoa' || user.nome_empresa)),
    site_pessoal: !!(user.site_pessoal || user.linkedin || user.instagram || user.facebook),
  };
  const regras = user.tipo_usuario === 'FREELANCER' ? REGRAS_FREELANCER : REGRAS_CLIENTE;
  let pontos = 0;
  let maximo = 0;
  const itens = regras.map(([chave, rotulo, peso]) => {
    maximo += peso;
    const ok = !!valores[chave];
    if (ok) pontos += peso;
    return { chave, rotulo, peso, ok };
  });
  return { percentual: Math.round((pontos / maximo) * 100), itens };
}

/* Mantém compatibilidade: Profile.getByUserId etc. continuam a funcionar,
   e os helpers ficam disponíveis como Profile.estatisticas / Profile.completude */
Object.assign(Profile, { estatisticas, completude, semPrivados, parseListas });

module.exports = Profile;
