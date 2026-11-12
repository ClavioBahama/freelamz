/* ============================================================
   FreelaMZ — Dados de demonstração (opcional)

   Cria, de forma IDEMPOTENTE, freelancers e serviços de exemplo
   para a aplicação não aparecer vazia. NÃO apaga nada.

   - Contas: 8 freelancers + 2 clientes
   - Senha de todas as contas de demonstração: DEMO_PASSWORD
     (por omissão "Demo1234")
   - E-mails terminados em @demo.freelamz.mz

   Como correr a partir do PC contra o MySQL do Railway:
     $env:MYSQL_URL="mysql://...URL PUBLICA..."
     $env:DB_SSL="true"
     npm run db:demo

   Para remover estes dados mais tarde:
     $env:MYSQL_URL="..."
     npm run db:demo:limpar
   ============================================================ */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { opcoesMysql, obterConfigBanco, resumoConfig, validarConfigBanco } = require('../src/config/dbConfig');

const SENHA = String(process.env.DEMO_PASSWORD || 'Demo1234');
const DOMINIO = 'demo.freelamz.mz';
const LIMPAR = process.argv.includes('--limpar');
/* Quando executado por `npm run db:demo` sai com código 1 em erro;
   quando chamado pelo servidor (SEED_DEMO=true) lança o erro em vez
   de matar o processo. */
const CLI = require.main === module;

/* Categorias por nome (os ids são resolvidos na base de dados). */
const FREELANCERS = [
  {
    nome: 'Isabel Sitoe', email: `isabel@${DOMINIO}`, telefone: '+258 84 100 0001',
    cidade: 'Maputo', provincia: 'Maputo', categoria: 'Desenvolvimento Web',
    titulo: 'Desenvolvedora Web Full-Stack',
    bio: 'Sites, lojas online e sistemas web em React e Node.js.',
    sobre_mim: 'Crio websites modernos e lojas online com React e Node.js. Foco em performance, SEO e design responsivo para negócios moçambicanos.',
    habilidades: ['React', 'Node.js', 'JavaScript', 'MySQL', 'WordPress'],
    preco: 1500, nivel: 'especialista', anos: 6, nota: 5.0, avaliacoes: 12,
    servicos: [
      { categoria: 'Desenvolvimento Web', titulo: 'Site profissional em WordPress', preco: 15000, prazo: '5 dias', descricao: 'Site completo com design responsivo, página inicial, contacto e sobre. Ideal para negócios locais.' },
      { categoria: 'Desenvolvimento Web', titulo: 'Loja online com pagamentos M-Pesa', preco: 45000, prazo: '15 dias', descricao: 'Loja virtual com catálogo, carrinho, checkout e painel de administração.' },
    ],
  },
  {
    nome: 'Carlos Mabjaia', email: `carlos@${DOMINIO}`, telefone: '+258 84 100 0002',
    cidade: 'Maputo', provincia: 'Maputo', categoria: 'Desenvolvimento Web',
    titulo: 'Especialista em WordPress',
    bio: 'Instalação, personalização e segurança de sites WordPress.',
    sobre_mim: 'Instalação, personalização e manutenção de sites WordPress, incluindo segurança e migrações sem downtime.',
    habilidades: ['WordPress', 'PHP', 'Elementor', 'WooCommerce', 'Segurança Web'],
    preco: 950, nivel: 'especialista', anos: 7, nota: 4.8, avaliacoes: 9,
    servicos: [
      { categoria: 'Desenvolvimento Web', titulo: 'Instalo e personalizo o seu site em WordPress', preco: 12000, prazo: '5 dias', descricao: 'Instalação do WordPress, tema personalizado com as suas cores, 5 páginas e plugins essenciais de segurança.' },
    ],
  },
  {
    nome: 'Beatriz Cossa', email: `beatriz@${DOMINIO}`, telefone: '+258 84 100 0003',
    cidade: 'Beira', provincia: 'Sofala', categoria: 'Design Gráfico',
    titulo: 'Designer Gráfica & Identidade Visual',
    bio: 'Logótipos e identidade visual para marcas moçambicanas.',
    sobre_mim: 'Logótipos, identidade visual e materiais gráficos que dão vida às marcas. Portfólio com 40+ marcas moçambicanas.',
    habilidades: ['Photoshop', 'Illustrator', 'Figma', 'Branding'],
    preco: 1100, nivel: 'especialista', anos: 5, nota: 4.9, avaliacoes: 15,
    servicos: [
      { categoria: 'Design Gráfico', titulo: 'Logótipo e identidade visual', preco: 7500, prazo: '4 dias', descricao: 'Logótipo exclusivo em formatos para web e impressão, cartão de visita e mini-manual de marca.' },
      { categoria: 'Design Gráfico', titulo: 'Design de 10 posts para redes sociais', preco: 3500, prazo: '3 dias', descricao: 'Dez posts com identidade visual coerente para Instagram e Facebook, incluindo stories.' },
    ],
  },
  {
    nome: 'Hélder Nhamirre', email: `helder@${DOMINIO}`, telefone: '+258 84 100 0004',
    cidade: 'Matola', provincia: 'Maputo', categoria: 'Programação',
    titulo: 'Programador de Apps Mobile',
    bio: 'Aplicações Android e iOS com React Native.',
    sobre_mim: 'Desenvolvo aplicações Android e iOS com React Native, desde o protótipo até à publicação nas lojas.',
    habilidades: ['React Native', 'Kotlin', 'Firebase', 'APIs REST'],
    preco: 1800, nivel: 'especialista', anos: 6, nota: 4.7, avaliacoes: 7,
    servicos: [
      { categoria: 'Programação', titulo: 'Aplicação móvel Android/iOS', preco: 60000, prazo: '30 dias', descricao: 'App completa com autenticação, notificações e publicação na Play Store.' },
    ],
  },
  {
    nome: 'Rosa Chiziane', email: `rosa@${DOMINIO}`, telefone: '+258 84 100 0005',
    cidade: 'Pemba', provincia: 'Cabo Delgado', categoria: 'Fotografia',
    titulo: 'Fotógrafa Profissional',
    bio: 'Eventos, produto e retratos com entrega em alta resolução.',
    sobre_mim: 'Cobertura de eventos, ensaios de produto e retratos. Entrega tratada em alta resolução.',
    habilidades: ['Lightroom', 'Photoshop', 'Fotografia de Produto', 'Eventos'],
    preco: 1200, nivel: 'especialista', anos: 7, nota: 4.8, avaliacoes: 11,
    servicos: [
      { categoria: 'Fotografia', titulo: 'Cobertura fotográfica de eventos', preco: 9500, prazo: '1 dia', descricao: 'Cobertura até 4 horas (casamentos, formaturas, corporativos) com 100 fotos tratadas.' },
      { categoria: 'Fotografia', titulo: 'Ensaio de produto para loja online', preco: 6500, prazo: '2 dias', descricao: 'Ensaio de até 15 produtos com fundo e luz profissionais.' },
    ],
  },
  {
    nome: 'Amós Matsinhe', email: `amos@${DOMINIO}`, telefone: '+258 84 100 0006',
    cidade: 'Chimoio', provincia: 'Manica', categoria: 'Redação',
    titulo: 'Redator & Tradutor PT↔EN',
    bio: 'Artigos SEO, copywriting e tradução profissional.',
    sobre_mim: 'Artigos SEO, copywriting e tradução profissional Português↔Inglês com entrega rápida.',
    habilidades: ['SEO', 'Copywriting', 'Tradução PT-EN', 'Gramática'],
    preco: 700, nivel: 'especialista', anos: 5, nota: 5.0, avaliacoes: 8,
    servicos: [
      { categoria: 'Redação', titulo: 'Artigos SEO para o seu blog', preco: 2500, prazo: '2 dias', descricao: 'Artigos otimizados (800–1200 palavras) com pesquisa de palavras-chave incluída.' },
      { categoria: 'Tradução', titulo: 'Tradução profissional PT↔EN', preco: 3500, prazo: '3 dias', descricao: 'Tradução de documentos comerciais e académicos com revisão incluída.' },
    ],
  },
  {
    nome: 'Luís Bengo', email: `luis@${DOMINIO}`, telefone: '+258 84 100 0007',
    cidade: 'Maputo', provincia: 'Maputo', categoria: 'Contabilidade',
    titulo: 'Consultor Financeiro',
    bio: 'Planos de negócios, contabilidade e fiscalidade para PMEs.',
    sobre_mim: 'Planos de negócios, contabilidade e fiscalidade para pequenas e médias empresas.',
    habilidades: ['Contabilidade', 'Excel', 'Fiscalidade', 'Análise Financeira'],
    preco: 1600, nivel: 'especialista', anos: 8, nota: 4.9, avaliacoes: 6,
    servicos: [
      { categoria: 'Contabilidade', titulo: 'Consultoria financeira e plano de negócios', preco: 20000, prazo: '7 dias', descricao: 'Plano de negócios com projeções a 3 anos e análise de viabilidade.' },
    ],
  },
  {
    nome: 'Marta Muianga', email: `marta@${DOMINIO}`, telefone: '+258 84 100 0008',
    cidade: 'Maputo', provincia: 'Maputo', categoria: 'Marketing Digital',
    titulo: 'Gestora de Redes Sociais',
    bio: 'Gestão mensal de redes sociais com relatórios de resultados.',
    sobre_mim: 'Gestão mensal de redes sociais: calendário editorial, design de posts, community management e relatórios.',
    habilidades: ['Instagram', 'Facebook', 'TikTok', 'Canva', 'Community Management'],
    preco: 900, nivel: 'intermedio', anos: 3, nota: 4.6, avaliacoes: 5,
    servicos: [
      { categoria: 'Marketing Digital', titulo: 'Gestão de redes sociais (mensal)', preco: 6000, prazo: '30 dias', descricao: 'Calendário editorial, 12 posts por mês, respostas a mensagens e relatório mensal.' },
    ],
  },
];

const CLIENTES = [
  {
    nome: 'Ana Cliente', email: `cliente@${DOMINIO}`, telefone: '+258 84 200 0001',
    cidade: 'Maputo', provincia: 'Maputo',
    bio: 'Pequeno negócio à procura de talentos para projetos digitais.',
    sobre_mim: 'Tenho uma loja de roupa em Maputo e procuro freelancers para marketing, fotografia e website.',
  },
  {
    nome: 'Mabote Lda', email: `empresa@${DOMINIO}`, telefone: '+258 84 200 0002',
    cidade: 'Beira', provincia: 'Sofala',
    bio: 'Empresa de logística que contrata serviços digitais.',
    sobre_mim: 'Empresa de logística na Beira. Contratamos designers, redatores e programadores para projetos pontuais.',
  },
];

function falhar(msg) {
  if (!CLI) throw new Error(msg);
  console.error('[DEMO] ERRO:', msg);
  process.exit(1);
}

async function mapaCategorias(conn) {
  const [rows] = await conn.query('SELECT id, nome FROM categories');
  if (!rows.length) falhar('a tabela categories está vazia. Corra primeiro: npm run db:init');
  const mapa = new Map(rows.map((r) => [String(r.nome).trim().toLowerCase(), r.id]));
  return mapa;
}

function idCategoria(mapa, nome) {
  const id = mapa.get(String(nome).trim().toLowerCase());
  if (!id) falhar(`categoria "${nome}" não existe na base de dados.`);
  return id;
}

async function garantirSkill(conn, nome, categoriaId) {
  const [ex] = await conn.query('SELECT id FROM skills WHERE nome = ?', [nome]);
  if (ex.length) return ex[0].id;
  const [r] = await conn.query('INSERT INTO skills (nome, categoria_id) VALUES (?, ?)', [nome, categoriaId]);
  return r.insertId;
}

async function garantirUtilizador(conn, u, tipo, hash) {
  const [ex] = await conn.query('SELECT id FROM users WHERE email = ?', [u.email]);
  if (ex.length) return { id: ex[0].id, criado: false };
  const [r] = await conn.query(
    `INSERT INTO users
       (nome, email, senha_hash, tipo_usuario, telefone, cidade, provincia, pais,
        bio, sobre_mim, status, email_verificado)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Moçambique', ?, ?, 'ativo', 1)`,
    [u.nome, u.email, hash, tipo, u.telefone || null, u.cidade || null, u.provincia || null,
      u.bio || null, u.sobre_mim || null]
  );
  return { id: r.insertId, criado: true };
}

async function main() {
  const validacao = validarConfigBanco();
  if (!validacao.ok) {
    falhar(
      'faltam variáveis de ambiente da base de dados:\n  - '
      + validacao.problemas.join('\n  - ')
      + '\n  Defina-as no PowerShell ($env:MYSQL_URL=...) ou no backend/.env.'
    );
  }
  for (const aviso of validacao.avisos) console.warn('[DEMO] AVISO:', aviso);

  const cfg = obterConfigBanco();
  console.log('[DEMO] Destino:', resumoConfig(cfg));

  const conn = await mysql.createConnection(opcoesMysql());
  try {
    if (LIMPAR) {
      const [r] = await conn.query(
        'DELETE FROM users WHERE email LIKE ?',
        [`%@${DOMINIO}`]
      );
      console.log(`[DEMO] ${r.affectedRows} conta(s) de demonstração removida(s).`);
      console.log('[DEMO] Os serviços e perfis associados foram apagados em cascata.');
      return;
    }

    const cats = await mapaCategorias(conn);
    const hash = await bcrypt.hash(SENHA, 10);
    let criados = 0;
    let saltados = 0;

    for (const f of FREELANCERS) {
      const catId = idCategoria(cats, f.categoria);
      const { id, criado } = await garantirUtilizador(conn, f, 'FREELANCER', hash);
      if (criado) criados += 1; else saltados += 1;

      await conn.query(
        `INSERT INTO profiles
           (user_id, titulo, descricao, localizacao, habilidades, experiencia, idiomas,
            preco_por_hora, disponibilidade, categoria_id, nivel, anos_experiencia,
            classificacao, num_avaliacoes)
         VALUES (?, ?, ?, ?, ?, ?, 'Português, Inglês', ?, 'disponivel', ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           titulo = VALUES(titulo), descricao = VALUES(descricao),
           localizacao = VALUES(localizacao), habilidades = VALUES(habilidades),
           preco_por_hora = VALUES(preco_por_hora), categoria_id = VALUES(categoria_id),
           nivel = VALUES(nivel), anos_experiencia = VALUES(anos_experiencia)`,
        [id, f.titulo, f.sobre_mim, `${f.cidade}, ${f.provincia}`,
          f.habilidades.join(','), `${f.anos} anos`, f.preco, catId, f.nivel, f.anos,
          f.nota, f.avaliacoes]
      );

      for (const h of f.habilidades) {
        const skillId = await garantirSkill(conn, h, catId);
        await conn.query('INSERT IGNORE INTO user_skills (user_id, skill_id) VALUES (?, ?)', [id, skillId]);
      }

      await conn.query('INSERT IGNORE INTO wallets (user_id) VALUES (?)', [id]);

      const [svc] = await conn.query('SELECT id FROM services WHERE freelancer_id = ? LIMIT 1', [id]);
      if (!svc.length) {
        for (const s of f.servicos) {
          await conn.query(
            `INSERT INTO services (freelancer_id, categoria_id, titulo, descricao, preco, prazo_entrega, status)
             VALUES (?, ?, ?, ?, ?, ?, 'ativo')`,
            [id, idCategoria(cats, s.categoria), s.titulo, s.descricao, s.preco, s.prazo]
          );
        }
      }
    }

    for (const c of CLIENTES) {
      const { id, criado } = await garantirUtilizador(conn, c, 'CLIENTE', hash);
      if (criado) criados += 1; else saltados += 1;
      await conn.query('INSERT IGNORE INTO wallets (user_id) VALUES (?)', [id]);
    }

    console.log(`[DEMO] Contas criadas agora: ${criados} | já existiam: ${saltados}`);
    console.log('[DEMO] Concluído com sucesso.');
    console.log('[DEMO] Credenciais de demonstração (senha igual para todas):');
    for (const u of [...FREELANCERS, ...CLIENTES]) {
      console.log(`[DEMO]   ${u.email}  (${u.nome})`);
    }
    console.log(`[DEMO] Senha: ${SENHA}`);
    console.log('[DEMO] Para mudar a senha das contas demo: $env:DEMO_PASSWORD="OutraSenha"; npm run db:demo');
  } finally {
    await conn.end();
  }
}

if (CLI) {
  main().catch((err) => {
    console.error('[DEMO] Falhou:', err.code || '', err.message);
    process.exit(1);
  });
}

module.exports = { main, DOMINIO };
