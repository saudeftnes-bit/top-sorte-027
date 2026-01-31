-- ==================== ATUALIZAÇÃO DO SCHEMA ====================
-- Execute este SQL DEPOIS de executar o SQL inicial do GUIA_SUPABASE.md
-- Este script adiciona os recursos de Timer e Upload de Comprovante

-- 1. Adicionar campo de expiração nas reservas
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- 2. Criar bucket para comprovantes de pagamento
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de acesso ao storage
CREATE POLICY IF NOT EXISTS "Anyone can upload payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY IF NOT EXISTS "Anyone can view payment proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs');

-- 4. Função para calcular tempo de expiração (30 minutos)
CREATE OR REPLACE FUNCTION set_reservation_expiration()
RETURNS TRIGGER AS $$
BEGIN
  NEW.expires_at := NOW() + INTERVAL '30 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para setar expiração automaticamente
DROP TRIGGER IF EXISTS set_expiration_on_insert ON reservations;
CREATE TRIGGER set_expiration_on_insert
BEFORE INSERT ON reservations
FOR EACH ROW
EXECUTE FUNCTION set_reservation_expiration();

-- 6. Função para expirar reservas antigas (pode ser chamada via cron ou manualmente)
CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS TABLE(expired_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  -- Expira reservas que:
  -- 1. Ainda estão com status 'paid' (confirmadas mas sem comprovante)
  -- 2. Não tem comprovante de pagamento
  -- 3. Já passaram do tempo de expiração
  UPDATE reservations
  SET status = 'cancelled'
  WHERE status = 'paid'
    AND (payment_proof_url IS NULL OR payment_proof_url = '')
    AND expires_at < NOW();
  
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- 7. Comentários para documentação
COMMENT ON COLUMN reservations.expires_at IS 'Timestamp quando a reserva expira (30 min após criação)';
COMMENT ON COLUMN reservations.payment_proof_url IS 'URL do comprovante de pagamento no Supabase Storage';
COMMENT ON FUNCTION expire_old_reservations() IS 'Cancela reservas expiradas sem comprovante. Execute periodicamente.';

-- ==================== VERIFICAÇÃO ====================
-- Execute este SELECT para verificar se tudo foi criado:
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'reservations' 
  AND column_name IN ('expires_at', 'payment_proof_url');

-- Deve retornar 2 linhas mostrando os campos expires_at e payment_proof_url

-- ==================== USO ====================
-- Para expirar manualmente reservas antigas, execute:
-- SELECT expire_old_reservations();

-- Para ver reservas que vão expirar em breve:
-- SELECT * FROM reservations 
-- WHERE status = 'paid' 
--   AND payment_proof_url IS NULL 
--   AND expires_at > NOW() 
-- ORDER BY expires_at ASC;
