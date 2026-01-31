-- ==================== ADICIONAR SUPORTE A VÍDEOS NA SEÇÃO DE GANHADORES ====================

-- 1. Adicionar campo para tipo de mídia
ALTER TABLE winner_photos 
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'photo' CHECK (media_type IN ('photo', 'youtube', 'instagram'));

-- 2. Adicionar campo para URL do vídeo
ALTER TABLE winner_photos 
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 3. Comentários explicativos
COMMENT ON COLUMN winner_photos.media_type IS 'Tipo de mídia: photo (foto), youtube (vídeo YouTube), instagram (vídeo Instagram)';
COMMENT ON COLUMN winner_photos.video_url IS 'URL completa do vídeo (YouTube ou Instagram). Deixar NULL se media_type for photo';

-- 4. Verificar estrutura atualizada
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'winner_photos'
ORDER BY ordinal_position;

-- ==================== EXEMPLO DE DADOS ====================

-- Exemplo: Adicionar ganhador com vídeo do YouTube
INSERT INTO winner_photos (name, prize, media_type, video_url, display_order) VALUES
('Carlos Souza', 'Moto Fan 160', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 10);

-- Exemplo: Adicionar ganhador com vídeo do Instagram  
INSERT INTO winner_photos (name, prize, media_type, video_url, display_order) VALUES
('Ana Paula', 'R$ 10.000 PIX', 'instagram', 'https://www.instagram.com/reel/DS8GnYPDsPw/', 11);

-- Exemplo: Adicionar ganhador com foto (modo tradicional)
INSERT INTO winner_photos (name, prize, media_type, photo_url, display_order) VALUES
('Roberto Lima', 'iPhone 15', 'photo', 'https://images.unsplash.com/photo-1234567890', 12);
