-- ==============================================================================
-- CORREÇÃO DEFINITIVA: expire_old_reservations NÃO cancela reservas pagas
-- ==============================================================================
-- Problema identificado: 
--   expire_old_reservations() marcava como 'cancelled' reservas com efi_txid
--   onde a EFI já havia confirmado o pagamento (status=CONCLUIDA na tabela
--   efi_transactions), pois o webhook/polling ainda não havia atualizado
--   a tabela reservations, ou o expires_at estava NULL.
--
-- Solução:
--   Antes de cancelar, verificar se existe uma transação CONCLUIDA na EFI.
--   Se sim, confirmar o pagamento em vez de cancelar.
-- ==============================================================================

CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted   integer := 0;
    v_cancelled integer := 0;
    v_confirmed integer := 0;
    v_rec       RECORD;
BEGIN
    -- =========================================================================
    -- PASSO 0: PROTEÇÃO ANTI-CONFLITO
    -- Antes de cancelar qualquer reserva com efi_txid, verificar se a EFI já
    -- confirmou o pagamento. Se sim, confirmar o pagamento em vez de cancelar.
    -- =========================================================================
    FOR v_rec IN
        SELECT r.id, r.raffle_id, r.number, r.efi_txid, r.buyer_name,
               r.buyer_phone, r.buyer_email, t.paid_at
        FROM reservations r
        JOIN efi_transactions t ON t.txid = r.efi_txid
        WHERE r.status = 'pending'
          AND r.efi_txid IS NOT NULL
          AND t.status = 'CONCLUIDA'
          AND t.paid_at IS NOT NULL
    LOOP
        -- Esta reserva tem pagamento confirmado na EFI mas não foi marcada como paga
        -- Confirmar agora em vez de cancelar
        UPDATE reservations SET
            status      = 'paid',
            expires_at  = NULL,
            updated_at  = NOW()
        WHERE id = v_rec.id;

        v_confirmed := v_confirmed + 1;
    END LOOP;

    -- =========================================================================
    -- PASSO 1: Deletar seleções temporárias expiradas (sem PIX gerado)
    -- =========================================================================
    DELETE FROM reservations
    WHERE status = 'pending'
      AND efi_txid IS NULL
      AND (expires_at < NOW() OR expires_at IS NULL);

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- =========================================================================
    -- PASSO 2: Cancelar reservas com PIX cujo prazo venceu
    -- MAS NUNCA cancela se a transação EFI já foi paga (CONCLUIDA)
    -- =========================================================================
    UPDATE reservations SET
        status     = 'cancelled',
        updated_at = NOW()
    WHERE status = 'pending'
      AND efi_txid IS NOT NULL
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
      -- Proteção: só cancela se NÃO houver transação CONCLUIDA para este txid
      AND NOT EXISTS (
          SELECT 1 FROM efi_transactions t
          WHERE t.txid = reservations.efi_txid
            AND t.status = 'CONCLUIDA'
      );

    GET DIAGNOSTICS v_cancelled = ROW_COUNT;

    RETURN v_deleted + v_cancelled + v_confirmed;
END;
$$;

-- Alias de compatibilidade
CREATE OR REPLACE FUNCTION delete_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN expire_old_reservations();
END;
$$;

-- Notificar PostgREST para recarregar schema cache
NOTIFY pgrst, 'reload schema';

-- Teste imediato: executar a funcao para verificar reservas pendentes que
-- ja foram pagas na EFI mas ainda nao foram confirmadas no banco
SELECT expire_old_reservations() AS reservas_processadas;
