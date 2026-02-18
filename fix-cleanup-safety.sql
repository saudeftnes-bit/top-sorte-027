-- ==================== PROTEÇÃO EXTRA: NÃO CANCELAR RESERVAS EFI PAGAS ====================
-- Esta função impede que o cleanup cancele reservas pagas via automação (EFI)

CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS TABLE(expired_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  -- 1. Deletar reservas pending expiradas
  DELETE FROM reservations
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL;
  
  GET DIAGNOSTICS count = ROW_COUNT;
  
  -- 2. Cancelar reservas 'paid' MANUAIS (sem comprovante e sem EFI) que expiraram
  -- Reservas pagas via EFI (que têm efi_txid) são protegidas e nunca canceladas aqui
  UPDATE reservations
  SET status = 'cancelled'
  WHERE status = 'paid'
    AND efi_txid IS NULL -- Proteção: Não mexe em pagamentos automáticos EFI
    AND (payment_proof_url IS NULL OR payment_proof_url = '')
    AND expires_at < NOW()
    AND expires_at IS NOT NULL;
  
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_old_reservations() IS 'Limpa reservas expiradas de forma segura, protegendo pagamentos automáticos EFI.';
