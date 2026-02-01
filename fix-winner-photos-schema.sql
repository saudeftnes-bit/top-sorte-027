-- ==================== CORREÇÃO DA TABELA DE GANHADORES ====================

-- 1. Remover a restrição NOT NULL de photo_url para permitir vídeos sem foto
ALTER TABLE winner_photos ALTER COLUMN photo_url DROP NOT NULL;

-- 2. Garantir que as colunas de vídeo e tipo de mídia existam
ALTER TABLE winner_photos 
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'photo' CHECK (media_type IN ('photo', 'youtube', 'instagram')),
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 3. Comentários para documentação
COMMENT ON COLUMN winner_photos.photo_url IS 'URL da foto (opcional se houver vídeo)';
COMMENT ON COLUMN winner_photos.media_type IS 'Tipo de mídia: photo, youtube ou instagram';
COMMENT ON COLUMN winner_photos.video_url IS 'URL do vídeo do YouTube ou Reels do Instagram';
