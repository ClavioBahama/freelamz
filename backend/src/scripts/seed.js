/* ============================================================
   FreelaMZ — Seed rico e idempotente
   - Pode ser executado quantas vezes quiser (não duplica dados)
   - Redefine as senhas dos utilizadores do seed (upsert)
   - Credenciais principais:
       ADMIN   admin@freelamz.com  / Admin@12345   (env ADMIN_EMAIL/ADMIN_PASSWORD)
       CLIENTE cliente@freelamz.com / Cliente@123
       FREELA freela@freelamz.com   / Freela@123
   ============================================================ */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@freelamz.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@12345';
const CLIENTE_EMAIL = 'cliente@freelamz.com';
const FREELA_EMAIL = 'freela@freelamz.com';

async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'freelamz',
    multipleStatements: true,
  });

  try {
    console.log('[SEED] A ligar ao banco…');

    /* ---------- Tabela de denúncias (nova) ---------- */
    await c.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        tipo ENUM('servico','freelancer','projeto','review','mensagem') NOT NULL,
        alvo_id INT UNSIGNED NOT NULL,
        motivo VARCHAR(120) NOT NULL,
        descricao TEXT,
        status ENUM('PENDENTE','RESOLVIDA','REJEITADA') NOT NULL DEFAULT 'PENDENTE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_reports_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    /* ---------- Hashes ---------- */
    const hAdmin = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const hCliente = await bcrypt.hash('Cliente@123', 10);
    const hFreela = await bcrypt.hash('Freela@123', 10);
    const hPadrao = await bcrypt.hash('123456', 10);

    /* ---------- Utilizadores (upsert: redefine senha/tipo sempre) ---------- */
    const users = [
      { nome: 'Admin FreelaMZ', email: ADMIN_EMAIL, tel: '+258 82 000 0001', tipo: 'ADMIN', cidade: 'Maputo', provincia: 'Maputo', hash: hAdmin, username: 'admin' },
      { nome: 'Sérgio Bila', email: CLIENTE_EMAIL, tel: '+258 84 100 2003', tipo: 'CLIENTE', cidade: 'Maputo', provincia: 'Maputo', hash: hCliente, username: 'sergio.bila', bio: 'Consultor de gestão · contrato freelancers para projetos digitais', sobre: 'Sou consultor de gestão em Maputo e uso o FreelaMZ para encontrar talentos locais para os projetos digitais dos meus clientes: websites, identidade visual e marketing.', tipo_cliente: 'pessoa', verificado: true, tel_verificado: true },
      { nome: 'Isabel Sitoe', email: FREELA_EMAIL, tel: '+258 87 300 4005', tipo: 'FREELANCER', cidade: 'Maputo', provincia: 'Maputo', hash: hFreela, username: 'isabel.sitoe', bio: 'Desenvolvedora web full-stack · React & Node', sobre: 'Sou desenvolvedora web há 5 anos, especializada em websites institucionais e lojas online para o mercado moçambicano. Trabalho com React, Node.js e WordPress, sempre com foco em performance, SEO e design responsivo. Já entreguei 30+ projetos para empresas de Maputo, Matola e Beira.', whatsapp: '+258 87 300 4005', idiomas: 'Português,Inglês', linkedin: 'https://linkedin.com/in/isabel-sitoe', verificado: true, tel_verificado: true },
      // restantes freelancers e clientes (senha padrão 123456)
      { nome: 'Carlos Mabjaia', email: 'carlos.mabjaia@freelamz.com', tel: '+258 82 111 2223', tipo: 'FREELANCER', cidade: 'Maputo', provincia: 'Maputo', hash: hPadrao, username: 'carlos.mabjaia', bio: 'Especialista WordPress · sites rápidos e seguros', sobre: 'Trabalho com WordPress desde 2018: instalação, personalização, segurança e migrações sem downtime. Já construí 60+ sites para pequenas e médias empresas moçambicanas.', whatsapp: '+258 82 111 2223', idiomas: 'Português,Inglês', verificado: true, tel_verificado: true },
      { nome: 'Hélder Nhamirre', email: 'helder.nhamirre@freelamz.com', tel: '+258 84 333 4445', tipo: 'FREELANCER', cidade: 'Matola', provincia: 'Maputo', hash: hPadrao, username: 'helder.nhamirre', bio: 'Apps mobile React Native para Android e iOS', sobre: 'Desenvolvo aplicações móveis multiplataforma com React Native. Cuido de tudo: protótipo, desenvolvimento, testes e publicação nas lojas. Formado em Engenharia Informática pela UEM.', whatsapp: '+258 84 333 4445', idiomas: 'Português,Inglês' },
      { nome: 'Beatriz Cossa', email: 'beatriz.cossa@freelamz.com', tel: '+258 82 555 6667', tipo: 'FREELANCER', cidade: 'Beira', provincia: 'Sofala', hash: hPadrao, username: 'beatriz.cossa', bio: 'Designer gráfica · identidade visual que vende', sobre: 'Crio logótipos e identidades visuais para marcas moçambicanas há 5 anos. Portfólio com 40+ marcas de restaurantes, lojas e instituições. Trabalho com Illustrator, Photoshop e Figma.', whatsapp: '+258 82 555 6667', idiomas: 'Português,Inglês', instagram: 'https://instagram.com/beatriz.cossa.design', verificado: true, tel_verificado: true },
      { nome: 'Fátima Ubisse', email: 'fatima.ubisse@freelamz.com', tel: '+258 87 777 8889', tipo: 'FREELANCER', cidade: 'Maputo', provincia: 'Maputo', hash: hPadrao, username: 'fatima.ubisse', bio: 'Catálogos digitais e papelaria corporativa', sobre: 'Especialista em materiais impressos e digitais: catálogos de produtos, papelaria corporativa e posts para redes sociais com identidade consistente.', whatsapp: '+258 87 777 8889', idiomas: 'Português' },
      { nome: 'João Macuácua', email: 'joao.macuacua@freelamz.com', tel: '+258 84 999 1112', tipo: 'FREELANCER', cidade: 'Nampula', provincia: 'Nampula', hash: hPadrao, username: 'joao.macuacua', bio: 'Tráfego pago · Facebook, Instagram e Google Ads', sobre: 'Gestor de campanhas de tráfego pago certificado pelo Google. Ajudo pequenos negócios a vender mais com orçamentos realistas e relatórios claros de ROI.', whatsapp: '+258 84 999 1112', idiomas: 'Português,Inglês' },
      { nome: 'Marta Muianga', email: 'marta.muianga@freelamz.com', tel: '+258 82 222 3334', tipo: 'FREELANCER', cidade: 'Maputo', provincia: 'Maputo', hash: hPadrao, username: 'marta.muianga', bio: 'Gestora de redes sociais · conteúdo que engaja', sobre: 'Gestão completa de redes sociais: calendário editorial, design de posts, community management e relatórios mensais. Já gerenciuei contas de restaurantes, clínicas e lojas de roupa.', whatsapp: '+258 82 222 3334', idiomas: 'Português,Changana' },
      { nome: 'Ernesto Chissano', email: 'ernesto.chissano@freelamz.com', tel: '+258 87 444 5556', tipo: 'FREELANCER', cidade: 'Quelimane', provincia: 'Zambézia', hash: hPadrao, username: 'ernesto.chissano', bio: 'Edição de vídeo · motion graphics', sobre: 'Editor e produtor de vídeo com 6 anos de experiência. Especialista em conteúdo para YouTube, Instagram Reels e vídeos institucionais com motion graphics.', whatsapp: '+258 87 444 5556', idiomas: 'Português,Inglês' },
      { nome: 'Nélio Mabote', email: 'nelio.mabote@freelamz.com', tel: '+258 84 666 7778', tipo: 'FREELANCER', cidade: 'Maputo', provincia: 'Maputo', hash: hPadrao, username: 'nelio.mabote', bio: 'Podcasts · gravação, edição e masterização', sobre: 'Produtor de áudio com estúdio próprio em Maputo. Gravo, edito e masterizo podcasts e jingles com qualidade profissional.', whatsapp: '+258 84 666 7778', idiomas: 'Português' },
      { nome: 'Amós Matsinhe', email: 'amos.matsinhe@freelamz.com', tel: '+258 82 888 9990', tipo: 'FREELANCER', cidade: 'Chimoio', provincia: 'Manica', hash: hPadrao, username: 'amos.matsinhe', bio: 'Redator & tradutor PT↔EN · SEO', sobre: 'Escrevo artigos otimizados para SEO e traduzo documentos comerciais e académicos entre Português e Inglês com revisão incluída.', whatsapp: '+258 82 888 9990', idiomas: 'Português,Inglês' },
      { nome: 'Rosa Chiziane', email: 'rosa.chiziane@freelamz.com', tel: '+258 87 111 3335', tipo: 'FREELANCER', cidade: 'Pemba', provincia: 'Cabo Delgado', hash: hPadrao, username: 'rosa.chiziane', bio: 'Fotógrafa profissional · eventos e produto', sobre: 'Fotógrafa há 7 anos: casamentos, formaturas, eventos corporativos e ensaios de produto para lojas online. Entrega tratada em alta resolução.', whatsapp: '+258 87 111 3335', idiomas: 'Português,Inglês', verificado: true, tel_verificado: true },
      { nome: 'Luís Bengo', email: 'luis.bengo@freelamz.com', tel: '+258 84 555 7779', tipo: 'FREELANCER', cidade: 'Maputo', provincia: 'Maputo', hash: hPadrao, username: 'luis.bengo', bio: 'Consultor financeiro · planos de negócio', sobre: 'Contabilista certificado com 8 anos de experiência. Elaboro planos de negócios com projeções financeiras e presto consultoria fiscal a PMEs.', whatsapp: '+258 84 555 7779', idiomas: 'Português,Inglês' },
      { nome: 'Loja Kahango', email: 'kahango@freelamz.com', tel: '+258 82 909 1011', tipo: 'CLIENTE', cidade: 'Matola', provincia: 'Maputo', hash: hPadrao, username: 'loja.kahango', bio: 'Loja de moda e acessórios · Matola', sobre: 'Loja de roupa e acessórios com 3 funcionários. Procuramos freelancers para a nossa presença digital: loja online, redes sociais e fotografia de produto.', tipo_cliente: 'empresa', nome_empresa: 'Kahango Lda.', setor: 'Comércio e retalho', equipa: '1-4', verificado: true },
      { nome: 'Ana Guambe', email: 'ana.guambe@freelamz.com', tel: '+258 84 121 3141', tipo: 'CLIENTE', cidade: 'Maputo', provincia: 'Maputo', hash: hPadrao, username: 'ana.guambe', bio: 'Restaurante Sabores · Maputo', sobre: 'Restaurante de cozinha moçambicana contemporânea. Contratamos vídeos institucionais e materiais de marketing.', tipo_cliente: 'empresa', nome_empresa: 'Restaurante Sabores', setor: 'Restauração', equipa: '5-10' },
      { nome: 'Domingos Vieira', email: 'domingos.vieira@freelamz.com', tel: '+258 82 151 6171', tipo: 'CLIENTE', cidade: 'Beira', provincia: 'Sofala', hash: hPadrao, username: 'domingos.vieira', bio: 'Centro de traduções · Beira', sobre: 'Empresa de traduções e serviços académicos. Procuramos tradutores e fotógrafos para projetos pontuais.', tipo_cliente: 'empresa', nome_empresa: 'TraduBeira', setor: 'Serviços', equipa: '1-4' },
    ];
    const { gerar: gerarImagem } = require('./seedImagens');
    for (const u of users) {
      await c.query(
        `INSERT INTO users (nome, email, telefone, senha_hash, tipo_usuario, cidade, provincia, pais, status,
           nome_utilizador, bio, sobre_mim, whatsapp, idiomas, linkedin, instagram,
           email_verificado, telefone_verificado, verificado_plataforma,
           tipo_cliente, nome_empresa, setor, tamanho_equipa, foto, capa)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Moçambique', 'ativo', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE senha_hash = VALUES(senha_hash), tipo_usuario = VALUES(tipo_usuario),
           nome = VALUES(nome), telefone = VALUES(telefone), cidade = VALUES(cidade), provincia = VALUES(provincia),
           status = 'ativo', nome_utilizador = VALUES(nome_utilizador), bio = VALUES(bio),
           sobre_mim = VALUES(sobre_mim), whatsapp = VALUES(whatsapp), idiomas = VALUES(idiomas),
           linkedin = VALUES(linkedin), instagram = VALUES(instagram),
           email_verificado = 1, telefone_verificado = VALUES(telefone_verificado),
           verificado_plataforma = VALUES(verificado_plataforma), tipo_cliente = VALUES(tipo_cliente),
           nome_empresa = VALUES(nome_empresa), setor = VALUES(setor), tamanho_equipa = VALUES(tamanho_equipa),
           foto = COALESCE(VALUES(foto), foto), capa = COALESCE(VALUES(capa), capa)`,
        [u.nome, u.email, u.tel, u.hash, u.tipo, u.cidade, u.provincia,
         u.username || null, u.bio || null, u.sobre || null, u.whatsapp || null,
         u.idiomas || null, u.linkedin || null, u.instagram || null,
         u.tel_verificado ? 1 : 0, u.verificado ? 1 : 0,
         u.tipo_cliente || null, u.nome_empresa || null, u.setor || null, u.equipa || null,
         await gerarImagem('avatar', u.username || u.email, u.bio || u.nome),
         await gerarImagem('capa', u.username || u.email, u.bio || u.nome)]
      );
    }
    const [uRows] = await c.query('SELECT id, email FROM users');
    const uid = {};
    for (const r of uRows) uid[r.email] = r.id;
    console.log('[SEED] Utilizadores garantidos (upsert)');

    /* ---------- Categorias (ícones válidos do Framework7 Icons) ---------- */
    const cats = [
      ['Desenvolvimento Web', 'globe', '#2563EB', 'Criação de sites, lojas virtuais e sistemas web'],
      ['Design Gráfico', 'paintbrush', '#7C3AED', 'Logos, identidade visual e materiais gráficos'],
      ['Marketing Digital', 'speaker_2', '#10B981', 'Redes sociais, tráfego pago e campanhas'],
      ['Redação', 'doc_plaintext', '#F59E0B', 'Artigos, copywriting e conteúdos'],
      ['Tradução', 'text_badge_checkmark', '#EC4899', 'Tradução de documentos e textos'],
      ['Fotografia', 'camera', '#EF4444', 'Fotos profissionais e eventos'],
      ['Vídeo', 'videocam', '#06B6D4', 'Edição e produção de vídeos'],
      ['Programação', 'number', '#6366F1', 'Softwares, apps e automação'],
      ['Assistente Virtual', 'person_2', '#8B5CF6', 'Suporte administrativo remoto'],
      ['Contabilidade', 'money_dollar_circle', '#14B8A6', 'Serviços contábeis e fiscais'],
      ['Redes', 'wifi', '#F97316', 'Redes de computadores e infraestrutura'],
      ['Suporte Técnico', 'question_circle', '#64748B', 'Suporte de TI e manutenção'],
    ];
    for (const [nome, icone, cor, desc] of cats) {
      await c.query(
        `INSERT INTO categories (nome, icone, cor, descricao) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE icone = VALUES(icone), cor = VALUES(cor), descricao = VALUES(descricao)`,
        [nome, icone, cor, desc]
      );
    }
    const [cRows] = await c.query('SELECT id, nome FROM categories');
    const cid = {};
    for (const r of cRows) cid[r.nome] = r.id;
    console.log('[SEED] Categorias garantidas (ícones normalizados)');

    /* ---------- Perfis de freelancer (ricos: categoria, nível, educ/experiência/certificações) ---------- */
    const perfis = [
      {
        email: FREELA_EMAIL, categoria: 'Desenvolvimento Web', nivel: 'especialista', anos: 5,
        titulo: 'Desenvolvedora Web Full-Stack',
        descricao: 'Crio websites modernos e lojas online com React e Node.js. Foco em performance, SEO e design responsivo para negócios moçambicanos.',
        habilidades: 'WordPress,React,Node.js,JavaScript,MySQL', experiencia: '5+ anos', idiomas: 'Português,Inglês',
        preco: 1500, disponibilidade: 'disponivel', localizacao: 'Maputo',
        educacao: [
          { titulo: 'Licenciatura em Engenharia Informática', local: 'Universidade Eduardo Mondlane', periodo: '2014-2018', descricao: 'Especialização em sistemas web e bases de dados.' },
        ],
        experiencia_prof: [
          { titulo: 'Desenvolvedora Full-Stack sénior', local: 'Agência Digital Kudissanga · Maputo', periodo: '2021-atual', descricao: 'Liderança técnica de 12 projetos web por ano: lojas online, sistemas de agendamento e websites institucionais.' },
          { titulo: 'Desenvolvedora Web júnior', local: 'MozTech Solutions · Maputo', periodo: '2018-2021', descricao: 'Manutenção e evolução de websites WordPress e aplicações internas em PHP/React.' },
        ],
        certificacoes: [
          { titulo: 'Meta Front-End Developer', local: 'Coursera', periodo: '2023', descricao: 'Certificação profissional em React e UI responsiva.' },
          { titulo: 'Web Performance Optimization', local: 'Google', periodo: '2022', descricao: 'Core Web Vitals e otimização de carregamento.' },
        ],
        metodos: { mpesa: '+258 87 300 4005', emola: '+258 87 300 4005' },
      },
      {
        email: 'carlos.mabjaia@freelamz.com', categoria: 'Desenvolvimento Web', nivel: 'especialista', anos: 7,
        titulo: 'Especialista em WordPress',
        descricao: 'Instalação, personalização e manutenção de sites WordPress, incluindo segurança e migrações sem downtime.',
        habilidades: 'WordPress,PHP,Elementor,WooCommerce,Segurança Web', experiencia: '7+ anos', idiomas: 'Português,Inglês',
        preco: 950, disponibilidade: 'disponivel', localizacao: 'Maputo',
        educacao: [
          { titulo: 'Curso Técnico de Informática', local: 'Instituto Industrial de Maputo', periodo: '2012-2015', descricao: 'Formação técnica em redes e desenvolvimento web.' },
        ],
        experiencia_prof: [
          { titulo: 'Freelancer WordPress', local: 'Autónomo · Maputo', periodo: '2018-atual', descricao: '60+ sites entregues para PMEs: lojas WooCommerce, sites institucionais e migrações.' },
        ],
        certificacoes: [
          { titulo: 'WordPress Developer Certificate', local: 'WordPress.org / Sensei', periodo: '2021', descricao: 'Desenvolvimento de temas e plugins seguros.' },
        ],
        metodos: { mpesa: '+258 82 111 2223' },
      },
      {
        email: 'helder.nhamirre@freelamz.com', categoria: 'Desenvolvimento Web', nivel: 'especialista', anos: 6,
        titulo: 'Programador de Apps Mobile',
        descricao: 'Desenvolvo aplicações Android e iOS com React Native, desde o protótipo até à publicação nas lojas.',
        habilidades: 'React Native,Java,Kotlin,Firebase,APIs REST', experiencia: '6+ anos', idiomas: 'Português,Inglês',
        preco: 1800, disponibilidade: 'disponivel', localizacao: 'Matola',
        educacao: [
          { titulo: 'Licenciatura em Engenharia Informática', local: 'Universidade Eduardo Mondlane', periodo: '2015-2019', descricao: 'Bacharelato com foco em desenvolvimento móvel.' },
        ],
        experiencia_prof: [
          { titulo: 'Desenvolvedor Mobile', local: 'AppSul Moçambique · Matola', periodo: '2019-atual', descricao: '10 aplicações publicadas nas lojas para clientes de logística, saúde e educação.' },
        ],
        certificacoes: [
          { titulo: 'React Native — The Practical Guide', local: 'Udemy', periodo: '2022', descricao: 'Arquiteturas offline-first e publicação nas lojas.' },
        ],
        metodos: { mpesa: '+258 84 333 4445', banco: 'BCI 1029384756' },
      },
      {
        email: 'beatriz.cossa@freelamz.com', categoria: 'Design Gráfico', nivel: 'especialista', anos: 5,
        titulo: 'Designer Gráfica & Identidade Visual',
        descricao: 'Logótipos, identidade visual e materiais gráficos que dão vida às marcas. Portfólio com 40+ marcas moçambicanas.',
        habilidades: 'Photoshop,Illustrator,Figma,Identidade Visual,Branding', experiencia: '5+ anos', idiomas: 'Português,Inglês',
        preco: 1100, disponibilidade: 'disponivel', localizacao: 'Beira',
        educacao: [
          { titulo: 'Licenciatura em Design Gráfico', local: 'Escola de Artes Visuais · Beira', periodo: '2015-2019', descricao: 'Fundamentos de tipografia, cor e identidade.' },
        ],
        experiencia_prof: [
          { titulo: 'Designer Sénior', local: 'Estúdio Mabuwe · Beira', periodo: '2020-atual', descricao: 'Identidades visuais para 40+ marcas: restaurantes, clínicas e lojas.' },
          { titulo: 'Designer júnior', local: 'Gráfica Baixa · Beira', periodo: '2019-2020', descricao: 'Preparação de artes para impressão offset e digital.' },
        ],
        certificacoes: [
          { titulo: 'Adobe Certified Professional — Illustrator', local: 'Adobe', periodo: '2023', descricao: 'Certificação oficial de Illustrator.' },
        ],
        metodos: { mpesa: '+258 82 555 6667', emola: '+258 82 555 6667' },
      },
      {
        email: 'fatima.ubisse@freelamz.com', categoria: 'Design Gráfico', nivel: 'intermedio', anos: 3,
        titulo: 'Designer de Catálogos & Papelaria',
        descricao: 'Catálogos digitais, papelaria corporativa e posts para redes sociais com identidade consistente.',
        habilidades: 'InDesign,Photoshop,Canva,Layout Editorial', experiencia: '3+ anos', idiomas: 'Português',
        preco: 850, disponibilidade: 'disponivel', localizacao: 'Maputo',
        educacao: [
          { titulo: 'Bacharelato em Comunicação Visual', local: 'ISArtes · Maputo', periodo: '2018-2021', descricao: 'Design editorial e produção gráfica.' },
        ],
        experiencia_prof: [
          { titulo: 'Designer editorial', local: 'Papelaria Chissano · Maputo', periodo: '2021-atual', descricao: 'Catálogos de produto e papelaria corporativa para 15+ empresas.' },
        ],
        certificacoes: [],
        metodos: { mpesa: '+258 87 777 8889' },
      },
      {
        email: 'joao.macuacua@freelamz.com', categoria: 'Marketing Digital', nivel: 'especialista', anos: 4,
        titulo: 'Especialista em Tráfego Pago',
        descricao: 'Campanhas Facebook/Instagram Ads e Google Ads com relatórios claros de ROI para pequenos negócios.',
        habilidades: 'Facebook Ads,Google Ads,SEO,Analytics,Remarketing', experiencia: '4+ anos', idiomas: 'Português,Inglês',
        preco: 1300, disponibilidade: 'ocupado', localizacao: 'Nampula',
        educacao: [
          { titulo: 'Licenciatura em Marketing', local: 'Universidade Pedagógica · Nampula', periodo: '2015-2019', descricao: 'Marketing digital e comportamento do consumidor.' },
        ],
        experiencia_prof: [
          { titulo: 'Gestor de mídia paga', local: 'Agência Sete Mares · Nampula', periodo: '2020-atual', descricao: 'Campanhas com orçamento total de 2M+ MT por ano para 20+ anunciantes.' },
        ],
        certificacoes: [
          { titulo: 'Google Ads Search Certification', local: 'Google Skillshop', periodo: '2023', descricao: 'Campanhas de pesquisa e otimização de lances.' },
          { titulo: 'Meta Certified Media Buying Professional', local: 'Meta', periodo: '2022', descricao: 'Compra de mídia e medição de resultados.' },
        ],
        metodos: { mpesa: '+258 84 999 1112' },
      },
      {
        email: 'marta.muianga@freelamz.com', categoria: 'Marketing Digital', nivel: 'intermedio', anos: 3,
        titulo: 'Gestora de Redes Sociais',
        descricao: 'Gestão mensal de redes sociais: calendário editorial, design de posts, community management e relatórios.',
        habilidades: 'Instagram,Facebook,TikTok,Canva,Community Management', experiencia: '3+ anos', idiomas: 'Português,Changana',
        preco: 900, disponibilidade: 'disponivel', localizacao: 'Maputo',
        educacao: [
          { titulo: 'Bacharelato em Comunicação Social', local: 'ISCED · Maputo', periodo: '2017-2020', descricao: 'Jornalismo digital e produção de conteúdo.' },
        ],
        experiencia_prof: [
          { titulo: 'Community manager', local: 'Restaurante Sabores · Maputo', periodo: '2021-atual', descricao: 'Crescimento de 3 contas: 12k seguidores orgânicos e 40% de reservas vindas do Instagram.' },
        ],
        certificacoes: [],
        metodos: { mpesa: '+258 82 222 3334' },
      },
      {
        email: 'ernesto.chissano@freelamz.com', categoria: 'Vídeo', nivel: 'especialista', anos: 6,
        titulo: 'Editor & Produtor de Vídeo',
        descricao: 'Edição de vídeo para YouTube, Instagram Reels e vídeos institucionais com motion graphics.',
        habilidades: 'Premiere,After Effects,DaVinci Resolve,Motion Graphics,Storytelling', experiencia: '6+ anos', idiomas: 'Português,Inglês',
        preco: 1400, disponibilidade: 'disponivel', localizacao: 'Quelimane',
        educacao: [
          { titulo: 'Curso de Produção Audiovisual', local: 'CineÁfrica · Quelimane', periodo: '2014-2016', descricao: 'Captação, edição e pós-produção.' },
        ],
        experiencia_prof: [
          { titulo: 'Editor sénior', local: 'Produtora Zambeze Films · Quelimane', periodo: '2019-atual', descricao: 'Séries documentais e vídeos institucionais para ONGs e empresas.' },
        ],
        certificacoes: [
          { titulo: 'Adobe Premiere Pro Certified', local: 'Adobe', periodo: '2022', descricao: 'Edição profissional e fluxos de trabalho.' },
        ],
        metodos: { mpesa: '+258 87 444 5556' },
      },
      {
        email: 'nelio.mabote@freelamz.com', categoria: 'Vídeo', nivel: 'intermedio', anos: 4,
        titulo: 'Produtor de Podcasts',
        descricao: 'Gravação, edição e masterização de podcasts e jingles. Estúdio próprio em Maputo.',
        habilidades: 'Audition,Audacity,Mixagem,Masterização,Roteirização', experiencia: '4+ anos', idiomas: 'Português',
        preco: 1000, disponibilidade: 'disponivel', localizacao: 'Maputo',
        educacao: [
          { titulo: 'Curso de Técnico de Som', local: 'Escola de Música · Maputo', periodo: '2016-2018', descricao: 'Captação e tratamento de áudio.' },
        ],
        experiencia_prof: [
          { titulo: 'Produtor de áudio', local: 'Estúdio Voz MZ · Maputo', periodo: '2020-atual', descricao: '30+ podcasts produzidos e masterizados, incluindo 3 no top nacional.' },
        ],
        certificacoes: [],
        metodos: { mpesa: '+258 84 666 7778' },
      },
      {
        email: 'amos.matsinhe@freelamz.com', categoria: 'Redação', nivel: 'especialista', anos: 5,
        titulo: 'Redator & Tradutor PT↔EN',
        descricao: 'Artigos SEO, copywriting e tradução profissional Português↔Inglês com entrega rápida.',
        habilidades: 'SEO,Copywriting,Tradução PT-EN,WordPress,Gramática', experiencia: '5+ anos', idiomas: 'Português,Inglês',
        preco: 700, disponibilidade: 'disponivel', localizacao: 'Chimoio',
        educacao: [
          { titulo: 'Licenciatura em Letras (Português/Inglês)', local: 'Universidade Pedagógica · Chimoio', periodo: '2013-2017', descricao: 'Linguística aplicada e tradução.' },
        ],
        experiencia_prof: [
          { titulo: 'Redator SEO', local: 'Blogues MZ · Remoto', periodo: '2019-atual', descricao: '300+ artigos publicados com otimização para mecanismos de busca.' },
          { titulo: 'Tradutor freelancer', local: 'TraduBeira · Remoto', periodo: '2017-2019', descricao: 'Documentos comerciais e académicos PT↔EN.' },
        ],
        certificacoes: [
          { titulo: 'SEO Fundamentals', local: 'Semrush Academy', periodo: '2023', descricao: 'Pesquisa de palavras-chave e estrutura de conteúdo.' },
        ],
        metodos: { mpesa: '+258 82 888 9990' },
      },
      {
        email: 'rosa.chiziane@freelamz.com', categoria: 'Fotografia', nivel: 'especialista', anos: 7,
        titulo: 'Fotógrafa Profesional',
        descricao: 'Cobertura de eventos, ensaios de produto e retratos. Entrega tratada em alta resolução.',
        habilidades: 'Lightroom,Photoshop,Fotografia de Produto,Retrato,Eventos', experiencia: '7+ anos', idiomas: 'Português,Inglês',
        preco: 1200, disponibilidade: 'disponivel', localizacao: 'Pemba',
        educacao: [
          { titulo: 'Curso de Fotografia Profissional', local: 'Instituto de imagem · Pemba', periodo: '2012-2014', descricao: 'Composição, luz e pós-produção.' },
        ],
        experiencia_prof: [
          { titulo: 'Fotógrafa de eventos e produto', local: 'Autónoma · Pemba', periodo: '2017-atual', descricao: 'Cobertura de 150+ eventos e ensaios de produto para 25+ lojas online.' },
        ],
        certificacoes: [
          { titulo: 'Adobe Lightroom Classic Certified', local: 'Adobe', periodo: '2021', descricao: 'Fluxos de edição e catálogo profissional.' },
        ],
        metodos: { mpesa: '+258 87 111 3335' },
      },
      {
        email: 'luis.bengo@freelamz.com', categoria: 'Contabilidade', nivel: 'especialista', anos: 8,
        titulo: 'Consultor Financeiro',
        descricao: 'Planos de negócios, contabilidade e fiscalidade para pequenas e médias empresas.',
        habilidades: 'Contabilidade,Excel,Fiscalidade,Planos de Negócio,Análise Financeira', experiencia: '8+ anos', idiomas: 'Português,Inglês',
        preco: 1600, disponibilidade: 'disponivel', localizacao: 'Maputo',
        educacao: [
          { titulo: 'Licenciatura em Contabilidade e Finanças', local: 'UEM · Maputo', periodo: '2011-2015', descricao: 'Contabilidade geral e auditoria.' },
          { titulo: 'MBA em Gestão', local: 'ISPU · Maputo', periodo: '2018-2020', descricao: 'Gestão estratégica de PMEs.' },
        ],
        experiencia_prof: [
          { titulo: 'Contabilista certificado', local: 'OCAM · Maputo', periodo: '2016-atual', descricao: 'Contabilidade e consultoria fiscal para 30+ PMEs moçambicanas.' },
        ],
        certificacoes: [
          { titulo: 'Contabilista Certificado', local: 'OCAM', periodo: '2016', descricao: 'Certificação profissional de contabilidade em Moçambique.' },
        ],
        metodos: { mpesa: '+258 84 555 7779', banco: 'Millennium BIM 5647382910' },
      },
    ];
    for (const p of perfis) {
      await c.query(
        `INSERT INTO profiles (user_id, titulo, descricao, localizacao, habilidades, experiencia, idiomas,
           preco_por_hora, disponibilidade, categoria_id, nivel, anos_experiencia,
           educacao, experiencia_prof, certificacoes, metodos_recebimento)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE titulo = VALUES(titulo), descricao = VALUES(descricao), localizacao = VALUES(localizacao),
           habilidades = VALUES(habilidades), experiencia = VALUES(experiencia), idiomas = VALUES(idiomas),
           preco_por_hora = VALUES(preco_por_hora), disponibilidade = VALUES(disponibilidade),
           categoria_id = VALUES(categoria_id), nivel = VALUES(nivel), anos_experiencia = VALUES(anos_experiencia),
           educacao = VALUES(educacao), experiencia_prof = VALUES(experiencia_prof),
           certificacoes = VALUES(certificacoes), metodos_recebimento = VALUES(metodos_recebimento)`,
        [uid[p.email], p.titulo, p.descricao, p.localizacao || 'Moçambique', p.habilidades, p.experiencia,
         p.idiomas, p.preco, p.disponibilidade, cid[p.categoria] || null, p.nivel, p.anos,
         JSON.stringify(p.educacao || []), JSON.stringify(p.experiencia_prof || []),
         JSON.stringify(p.certificacoes || []), JSON.stringify(p.metodos || {})]
      );
    }
    console.log('[SEED] Perfis de freelancers garantidos (ricos: categoria/nível/educação/experiência/certificações/métodos)');

    /* ---------- Portfólio dos freelancers (imagens geradas localmente, chave natural: user + título) ---------- */
    const portfolios = [
      {
        email: FREELA_EMAIL, chave: 'isabel',
        itens: [
          { titulo: 'Loja online Kahango', descricao: 'Loja WooCommerce com pagamentos M-Pesa e catálogo de 200+ produtos. Vendas +35% em 3 meses.', link: 'https://kahango.example.co.mz', tema: 'web', imagens: 4 },
          { titulo: 'Website institucional de clínica', descricao: 'Site em React com gestão de notícias, equipe e marcação de consultas.', tema: 'web', imagens: 3 },
          { titulo: 'Painel de gestão de encomendas', descricao: 'Sistema web para acompanhar encomendas de distribuidora, com relatórios em PDF.', tema: 'web', imagens: 2 },
        ],
      },
      {
        email: 'carlos.mabjaia@freelamz.com', chave: 'carlos',
        itens: [
          { titulo: 'Migração de 40 sites sem downtime', descricao: 'Migração de alojamento partilhado para VPS com SSL automático e cache.', tema: 'web', imagens: 3 },
          { titulo: 'Loja WooCommerce para farmácia', descricao: 'Catálogo de 800 produtos com reservas online e integração M-Pesa.', tema: 'web', imagens: 2 },
        ],
      },
      {
        email: 'helder.nhamirre@freelamz.com', chave: 'helder',
        itens: [
          { titulo: 'App de entregas Zippy', descricao: 'Aplicação React Native para clientes e estafetas, com tracking em tempo real.', tema: 'web', imagens: 4 },
          { titulo: 'App de matrículas escolares', descricao: 'Fluxo de matrícula digital com upload de documentos e pagamento in-app.', tema: 'web', imagens: 2 },
        ],
      },
      {
        email: 'beatriz.cossa@freelamz.com', chave: 'beatriz',
        itens: [
          { titulo: 'Identidade visual — Café Muanza', descricao: 'Logótipo, paleta, embalagens e papelaria para cadeia de cafés em Maputo.', tema: 'brand', imagens: 4 },
          { titulo: 'Rebranding de clínica dentária', descricao: 'Redesign completo de marca: sinalética, cartões e posts de lançamento.', tema: 'brand', imagens: 3 },
          { titulo: 'Capas de álbum para banda local', descricao: 'Três capas digitais e física com direção de arte e tipografia personalizada.', tema: 'brand', imagens: 2 },
        ],
      },
      {
        email: 'fatima.ubisse@freelamz.com', chave: 'fatima',
        itens: [
          { titulo: 'Catálogo digital de moda', descricao: 'Catálogo de 28 páginas para loja de roupa, com grid editorial e QR para loja online.', tema: 'brand', imagens: 3 },
          { titulo: 'Papelaria corporativa corretora', descricao: 'Cartões, pastas, envelopes e blocos com identidade consistente.', tema: 'brand', imagens: 2 },
        ],
      },
      {
        email: 'joao.macuacua@freelamz.com', chave: 'joao',
        itens: [
          { titulo: 'Campanha de matrículas escolares', descricao: 'Leads 3x mais baratos com criativos de vídeo e públicos em camadas.', tema: 'brand', imagens: 3 },
          { titulo: 'Lançamento de produto alimentar', descricao: 'Campanha completa de conversão com remarketing e relatório de ROI.', tema: 'brand', imagens: 2 },
        ],
      },
      {
        email: 'marta.muianga@freelamz.com', chave: 'marta',
        itens: [
          { titulo: 'Gestão de redes do Restaurante Sabores', descricao: 'Calendário editorial mensal, posts diários e reservas via WhatsApp: +40% em 6 meses.', tema: 'brand', imagens: 4 },
          { titulo: 'Instagram de loja de roupa', descricao: 'Conteúdo de moda com sessões fotográficas trimestrais e stories diários.', tema: 'brand', imagens: 2 },
        ],
      },
      {
        email: 'ernesto.chissano@freelamz.com', chave: 'ernesto',
        itens: [
          { titulo: 'Série documental "Rios do Zambeze"', descricao: 'Produção completa: captação, edição e color grading de 4 episódios.', tema: 'midia', imagens: 4 },
          { titulo: 'Vídeo institucional de ONG', descricao: 'Vídeo de 3 minutos com motion graphics e legendas em PT/EN.', tema: 'midia', imagens: 2 },
        ],
      },
      {
        email: 'nelio.mabote@freelamz.com', chave: 'nelio',
        itens: [
          { titulo: 'Podcast "Negócios MZ"', descricao: 'Produção completa de 24 episódios: roteiro, gravação em estúdio e masterização.', tema: 'midia', imagens: 2 },
          { titulo: 'Jingle para campanha de rádio', descricao: 'Composição, gravação e 3 versões (30s, 15s, 5s) para campanha regional.', tema: 'midia', imagens: 2 },
        ],
      },
      {
        email: 'amos.matsinhe@freelamz.com', chave: 'amos',
        itens: [
          { titulo: 'Ebook de culinária moçambicana', descricao: 'Revisão, edição e conversão de 120 receitas para ebook e Kindle.', tema: 'web', imagens: 2 },
          { titulo: 'Blogue de finanças pessoais', descricao: '40 artigos SEO em 6 meses; tráfego orgânico de 0 para 15k visitas/mês.', tema: 'web', imagens: 2 },
        ],
      },
      {
        email: 'rosa.chiziane@freelamz.com', chave: 'rosa',
        itens: [
          { titulo: 'Ensaios de produto — Kahango', descricao: '120 fotos de moda com tratamento de cor e fundo branco para loja online.', tema: 'midia', imagens: 4 },
          { titulo: 'Cobertura de congresso médico', descricao: '600 fotos tratadas e galeria online entregue em 48 horas.', tema: 'midia', imagens: 3 },
          { titulo: 'Sessão de formatura UEM', descricao: 'Retratos individuais e de grupo com entrega em galeria protegida por senha.', tema: 'midia', imagens: 2 },
        ],
      },
      {
        email: 'luis.bengo@freelamz.com', chave: 'luis',
        itens: [
          { titulo: 'Plano de negócios para panificadora', descricao: 'Plano com projeções de 3 anos que garantiu financiamento de 1,5M MT.', tema: 'web', imagens: 2 },
          { titulo: 'Reorganização contabilística de corretora', descricao: 'Regularização de 2 anos fiscais e implementação de fluxo mensal.', tema: 'web', imagens: 2 },
        ],
      },
    ];
    let totalItens = 0;
    for (const p of portfolios) {
      const user = uid[p.email];
      let ordem = 0;
      for (const it of p.itens) {
        ordem += 1;
        const [existe] = await c.query('SELECT id FROM portfolio_items WHERE user_id = ? AND titulo = ?', [user, it.titulo]);
        if (existe.length) continue;
        const urls = [];
        for (let i = 0; i < it.imagens; i += 1) {
          urls.push(await gerarImagem('portfolio', `${p.chave}-${ordem}`, it.tema, i + 1));
        }
        const [res] = await c.query(
          'INSERT INTO portfolio_items (user_id, titulo, descricao, link, ordem) VALUES (?, ?, ?, ?, ?)',
          [user, it.titulo, it.descricao, it.link || null, ordem]
        );
        const itemId = res.insertId;
        const values = urls.map((u, idx) => [itemId, u, idx]);
        await c.query(
          `INSERT INTO portfolio_images (item_id, url, ordem) VALUES ${values.map(() => '(?, ?, ?)').join(', ')}`,
          values.flat()
        );
        totalItens += 1;
      }
    }
    console.log(`[SEED] Portfólio garantido (+${totalItens} novos itens com imagens locais)`);

    /* ---------- Serviços (chave natural: freelancer + título) ---------- */
    const servicos = [
      [FREELA_EMAIL, 'Desenvolvimento Web', 'Crio o seu website institucional em React', 'Website de 5 páginas com design responsivo, formulário de contacto, otimização SEO e painel simples para editar conteúdos. Entrego também 30 dias de suporte.', 18000, '7 dias'],
      [FREELA_EMAIL, 'Desenvolvimento Web', 'Desenvolvo a sua loja online completa', 'Loja virtual com catálogo, carrinho, checkout com M-Pesa/e-Mola, painel de administração e formação de 2 horas para a sua equipa.', 45000, '15 dias'],
      ['carlos.mabjaia@freelamz.com', 'Desenvolvimento Web', 'Instalo e personalizo o seu site em WordPress', 'Instalação do WordPress, tema profissional personalizado com as suas cores, 5 páginas e plugins essenciais de segurança.', 12000, '5 dias'],
      ['carlos.mabjaia@freelamz.com', 'Desenvolvimento Web', 'Migração e segurança de sites WordPress', 'Migrão do seu site para novo servidor, certificado SSL, cópias de segurança automáticas e endurecimento de segurança.', 6000, '3 dias'],
      ['helder.nhamirre@freelamz.com', 'Programação', 'Desenvolvo a sua app Android e iOS', 'Aplicação móvel completa em React Native: protótipo, desenvolvimento, testes e publicação nas lojas Google Play e App Store.', 60000, '30 dias'],
      ['beatriz.cossa@freelamz.com', 'Design Gráfico', 'Crio o logótipo e identidade visual da sua marca', 'Logótipo exclusivo em formatos para web e impressão, cartão de visita, papel timbrado e mini-manual de marca.', 7500, '4 dias'],
      ['beatriz.cossa@freelamz.com', 'Design Gráfico', 'Design de 10 posts profissionais para redes sociais', 'Dez posts com identidade visual coerente para Instagram e Facebook, incluindo versões para stories.', 3500, '3 dias'],
      ['fatima.ubisse@freelamz.com', 'Design Gráfico', 'Crio o seu catálogo digital e papelaria', 'Catálogo de produtos em PDF interativo + papelaria (envelope, pasta e facturas) com a identidade da sua empresa.', 5000, '5 dias'],
      ['joao.macuacua@freelamz.com', 'Marketing Digital', 'Gestão de campanhas Facebook e Instagram Ads', 'Criação, gestão e otimização de campanhas de tráfego pago durante 30 dias, com relatório semanal de resultados.', 8000, 'contínuo'],
      ['joao.macuacua@freelamz.com', 'Marketing Digital', 'Otimização SEO do seu website', 'Auditoria completa, pesquisa de palavras-chave para o mercado moçambicano, otimização on-page e relatório de posições.', 9000, '10 dias'],
      ['marta.muianga@freelamz.com', 'Marketing Digital', 'Gestão mensal das suas redes sociais', 'Calendário editorial, 12 posts por mês, respostas a seguidores e relatório mensal de crescimento.', 12000, 'mensal'],
      ['ernesto.chissano@freelamz.com', 'Vídeo', 'Edição de vídeos para YouTube e Instagram', 'Edição de vídeos até 10 minutos com cortes dinâmicos, legendas, música e miniaturas para YouTube.', 7000, '4 dias'],
      ['ernesto.chissano@freelamz.com', 'Vídeo', 'Produzo o seu vídeo institucional', 'Vídeo de apresentação da empresa até 2 minutos: roteiro, filmagem em Maputo, edição e trilha sonora.', 25000, '10 dias'],
      ['nelio.mabote@freelamz.com', 'Redação', 'Gravo e edito o seu podcast', 'Gravação em estúdio, edição, masterização e publicação de episódios até 60 minutos, com 4 episódios por mês.', 4500, 'mensal'],
      ['amos.matsinhe@freelamz.com', 'Redação', 'Escrevo artigos SEO para o seu blog', 'Artigos otimizados para motores de busca (800–1200 palavras) com pesquisa de palavras-chave incluída.', 2500, '2 dias'],
      ['amos.matsinhe@freelamz.com', 'Tradução', 'Tradução profissional PT↔EN de documentos', 'Tradução de documentos comerciais e académicos com revisão incluída. Certificados e currículos.', 3500, '3 dias'],
      ['rosa.chiziane@freelamz.com', 'Fotografia', 'Cobertura fotográfica de eventos', 'Cobertura até 4 horas (casamentos, formaturas, corporativos) com 100 fotos tratadas em alta resolução.', 9500, '1 dia'],
      ['rosa.chiziane@freelamz.com', 'Fotografia', 'Ensaio fotográfico profissional de produto', 'Ensaio de até 15 produtos com fundo e luz profissionais, ideal para lojas online e catálogos.', 6500, '2 dias'],
      ['luis.bengo@freelamz.com', 'Contabilidade', 'Consultoria financeira e plano de negócios', 'Plano de negócios completo com projeções financeiras a 3 anos, análise de viabilidade e apoios à apresentação ao banco.', 20000, '7 dias'],
      ['luis.bengo@freelamz.com', 'Contabilidade', 'Organização contabilística para pequenas empresas', 'Implantação de rotinas contabilísticas, Noelamento fiscal e formação da sua equipa.', 15000, '10 dias'],
    ];
    const sid = {}; // sid[titulo] = id
    for (const [email, cat, titulo, descricao, preco, prazo] of servicos) {
      const [existe] = await c.query('SELECT id FROM services WHERE freelancer_id = ? AND titulo = ?', [uid[email], titulo]);
      let id;
      if (existe.length) {
        id = existe[0].id;
        await c.query(
          `UPDATE services SET categoria_id = ?, descricao = ?, preco = ?, prazo_entrega = ?, status = 'ativo' WHERE id = ?`,
          [cid[cat], descricao, preco, prazo, id]
        );
      } else {
        const [res] = await c.query(
          `INSERT INTO services (freelancer_id, categoria_id, titulo, descricao, preco, prazo_entrega, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'ativo', NOW() - INTERVAL ? DAY)`,
          [uid[email], cid[cat], titulo, descricao, preco, prazo, 5 + Math.floor(Math.random() * 60)]
        );
        id = res.insertId;
      }
      sid[titulo] = id;
      // imagem placeholder (uma por serviço, se ainda não tiver)
      const [img] = await c.query('SELECT id FROM service_images WHERE service_id = ? LIMIT 1', [id]);
      if (!img.length) {
        await c.query('INSERT INTO service_images (service_id, url, ordem) VALUES (?, ?, 0)', [id, '/uploads/services/placeholder.png']);
      }
    }
    console.log(`[SEED] ${servicos.length} serviços garantidos`);

    /* ---------- Projetos (chave natural: cliente + serviço) ---------- */
    // [clienteEmail, servicoTitulo, freelancerEmail, valor, prazo, status, diasAtras, extras]
    const projetos = [
      // Sérgio Bila (cliente principal do fluxo de teste)
      [CLIENTE_EMAIL, 'Crio o seu website institucional em React', FREELA_EMAIL, 17000, '7 dias', 'CONCLUIDO', 40],
      [CLIENTE_EMAIL, 'Crio o logótipo e identidade visual da sua marca', 'beatriz.cossa@freelamz.com', 7500, '4 dias', 'EM_ANDAMENTO', 6],
      [CLIENTE_EMAIL, 'Gestão mensal das suas redes sociais', 'marta.muianga@freelamz.com', 12000, 'mensal', 'PENDENTE', 2],
      [CLIENTE_EMAIL, 'Otimização SEO do seu website', 'joao.macuacua@freelamz.com', 9000, '10 dias', 'ENTREGUE', 12],
      [CLIENTE_EMAIL, 'Design de 10 posts profissionais para redes sociais', 'fatima.ubisse@freelamz.com', 3500, '3 dias', 'CANCELADO', 25],
      [CLIENTE_EMAIL, 'Cobertura fotográfica de eventos', 'rosa.chiziane@freelamz.com', 9500, '1 dia', 'CONCLUIDO', 55],
      // Outros clientes
      ['kahango@freelamz.com', 'Desenvolvo a sua loja online completa', FREELA_EMAIL, 42000, '15 dias', 'EM_ANDAMENTO', 20],
      ['kahango@freelamz.com', 'Desenvolvo a sua app Android e iOS', 'helder.nhamirre@freelamz.com', 55000, '30 dias', 'PENDENTE', 4],
      ['kahango@freelamz.com', 'Gestão de campanhas Facebook e Instagram Ads', 'joao.macuacua@freelamz.com', 8000, 'contínuo', 'CONCLUIDO', 35],
      ['kahango@freelamz.com', 'Consultoria financeira e plano de negócios', 'luis.bengo@freelamz.com', 20000, '7 dias', 'CONCLUIDO', 60],
      ['ana.guambe@freelamz.com', 'Produzo o seu vídeo institucional', 'ernesto.chissano@freelamz.com', 25000, '10 dias', 'EM_ANDAMENTO', 9],
      ['ana.guambe@freelamz.com', 'Crio o seu catálogo digital e papelaria', 'fatima.ubisse@freelamz.com', 5000, '5 dias', 'CONCLUIDO', 45],
      ['domingos.vieira@freelamz.com', 'Tradução profissional PT↔EN de documentos', 'amos.matsinhe@freelamz.com', 3500, '3 dias', 'CONCLUIDO', 30],
      ['domingos.vieira@freelamz.com', 'Ensaio fotográfico profissional de produto', 'rosa.chiziane@freelamz.com', 6500, '2 dias', 'PENDENTE', 1],
    ];
    const pid = {}; // pid[cliente+'|'+titulo] = id do projeto
    for (const [cliEmail, svcTitulo, freEmail, valor, prazo, status, diasAtras] of projetos) {
      const [existe] = await c.query('SELECT id FROM projects WHERE cliente_id = ? AND servico_id = ?', [uid[cliEmail], sid[svcTitulo]]);
      let id;
      if (existe.length) {
        id = existe[0].id;
      } else {
        // expressões de data vão inline no SQL (parâmetro ? não serve para NOW() - INTERVAL x DAY)
        const dataInicio = status === 'PENDENTE' ? 'NULL' : `NOW() - INTERVAL ${diasAtras} DAY`;
        const concluidoEm = status === 'CONCLUIDO' ? `NOW() - INTERVAL ${diasAtras - 5} DAY` : 'NULL';
        const [res] = await c.query(
          `INSERT INTO projects (cliente_id, freelancer_id, servico_id, valor, prazo, status, data_inicio, concluido_em, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ${dataInicio}, ${concluidoEm}, NOW() - INTERVAL ? DAY)`,
          [uid[cliEmail], uid[freEmail], sid[svcTitulo], valor, prazo, status, diasAtras]
        );
        id = res.insertId;
      }
      pid[cliEmail + '|' + svcTitulo] = id;
    }
    console.log(`[SEED] ${projetos.length} projetos garantidos (todos os estados)`);

    /* ---------- Propostas (chave natural: projeto + freelancer) ---------- */
    const propostas = [
      // aceitas (projetos em andamento/concluídos)
      [CLIENTE_EMAIL, 'Crio o seu website institucional em React', FREELA_EMAIL, 17000, '7 dias', 'ACEITA', 'Tenho experiência com websites institucionais: faço em React com CMS leve para editar textos. Posso começar já na próxima segunda.', 40],
      [CLIENTE_EMAIL, 'Crio o logótipo e identidade visual da sua marca', 'beatriz.cossa@freelamz.com', 7500, '4 dias', 'ACEITA', 'Vou criar 3 conceitos iniciais para escolher e depois refinar o escolhido até à entrega final com manual de marca.', 6],
      [CLIENTE_EMAIL, 'Otimização SEO do seu website', 'joao.macuacua@freelamz.com', 9000, '10 dias', 'ACEITA', 'Faço auditoria completa e otimizo on-page. Incluo relatório de palavras-chave para Moçambique.', 12],
      [CLIENTE_EMAIL, 'Cobertura fotográfica de eventos', 'rosa.chiziane@freelamz.com', 9500, '1 dia', 'ACEITA', 'Cobertura completa com 100 fotos tratadas. Já fotografei 200+ eventos em Maputo.', 55],
      ['kahango@freelamz.com', 'Desenvolvo a sua loja online completa', FREELA_EMAIL, 42000, '15 dias', 'ACEITA', 'Loja completa com M-Pesa e e-Mola integrados, painel admin e formação da equipa. Cronograma em 3 fases.', 20],
      ['kahango@freelamz.com', 'Gestão de campanhas Facebook e Instagram Ads', 'joao.macuacua@freelamz.com', 8000, 'contínuo', 'ACEITA', 'Gestão de 30 dias com relatórios semanais. Meta inicial: 3x ROI no primeiro mês.', 35],
      ['kahango@freelamz.com', 'Consultoria financeira e plano de negócios', 'luis.bengo@freelamz.com', 20000, '7 dias', 'ACEITA', 'Plano de negócios com projeções a 3 anos pronto para apresentação bancária. Inclui reunião de follow-up.', 60],
      ['ana.guambe@freelamz.com', 'Produzo o seu vídeo institucional', 'ernesto.chissano@freelamz.com', 25000, '10 dias', 'ACEITA', 'Roteiro criativo, filmagem em 4K e edição com motion graphics. Veja o meu portfólio de restaurantes.', 9],
      ['ana.guambe@freelamz.com', 'Crio o seu catálogo digital e papelaria', 'fatima.ubisse@freelamz.com', 5000, '5 dias', 'ACEITA', 'Catálogo interativo em PDF + papelaria completa com a identidade do restaurante.', 45],
      ['domingos.vieira@freelamz.com', 'Tradução profissional PT↔EN de documentos', 'amos.matsinhe@freelamz.com', 3500, '3 dias', 'ACEITA', 'Tradução certificada com revisão. Já traduzi 300+ documentos académicos.', 30],
      // pendentes (aguardam decisão do cliente)
      [CLIENTE_EMAIL, 'Gestão mensal das suas redes sociais', 'marta.muianga@freelamz.com', 11000, 'mensal', 'PENDENTE', 'Gestão completa: calendário, 12 posts, respostas e relatório. Posso mostrar resultados de clientes atuais.', 2],
      ['kahango@freelamz.com', 'Desenvolvo a sua app Android e iOS', 'helder.nhamirre@freelamz.com', 55000, '30 dias', 'PENDENTE', 'App em React Native com painel web para gestão de produtos. Protótipo navegável na primeira semana.', 4],
      ['domingos.vieira@freelamz.com', 'Ensaio fotográfico profissional de produto', 'rosa.chiziane@freelamz.com', 6500, '2 dias', 'PENDENTE', 'Ensaio de 15 produtos no meu estúdio em Pemba ou deslocação à Beira.', 1],
      // recusada + nova pendente (ciclo realista de renegociação)
      [CLIENTE_EMAIL, 'Gestão mensal das suas redes sociais', 'marta.muianga@freelamz.com', 12000, 'mensal', 'RECUSADA', 'Proposta inicial com 16 posts por mês e gestão de anúncios incluída.', 5],
      // cancelada pelo próprio freelancer
      ['ana.guambe@freelamz.com', 'Produzo o seu vídeo institucional', 'ernesto.chissano@freelamz.com', 28000, '10 dias', 'CANCELADA', 'Primeira proposta com filmagem em duas localizações — cancelada após alinhamento de escopo.', 11],
    ];
    const prid = {}; // prid[cliente+'|'+titulo+'|'+status] = id
    for (const [cliEmail, svcTitulo, freEmail, preco, prazo, status, mensagem, diasAtras] of propostas) {
      const projetoId = pid[cliEmail + '|' + svcTitulo];
      const [existe] = await c.query(
        'SELECT id FROM proposals WHERE projeto_id = ? AND freelancer_id = ? AND preco = ?',
        [projetoId, uid[freEmail], preco]
      );
      let id;
      if (existe.length) {
        id = existe[0].id;
        await c.query('UPDATE proposals SET status = ?, prazo = ?, mensagem = ? WHERE id = ?', [status, prazo, mensagem, id]);
      } else {
        const [res] = await c.query(
          `INSERT INTO proposals (projeto_id, freelancer_id, preco, prazo, mensagem, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW() - INTERVAL ? DAY)`,
          [projetoId, uid[freEmail], preco, prazo, mensagem, status, diasAtras]
        );
        id = res.insertId;
      }
      prid[cliEmail + '|' + svcTitulo + '|' + status] = id;
    }
    // vincular propostas aceitas aos projetos correspondentes
    for (const [cliEmail, svcTitulo, freEmail, , , status] of propostas) {
      if (status !== 'ACEITA') continue;
      await c.query('UPDATE projects SET proposta_id = ? WHERE id = ? AND proposta_id IS NULL',
        [prid[cliEmail + '|' + svcTitulo + '|' + status], pid[cliEmail + '|' + svcTitulo]]);
    }
    console.log(`[SEED] ${propostas.length} propostas garantidas (ACEITA/PENDENTE/RECUSADA/CANCELADA)`);

    /* ---------- Mensagens (chave natural: remetente + destinatário + texto) ---------- */
    const mensagens = [
      // conversa CONCLUÍDA: Sérgio ↔ Isabel (site em React)
      [CLIENTE_EMAIL, FREELA_EMAIL, 'Crio o seu website institucional em React', 'Olá Isabel! Vi o seu perfil e gostava de um website para a minha consultoria. É possível?', 40, 1],
      [FREELA_EMAIL, CLIENTE_EMAIL, 'Crio o seu website institucional em React', 'Olá Sérgio! Sim, é perfeitamente possível. Que páginas precisa e tem logo a identidade visual?', 40, 1],
      [CLIENTE_EMAIL, FREELA_EMAIL, 'Crio o seu website institucional em React', 'Preciso de Início, Serviços, Sobre e Contacto. Tenho logótipo e cores definidas.', 39, 1],
      [FREELA_EMAIL, CLIENTE_EMAIL, 'Crio o seu website institucional em React', 'Excelente! Vou enviar a proposta hoje mesmo e começamos na segunda.', 39, 1],
      [FREELA_EMAIL, CLIENTE_EMAIL, 'Crio o seu website institucional em React', 'Sérgio, o site está pronto para revisão. Pode ver em ambiente de teste: sergio-bila.freelamz.dev', 34, 1],
      [CLIENTE_EMAIL, FREELA_EMAIL, 'Crio o seu website institucional em React', 'Ficou incrível, Isabel! Só ajusta o texto da página de serviços. Fora isso, aprovado ✅', 33, 1],
      [FREELA_EMAIL, CLIENTE_EMAIL, 'Crio o seu website institucional em React', 'Ajustamento feito. Já está no ar no seu domínio. Obrigada pela confiança! 🚀', 32, 1],
      // conversa EM ANDAMENTO: Sérgio ↔ Beatriz (logótipo) — últimas não lidas
      [CLIENTE_EMAIL, 'beatriz.cossa@freelamz.com', 'Crio o logótipo e identidade visual da sua marca', 'Boa tarde Beatriz! Aceito a sua proposta para o logótipo. Quando podemos começar?', 6, 1],
      ['beatriz.cossa@freelamz.com', CLIENTE_EMAIL, 'Crio o logótipo e identidade visual da sua marca', 'Boa tarde Sérgio! Começo amanhã e envio os 3 conceitos em 2 dias.', 6, 1],
      ['beatriz.cossa@freelamz.com', CLIENTE_EMAIL, 'Crio o logótipo e identidade visual da sua marca', 'Sérgio, seguem os 3 conceitos iniciais. O conceito B usa a paleta azul que gosta. Qual prefere?', 3, 0],
      ['beatriz.cossa@freelamz.com', CLIENTE_EMAIL, 'Crio o logótipo e identidade visual da sua marca', 'Enviei também uma variação do conceito B com o símbolo em coral. Estou à espera do seu feedback 🙂', 1, 0],
      // proposta pendente: Sérgio ↔ Marta
      ['marta.muianga@freelamz.com', CLIENTE_EMAIL, 'Gestão mensal das suas redes sociais', 'Olá Sérgio! Enviei uma nova proposta com preço mais ajustado. Quando puder, veja o meu portfólio de gestão de redes ✨', 1, 0],
      // outro cliente: Kahango ↔ Isabel (loja online)
      ['kahango@freelamz.com', FREELA_EMAIL, 'Desenvolvo a sua loja online completa', 'Isabel, a loja está a ficar ótima! O checkout com M-Pesa já funciona nos testes?', 3, 0],
      [FREELA_EMAIL, 'kahango@freelamz.com', 'Desenvolvo a sua loja online completa', 'Já sim! Estou a terminar o painel de administração e faço a formação na sexta.', 2, 1],
    ];
    for (const [deEmail, paraEmail, svcTitulo, texto, diasAtras, lida] of mensagens) {
      const [existe] = await c.query(
        'SELECT id FROM messages WHERE remetente_id = ? AND destinatario_id = ? AND mensagem = ?',
        [uid[deEmail], uid[paraEmail], texto]
      );
      if (existe.length) continue;
      await c.query(
        `INSERT INTO messages (remetente_id, destinatario_id, projeto_id, mensagem, lida, created_at)
         VALUES (?, ?, ?, ?, ?, NOW() - INTERVAL ? DAY)`,
        [uid[deEmail], uid[paraEmail], pid[deEmail + '|' + svcTitulo] || pid[paraEmail + '|' + svcTitulo] || null, texto, lida, diasAtras]
      );
    }
    console.log(`[SEED] ${mensagens.length} mensagens garantidas`);

    /* ---------- Avaliações (unique: projeto + avaliador) ---------- */
    const reviews = [
      [CLIENTE_EMAIL, 'Crio o seu website institucional em React', FREELA_EMAIL, 5, 'Trabalho impecável! A Isabel entregou antes do prazo, comunicou sempre e o site ficou acima do esperado. Recomendo a todos.', 31],
      [FREELA_EMAIL, 'Crio o seu website institucional em React', CLIENTE_EMAIL, 5, 'Cliente exemplar: briefings claros, feedback rápido e pagamento pontual. Gostei muito de trabalhar com o Sérgio.', 31],
      [CLIENTE_EMAIL, 'Cobertura fotográfica de eventos', 'rosa.chiziane@freelamz.com', 4, 'Fotos excelentes e entrega rápida. Só faltou um pequeno atraso na entrega dos retoques finais.', 50],
      ['kahango@freelamz.com', 'Gestão de campanhas Facebook e Instagram Ads', 'joao.macuacua@freelamz.com', 5, 'As campanhas do João triplicaram as vendas da loja no primeiro mês. Relatórios claros e resultados reais.', 30],
      ['kahango@freelamz.com', 'Consultoria financeira e plano de negócios', 'luis.bengo@freelamz.com', 5, 'Plano de negócios aprovado pelo banco à primeira. O Luís domina o que faz.', 55],
      ['ana.guambe@freelamz.com', 'Crio o seu catálogo digital e papelaria', 'fatima.ubisse@freelamz.com', 4, 'Catálogo lindo, clientes adoram. Comunicação boa, entrega com 1 dia de atraso apenas.', 40],
      ['domingos.vieira@freelamz.com', 'Tradução profissional PT↔EN de documentos', 'amos.matsinhe@freelamz.com', 5, 'Tradução impecável dos nossos documentos académicos, entregues em 2 dias. Profissional de excelência.', 25],
    ];
    for (const [avaliadorEmail, svcTitulo, avaliadoEmail, nota, comentario, diasAtras] of reviews) {
      const projetoId = pid[avaliadorEmail + '|' + svcTitulo];
      await c.query(
        `INSERT IGNORE INTO reviews (projeto_id, avaliador_id, avaliado_id, nota, comentario, created_at)
         VALUES (?, ?, ?, ?, ?, NOW() - INTERVAL ? DAY)`,
        [projetoId, uid[avaliadorEmail], uid[avaliadoEmail], nota, comentario, diasAtras]
      );
    }
    console.log(`[SEED] ${reviews.length} avaliações garantidas`);

    /* ---------- Favoritos ---------- */
    const favoritos = [
      [CLIENTE_EMAIL, 'freelancer', FREELA_EMAIL],
      [CLIENTE_EMAIL, 'freelancer', 'beatriz.cossa@freelamz.com'],
      [CLIENTE_EMAIL, 'freelancer', 'rosa.chiziane@freelamz.com'],
      [CLIENTE_EMAIL, 'servico', 'Desenvolvo a sua loja online completa'],
      [CLIENTE_EMAIL, 'servico', 'Produzo o seu vídeo institucional'],
      ['kahango@freelamz.com', 'freelancer', FREELA_EMAIL],
      ['kahango@freelamz.com', 'servico', 'Desenvolvo a sua app Android e iOS'],
      ['ana.guambe@freelamz.com', 'freelancer', 'ernesto.chissano@freelamz.com'],
    ];
    for (const [userEmail, tipo, alvo] of favoritos) {
      const alvoId = tipo === 'freelancer' ? uid[alvo] : sid[alvo];
      await c.query('INSERT IGNORE INTO favorites (user_id, tipo, alvo_id) VALUES (?, ?, ?)', [uid[userEmail], tipo, alvoId]);
    }
    console.log(`[SEED] ${favoritos.length} favoritos garantidos`);

    /* ---------- Notificações ---------- */
    const notificacoes = [
      [CLIENTE_EMAIL, 'nova_proposta', 'Nova proposta recebida', 'Marta Muianga enviou uma nova proposta para o projeto "Gestão mensal das suas redes sociais".', 1, 0],
      [CLIENTE_EMAIL, 'projeto_iniciado', 'Projeto iniciado', 'Você aceitou a proposta de 7500 MT de Beatriz Cossa. O projeto está em andamento.', 6, 1],
      [CLIENTE_EMAIL, 'projeto_concluido', 'Projeto concluído', 'O projeto "Crio o seu website institucional em React" foi concluído com sucesso.', 32, 1],
      [CLIENTE_EMAIL, 'nova_mensagem', 'Nova mensagem', 'Você recebeu uma nova mensagem de Beatriz Cossa.', 1, 0],
      [CLIENTE_EMAIL, 'projeto_atualizado', 'Status do projeto alterado', 'O projeto "Otimização SEO do seu website" passou para o status "ENTREGUE".', 2, 0],
      [FREELA_EMAIL, 'proposta_aceita', 'Proposta aceita! 🎉', 'Sua proposta para "Crio o seu website institucional em React" foi aceita pelo cliente. O projeto começou.', 40, 1],
      [FREELA_EMAIL, 'nova_avaliacao', 'Nova avaliação recebida', 'Você recebeu uma avaliação de 5 estrelas.', 31, 1],
      [FREELA_EMAIL, 'novo_projeto', 'Novo projeto criado', 'A Loja Kahango criou um projeto de loja online para você. Valor: 42000 MT', 20, 1],
      [FREELA_EMAIL, 'nova_mensagem', 'Nova mensagem', 'A Loja Kahango enviou uma mensagem sobre o projeto da loja.', 3, 0],
      ['marta.muianga@freelamz.com', 'proposta_recusada', 'Proposta recusada', 'Sua proposta de 12000 MT para a gestão de redes não foi aceita desta vez. Envie uma nova!', 5, 1],
      ['beatriz.cossa@freelamz.com', 'proposta_aceita', 'Proposta aceita! 🎉', 'Sua proposta para o logótipo do Sérgio Bila foi aceita. O projeto começou.', 6, 1],
      [ADMIN_EMAIL, 'nova_denuncia', 'Nova denúncia recebida', 'Há novas denúncias pendentes no painel de administração.', 2, 0],
    ];
    for (const [userEmail, tipo, titulo, mensagem, diasAtras, lida] of notificacoes) {
      const [existe] = await c.query('SELECT id FROM notifications WHERE user_id = ? AND titulo = ? AND mensagem = ?', [uid[userEmail], titulo, mensagem]);
      if (existe.length) {
        await c.query('UPDATE notifications SET lida = ?, tipo = ? WHERE id = ?', [lida, tipo, existe[0].id]);
        continue;
      }
      await c.query(
        `INSERT INTO notifications (user_id, tipo, titulo, mensagem, lida, created_at)
         VALUES (?, ?, ?, ?, ?, NOW() - INTERVAL ? DAY)`,
        [uid[userEmail], tipo, titulo, mensagem, lida, diasAtras]
      );
    }
    console.log(`[SEED] ${notificacoes.length} notificações garantidas`);

    /* ---------- Denúncias ---------- */
    const denuncias = [
      ['domingos.vieira@freelamz.com', 'servico', 'Desenvolvo a sua app Android e iOS', 'Conteúdo enganoso', 'O prazo prometido de 30 dias parece irrealista e o valor muito baixo para o escopo descrito.', 'PENDENTE', 3],
      ['ana.guambe@freelamz.com', 'servico', 'Gravo e edito o seu podcast', 'Spam ou publicidade indevida', 'Este serviço aparece repetidamente nos resultados e parece publicidade disfarçada.', 'PENDENTE', 2],
      ['kahango@freelamz.com', 'freelancer', 'marta.muianga@freelamz.com', 'Comportamento inadequado', 'A freelancer enviou mensagens insistindo em pagamento fora da plataforma.', 'RESOLVIDA', 10],
    ];
    for (const [userEmail, tipo, alvo, motivo, descricao, status, diasAtras] of denuncias) {
      const alvoId = tipo === 'servico' ? sid[alvo] : uid[alvo];
      const [existe] = await c.query('SELECT id FROM reports WHERE user_id = ? AND tipo = ? AND alvo_id = ? AND motivo = ?', [uid[userEmail], tipo, alvoId, motivo]);
      if (existe.length) {
        // repor o estado do seed ( smoke pode ter resolvido e não revertido)
        await c.query('UPDATE reports SET status = ? WHERE id = ?', [status, existe[0].id]);
        continue;
      }
      await c.query(
        `INSERT INTO reports (user_id, tipo, alvo_id, motivo, descricao, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW() - INTERVAL ? DAY)`,
        [uid[userEmail], tipo, alvoId, motivo, descricao, status, diasAtras]
      );
    }
    console.log(`[SEED] ${denuncias.length} denúncias garantidas`);

    /* ==========================================================
       FASE A — Carteiras (saldo fictício) + escrow coerente
       ========================================================== */
    await c.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        balance BIGINT NOT NULL DEFAULT 0,
        currency VARCHAR(8) NOT NULL DEFAULT 'MZN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_wallets_user (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await c.query(`
      INSERT INTO wallets (user_id)
      SELECT u.id FROM users u WHERE u.id NOT IN (SELECT user_id FROM wallets)
    `);

    /* Saldo fictício de partida (nunca reduz o saldo atual) */
    const saldosIniciais = [
      [CLIENTE_EMAIL, 1500000],   // 15.000 MT
      [FREELA_EMAIL, 250000],     // 2.500 MT
      ['kahango@freelamz.com', 500000], // 5.000 MT
    ];
    for (const [email, cents] of saldosIniciais) {
      await c.query(
        'UPDATE wallets SET balance = GREATEST(balance, ?) WHERE user_id = ?',
        [cents, uid[email]]
      );
    }
    console.log('[SEED] Carteiras criadas — cliente de teste com 15.000 MT fictícios');

    /* Escrow coerente para os projetos históricos do seed
       (EM_ANDAMENTO/ENTREGUE → RETIDO; CONCLUIDO → LIBERADO + pagamento ao freelancer).
       Referências SEED-* tornam a operação idempotente (UNIQUE reference). */
    await c.query(`
      CREATE TABLE IF NOT EXISTS escrow (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        project_id INT UNSIGNED NOT NULL,
        amount_held BIGINT NOT NULL DEFAULT 0,
        platform_fee BIGINT NOT NULL DEFAULT 0,
        status ENUM('AGUARDANDO_PAGAMENTO','RETIDO','LIBERADO','REEMBOLSADO','EM_DISPUTA')
          NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
        paid_at TIMESTAMP NULL, released_at TIMESTAMP NULL, refunded_at TIMESTAMP NULL,
        dispute_reason TEXT, dispute_decision VARCHAR(40), dispute_percent_freelancer TINYINT UNSIGNED,
        dispute_decided_by INT UNSIGNED, dispute_decided_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_escrow_project (project_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        INDEX idx_escrow_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await c.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tipo ENUM('RECARGA_FICTICIA','PAGAMENTO_PROJETO','LIBERACAO_ESCROW','COMISSAO',
                   'REEMBOLSO','AJUSTE_VALOR','SAQUE','SAQUE_RECUSADO') NOT NULL,
        valor BIGINT NOT NULL,
        wallet_origem_id INT UNSIGNED NULL,
        wallet_destino_id INT UNSIGNED NULL,
        project_id INT UNSIGNED NULL,
        status ENUM('CONCLUIDA','FALHADA') NOT NULL DEFAULT 'CONCLUIDA',
        reference VARCHAR(80) NOT NULL,
        descricao VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_transactions_reference (reference),
        INDEX idx_transactions_project (project_id),
        INDEX idx_transactions_origem (wallet_origem_id),
        INDEX idx_transactions_destino (wallet_destino_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [semEscrow] = await c.query(`
      SELECT p.id, p.valor, p.cliente_id, p.freelancer_id, p.status
      FROM projects p LEFT JOIN escrow e ON e.project_id = p.id
      WHERE e.id IS NULL AND p.status IN ('EM_ANDAMENTO','ENTREGUE','CONCLUIDO') AND p.valor > 0
    `);
    let escrowCriados = 0;
    for (const p of semEscrow) {
      const valor = Math.round(Number(p.valor) * 100);
      const fee = Math.round(valor * 0.10);
      const liquido = valor - fee;
      const pago = p.status === 'CONCLUIDO';
      await c.query(
        `INSERT INTO escrow (project_id, amount_held, platform_fee, status, paid_at, released_at)
         VALUES (?, ?, ?, ?, NOW() - INTERVAL 20 DAY, ${pago ? 'NOW() - INTERVAL 10 DAY' : 'NULL'})`,
        [p.id, valor, fee, pago ? 'LIBERADO' : 'RETIDO']
      );
      // livro-razão (INSERT IGNORE → idempotente pela reference única)
      await c.query(
        `INSERT IGNORE INTO transactions (tipo, valor, project_id, reference, descricao, created_at)
         VALUES ('PAGAMENTO_PROJETO', ?, ?, ?, 'Pagamento do projeto (seed)', NOW() - INTERVAL 20 DAY)`,
        [valor, p.id, `SEED-PAY-${p.id}`]
      );
      if (pago) {
        const [[wf]] = await c.query('SELECT id FROM wallets WHERE user_id = ?', [p.freelancer_id]);
        if (wf) {
          await c.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [liquido, wf.id]);
          await c.query(
            `INSERT IGNORE INTO transactions (tipo, valor, wallet_destino_id, project_id, reference, descricao, created_at)
             VALUES ('LIBERACAO_ESCROW', ?, ?, ?, ?, 'Escrow liberado (seed)', NOW() - INTERVAL 10 DAY)`,
            [liquido, wf.id, p.id, `SEED-REL-${p.id}`]
          );
          await c.query(
            `INSERT IGNORE INTO transactions (tipo, valor, project_id, reference, descricao, created_at)
             VALUES ('COMISSAO', ?, ?, ?, 'Comissão da plataforma (seed)', NOW() - INTERVAL 10 DAY)`,
            [fee, p.id, `SEED-COM-${p.id}`]
          );
        }
      }
      escrowCriados += 1;
    }
    if (escrowCriados) console.log(`[SEED] ${escrowCriados} escrows criados para projetos históricos`);

    /* ---------- Consistência: perfis a partir dos dados reais ---------- */
    await c.query(`
      UPDATE profiles p
      LEFT JOIN (SELECT avaliado_id, ROUND(AVG(nota), 1) as media, COUNT(*) as total FROM reviews GROUP BY avaliado_id) r
        ON r.avaliado_id = p.user_id
      SET p.classificacao = COALESCE(r.media, 0), p.num_avaliacoes = COALESCE(r.total, 0)
    `);
    await c.query(`
      UPDATE profiles p
      LEFT JOIN (SELECT freelancer_id, COUNT(*) as total FROM projects WHERE status = 'CONCLUIDO' GROUP BY freelancer_id) t
        ON t.freelancer_id = p.user_id
      SET p.trabalhos_concluidos = COALESCE(t.total, 0)
    `);

    /* ---------- Resumo ---------- */
    const [tot] = await c.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM users WHERE tipo_usuario = 'FREELANCER') as freelancers,
        (SELECT COUNT(*) FROM users WHERE tipo_usuario = 'CLIENTE') as clientes,
        (SELECT COUNT(*) FROM services) as services,
        (SELECT COUNT(*) FROM projects) as projects,
        (SELECT COUNT(*) FROM proposals) as proposals,
        (SELECT COUNT(*) FROM messages) as messages,
        (SELECT COUNT(*) FROM reviews) as reviews,
        (SELECT COUNT(*) FROM notifications) as notifications,
        (SELECT COUNT(*) FROM reports) as reports
    `);
    const t = tot[0];
    console.log('\n[SEED] ═══════ RESUMO ═══════');
    console.log(`Utilizadores: ${t.users} (${t.freelancers} freelancers, ${t.clientes} clientes)`);
    console.log(`Serviços: ${t.services} · Projetos: ${t.projects} · Propostas: ${t.proposals}`);
    console.log(`Mensagens: ${t.messages} · Avaliações: ${t.reviews} · Notificações: ${t.notifications} · Denúncias: ${t.reports}`);
    console.log('\n═══════ CREDENCIAIS PRINCIPAIS ═══════');
    console.log(`Admin:     ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}${process.env.ADMIN_PASSWORD ? '' : '  (default — defina ADMIN_PASSWORD no .env)'}`);
    console.log('Cliente:   cliente@freelamz.com / Cliente@123');
    console.log('Freelancer: freela@freelamz.com / Freela@123');
    console.log('Outros:    senha 123456 (ex.: carlos.mabjaia@freelamz.com, kahango@freelamz.com)');
    console.log('[SEED] Concluído com sucesso!');
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error('[SEED] Erro:', err);
  process.exit(1);
});
