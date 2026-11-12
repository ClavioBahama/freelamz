-- ============================================================
-- FreelaMZ - Seed (dados iniciais)
-- Executa APÓS o schema.sql
-- Usuários e senhas são populados pelo script: backend/src/scripts/seed.js
-- (bcrypt exige hash gerado em tempo de execução)
-- ============================================================

SET NAMES utf8mb4;

-- Categorias (com ícone Framework7 e cor)
INSERT IGNORE INTO categories (nome, icone, cor, descricao) VALUES
('Desenvolvimento Web', 'f7:globe', '#2563EB', 'Criação de sites, lojas virtuais e sistemas web'),
('Design Gráfico', 'f7:pencil', '#7C3AED', 'Logos, identidade visual e materiais gráficos'),
('Marketing Digital', 'f7:megaphone', '#10B981', 'Redes sociais, tráfego pago e campanhas'),
('Redação', 'f7:document_text', '#F59E0B', 'Artigos, copywriting e conteúdos'),
('Tradução', 'f7:translate', '#EC4899', 'Tradução de documentos e textos'),
('Fotografia', 'f7:camera', '#EF4444', 'Fotos profissionais e eventos'),
('Vídeo', 'f7:video_camera', '#06B6D4', 'Edição e produção de vídeos'),
('Programação', 'f7:code', '#6366F1', 'Softwares, apps e automação'),
('Assistente Virtual', 'f7:person', '#8B5CF6', 'Suporte administrativo remoto'),
('Contabilidade', 'f7:book', '#14B8A6', 'Serviços contábeis e fiscais'),
('Redes', 'f7:wifi', '#F97316', 'Redes de computadores e infraestrutura'),
('Suporte Técnico', 'f7:headset', '#64748B', 'Suporte de TI e manutenção');

-- Habilidades exemplo
INSERT IGNORE INTO skills (nome, categoria_id) VALUES
('WordPress', 1), ('React', 1), ('Node.js', 1), ('PHP', 1),
('Photoshop', 2), ('Illustrator', 2), ('Figma', 2),
('SEO', 3), ('Facebook Ads', 3),
('Português', 4), ('Inglês', 4),
('Português ↔ Inglês', 5),
('Foto de evento', 6),
('Edição de vídeo', 7),
('Excel', 10);

-- ============================================================
-- Fim do seed
-- ============================================================
