-- ==================== ADICIONAR CAMPO INSTAGRAM_URL ====================

-- Adicionar coluna instagram_url na tabela raffles
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS instagram_url TEXT;

-- ==================== ATUALIZAR SORTEIO ATIVO COM INSTAGRAM ====================

-- Atualizar o sorteio ativo com a URL do Instagram
UPDATE raffles
SET instagram_url = 'https://www.instagram.com/topsorte_027?igsh=MW4wZGN0enFobHJldw=='
WHERE status = 'active';

-- Verificar se foi atualizado
SELECT id, title, instagram_url, status 
FROM raffles 
WHERE status = 'active';
