-- ==================== CONFIGURAÇÃO DE STORAGE PARA UPLOAD DE IMAGENS ====================

-- 1. Garantir que o bucket existe (versão simplificada)
INSERT INTO storage.buckets (id, name, public)
VALUES ('raffle-images', 'raffle-images', true)
ON CONFLICT (id) DO NOTHING;

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
