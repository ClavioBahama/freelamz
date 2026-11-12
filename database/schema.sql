-- ============================================================
-- FreelaMZ - Schema do Banco de Dados MySQL
-- Banco: freelamz (utf8mb4)
-- Execute: mysql -u root -p freelamz < database/schema.sql
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Tabela: users
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  nome_utilizador VARCHAR(60) NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  telefone VARCHAR(30),
  whatsapp VARCHAR(30),
  senha_hash VARCHAR(255) NOT NULL,
  tipo_usuario ENUM('CLIENTE', 'FREELANCER', 'ADMIN') NOT NULL DEFAULT 'CLIENTE',
  foto VARCHAR(255),
  capa VARCHAR(255),
  bio VARCHAR(160),
  sobre_mim VARCHAR(1000),
  cidade VARCHAR(60),
  provincia VARCHAR(60),
  pais VARCHAR(60) DEFAULT 'Moçambique',
  idiomas VARCHAR(255),
  linkedin VARCHAR(255),
  instagram VARCHAR(255),
  facebook VARCHAR(255),
  site_pessoal VARCHAR(255),
  email_verificado TINYINT(1) NOT NULL DEFAULT 0,
  telefone_verificado TINYINT(1) NOT NULL DEFAULT 0,
  verificado_plataforma TINYINT(1) NOT NULL DEFAULT 0,
  tipo_cliente ENUM('pessoa','empresa') DEFAULT NULL,
  nome_empresa VARCHAR(120),
  setor VARCHAR(80),
  tamanho_equipa VARCHAR(30),
  status ENUM('ativo', 'bloqueado', 'inativo') NOT NULL DEFAULT 'ativo',
  ultima_atividade TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_nome_utilizador (nome_utilizador),
  INDEX idx_users_email (email),
  INDEX idx_users_tipo (tipo_usuario),
  INDEX idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: profiles (perfil profissional do freelancer)
CREATE TABLE IF NOT EXISTS profiles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  titulo VARCHAR(150),
  descricao TEXT,
  localizacao VARCHAR(100),
  habilidades VARCHAR(255),
  experiencia VARCHAR(100),
  idiomas VARCHAR(100),
  preco_por_hora DECIMAL(12,2) DEFAULT 0.00,
  disponibilidade ENUM('disponivel', 'ocupado', 'indisponivel') DEFAULT 'disponivel',
  foto VARCHAR(255),
  categoria_id INT UNSIGNED,
  nivel ENUM('iniciante','intermedio','especialista') NOT NULL DEFAULT 'iniciante',
  anos_experiencia TINYINT UNSIGNED NOT NULL DEFAULT 0,
  educacao JSON NULL,
  experiencia_prof JSON NULL,
  certificacoes JSON NULL,
  metodos_recebimento JSON NULL,
  classificacao DECIMAL(3,2) DEFAULT 0.00,
  trabalhos_concluidos INT UNSIGNED DEFAULT 0,
  num_avaliacoes INT UNSIGNED DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (categoria_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_profiles_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: portfolio_items (portfólio do freelancer)
CREATE TABLE IF NOT EXISTS portfolio_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  descricao TEXT,
  link VARCHAR(255),
  ordem INT UNSIGNED DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_portfolio_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: portfolio_images (imagens dos itens de portfólio)
CREATE TABLE IF NOT EXISTS portfolio_images (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id INT UNSIGNED NOT NULL,
  url VARCHAR(255) NOT NULL,
  ordem INT UNSIGNED DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES portfolio_items(id) ON DELETE CASCADE,
  INDEX idx_portfolio_images_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: categories
CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL,
  icone VARCHAR(100),
  cor VARCHAR(20),
  descricao TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_categories_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: skills (habilidades soltas)
CREATE TABLE IF NOT EXISTS skills (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE,
  categoria_id INT UNSIGNED,
  FOREIGN KEY (categoria_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_skills_categoria (categoria_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: user_skills (junção usuário <-> habilidade)
CREATE TABLE IF NOT EXISTS user_skills (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  skill_id INT UNSIGNED NOT NULL,
  UNIQUE KEY uk_user_skills (user_id, skill_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: services
CREATE TABLE IF NOT EXISTS services (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  freelancer_id INT UNSIGNED NOT NULL,
  categoria_id INT UNSIGNED NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  descricao TEXT NOT NULL,
  preco DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  prazo_entrega VARCHAR(60),
  status ENUM('ativo', 'inativo', 'bloqueado') DEFAULT 'ativo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (freelancer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (categoria_id) REFERENCES categories(id),
  INDEX idx_services_freelancer (freelancer_id),
  INDEX idx_services_categoria (categoria_id),
  INDEX idx_services_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: service_images
CREATE TABLE IF NOT EXISTS service_images (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  service_id INT UNSIGNED NOT NULL,
  url VARCHAR(255) NOT NULL,
  ordem INT UNSIGNED DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  INDEX idx_service_images_service (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: proposals
CREATE TABLE IF NOT EXISTS proposals (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projeto_id INT UNSIGNED NOT NULL,
  freelancer_id INT UNSIGNED NOT NULL,
  preco DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  prazo VARCHAR(60),
  mensagem TEXT,
  status ENUM('PENDENTE', 'ACEITA', 'RECUSADA', 'CANCELADA') DEFAULT 'PENDENTE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (projeto_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (freelancer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_proposals_projeto (projeto_id),
  INDEX idx_proposals_freelancer (freelancer_id),
  INDEX idx_proposals_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: projects
CREATE TABLE IF NOT EXISTS projects (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT UNSIGNED NOT NULL,
  freelancer_id INT UNSIGNED NOT NULL,
  proposta_id INT UNSIGNED,
  servico_id INT UNSIGNED,
  valor DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  prazo VARCHAR(60),
  status ENUM('PENDENTE', 'EM_ANDAMENTO', 'ENTREGUE', 'CONCLUIDO', 'CANCELADO') DEFAULT 'PENDENTE',
  data_inicio TIMESTAMP NULL,
  concluido_em TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (freelancer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (proposta_id) REFERENCES proposals(id) ON DELETE SET NULL,
  FOREIGN KEY (servico_id) REFERENCES services(id) ON DELETE SET NULL,
  INDEX idx_projects_cliente (cliente_id),
  INDEX idx_projects_freelancer (freelancer_id),
  INDEX idx_projects_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: messages
CREATE TABLE IF NOT EXISTS messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  remetente_id INT UNSIGNED NOT NULL,
  destinatario_id INT UNSIGNED NOT NULL,
  projeto_id INT UNSIGNED,
  mensagem TEXT NOT NULL,
  lida TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (remetente_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (destinatario_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (projeto_id) REFERENCES projects(id) ON DELETE SET NULL,
  INDEX idx_messages_destinatario (destinatario_id),
  INDEX idx_messages_lida (lida),
  INDEX idx_messages_projeto (projeto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: reviews
CREATE TABLE IF NOT EXISTS reviews (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projeto_id INT UNSIGNED NOT NULL,
  avaliador_id INT UNSIGNED NOT NULL,
  avaliado_id INT UNSIGNED NOT NULL,
  nota TINYINT UNSIGNED NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (projeto_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (avaliador_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (avaliado_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_reviews_projeto_avaliador (projeto_id, avaliador_id),
  INDEX idx_reviews_avaliado (avaliado_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: favorites
CREATE TABLE IF NOT EXISTS favorites (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  tipo ENUM('freelancer', 'servico') NOT NULL,
  alvo_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_favorites (user_id, tipo, alvo_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_favorites_user (user_id),
  INDEX idx_favorites_tipo_alvo (tipo, alvo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  tipo VARCHAR(50),
  titulo VARCHAR(150),
  mensagem TEXT,
  dados JSON,
  lida TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_lida (lida)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Fim do schema
-- ============================================================
