-- ==================== CONFIGURAÇÃO DE STORAGE PARA UPLOAD DE IMAGENS ====================

-- 1. Garantir que o bucket existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'raffle-images',
    'raffle-images',
    true,
    5242880, -- 5MB em bytes
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET 
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[];

-- 2. Atualizar/Criar políticas de upload
DROP POLICY IF EXISTS "Anyone can upload raffle images" ON storage.objects;
CREATE POLICY "Anyone can upload raffle images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'raffle-images');

-- 3. Atualizar/Criar políticas de visualização
DROP POLICY IF EXISTS "Anyone can view raffle images" ON storage.objects;
CREATE POLICY "Anyone can view raffle images"
ON storage.objects FOR SELECT
USING (bucket_id = 'raffle-images');

-- 4. Atualizar/Criar políticas de atualização
DROP POLICY IF EXISTS "Anyone can update raffle images" ON storage.objects;
CREATE POLICY "Anyone can update raffle images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'raffle-images');

-- 5. Atualizar/Criar políticas de deleção
DROP POLICY IF EXISTS "Anyone can delete raffle images" ON storage.objects;
CREATE POLICY "Anyone can delete raffle images"
ON storage.objects FOR DELETE
USING (bucket_id = 'raffle-images');

-- 6. Verificar configuração
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
WHERE id = 'raffle-images';
