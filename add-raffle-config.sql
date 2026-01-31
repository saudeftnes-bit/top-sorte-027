-- ==================== ADICIONAR CONFIGURAÇÃO DE NÚMEROS E MODO ====================

-- 1. Adicionar campo para quantidade total de números
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS total_numbers INTEGER DEFAULT 10000;

-- 2. Adicionar campo para modo de seleção
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS selection_mode TEXT DEFAULT 'loteria' 
CHECK (selection_mode IN ('loteria', 'jogo_bicho'));

-- 3. Comentários
COMMENT ON COLUMN raffles.total_numbers IS 'Quantidade total de números disponíveis no sorteio (ex: 100, 1000, 10000)';
COMMENT ON COLUMN raffles.selection_mode IS 'Modo de seleção: loteria (números simples 0001-9999) ou jogo_bicho (25 animais)';

-- 4. Atualizar sorteio ativo com valores padrão
UPDATE raffles
SET 
  total_numbers = 10000,
  selection_mode = 'loteria'
WHERE status = 'active';

-- 5. Verificar estrutura
SELECT id, title, total_numbers, selection_mode, status
FROM raffles
WHERE status = 'active';
