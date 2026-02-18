-- Adicionar colunas de timeout na tabela raffles
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS selection_timeout INTEGER DEFAULT 5;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_timeout INTEGER DEFAULT 15;

COMMENT ON COLUMN raffles.selection_timeout IS 'Tempo em minutos que o número de sorteio fica bloqueado durante a escolha (Amarelo)';
COMMENT ON COLUMN raffles.payment_timeout IS 'Tempo em minutos para expiração do PIX e liberação do número';
