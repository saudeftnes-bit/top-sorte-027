-- Adicionar colunas de timeout na tabela de sorteios
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS selection_timeout INTEGER DEFAULT 5, -- Minutos para o amarelo (escolha)
ADD COLUMN IF NOT EXISTS payment_timeout INTEGER DEFAULT 15; -- Minutos para o checkout (pagamento)

-- Comentários para documentação
COMMENT ON COLUMN raffles.selection_timeout IS 'Tempo em minutos que um número fica reservado durante a escolha (amarelo)';
COMMENT ON COLUMN raffles.payment_timeout IS 'Tempo em minutos que o usuário tem para pagar após iniciar o checkout';

-- Atualizar o trigger para usar o valor dinâmico de selection_timeout (opcional, pois o app gerencia)
-- Mas para segurança do lado do servidor, vamos atualizar a função
CREATE OR REPLACE FUNCTION set_reservation_expiration()
RETURNS TRIGGER AS $$
DECLARE
    timeout_val INTEGER;
BEGIN
    SELECT selection_timeout INTO timeout_val FROM raffles WHERE id = NEW.raffle_id;
    IF timeout_val IS NULL THEN timeout_val := 5; END IF;
    
    NEW.expires_at := NOW() + (timeout_val || ' minutes')::interval;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
