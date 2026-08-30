-- ==================================================================================
-- CORREÇÃO DEFINITIVA: CONFIRMAÇÃO AUTOMÁTICA DE PAGAMENTOS E TIMER
-- ==================================================================================
-- Execute este script no SQL Editor do Supabase para resolver definitivamente:
-- 1. Remoção do trigger que bloqueava pagamentos automáticos com erro TXID_MISMATCH
-- 2. Remoção do trigger que forçava 30 minutos em todas as seleções
-- 3. Liberação imediata de números abandonados (SECURITY DEFINER)
-- ==================================================================================

-- 1. REMOVER O TRIGGER QUE BLOQUEAVA O WEBHOOK AUTOMÁTICO (TXID_MISMATCH)
-- (Este trigger impedia que novos compradores dos últimos números fossem marcados como pagos automaticamente)
DROP TRIGGER IF EXISTS trg_prevent_wrong_txid_payment ON reservations;
DROP FUNCTION IF EXISTS prevent_wrong_txid_payment();

-- 2. REMOVER O TRIGGER QUE FORÇAVA 30 MINUTOS
DROP TRIGGER IF EXISTS set_expiration_on_insert ON reservations;
DROP FUNCTION IF EXISTS set_reservation_expiration();

-- 3. ATUALIZAR FUNÇÃO DE EXPIRAÇÃO COM PERMISSÃO DE ADMIN (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS TABLE(expired_count INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  del_count INTEGER := 0;
  cancel_count INTEGER := 0;
BEGIN
  -- Deleta seleções temporárias na grade que já venceram (sem PIX gerado)
  DELETE FROM reservations
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL
    AND efi_txid IS NULL;

  GET DIAGNOSTICS del_count = ROW_COUNT;

  -- Marca como 'cancelled' reservas com PIX que passaram do tempo de tolerância
  -- (Ao marcar como 'cancelled', o número fica imediatamente LIVRE e VERDE na tela)
  UPDATE reservations
  SET status = 'cancelled', updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL
    AND efi_txid IS NOT NULL;

  GET DIAGNOSTICS cancel_count = ROW_COUNT;

  RETURN QUERY SELECT del_count + cancel_count;
END;
$$;

-- 4. FUNÇÃO SIMPLIFICADA DE LIMPEZA
CREATE OR REPLACE FUNCTION delete_expired_reservations()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM expire_old_reservations();
END;
$$;

-- 5. EXECUTAR LIMPEZA AGORA
SELECT * FROM expire_old_reservations();
