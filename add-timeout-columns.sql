-- ==================== CORREÇÃO: ADICIONAR COLUNAS FALTANTES NA TABELA RAFFLES ====================
-- Este script adiciona as colunas de timeout que estão faltando na tabela raffles

-- Adicionar colunas de timeout
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS selection_timeout INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS payment_timeout INTEGER DEFAULT 30;

-- Comentários para documentação
COMMENT ON COLUMN raffles.selection_timeout IS 'Tempo em minutos para confirmar seleção de números';
COMMENT ON COLUMN raffles.payment_timeout IS 'Tempo em minutos para realizar o pagamento após confirmar dados';

-- Atualizar registros existentes com valores padrão
UPDATE raffles 
SET 
  selection_timeout = COALESCE(selection_timeout, 5),
  payment_timeout = COALESCE(payment_timeout, 30)
WHERE selection_timeout IS NULL OR payment_timeout IS NULL;

-- Verificar se as colunas foram criadas
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'raffles'
  AND column_name IN ('selection_timeout', 'payment_timeout');

-- Resultado esperado: 2 linhas mostrando as colunas criadas
