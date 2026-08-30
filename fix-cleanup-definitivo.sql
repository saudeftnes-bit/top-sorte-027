-- ==================================================================================
-- CORREÇÃO DEFINITIVA: Pagamentos Perdidos
-- ==================================================================================
-- EXECUTE ESTE SCRIPT NO SQL EDITOR DO SUPABASE ANTES DE FAZER O DEPLOY.
--
-- O que faz:
--   1. Adiciona coluna numbers_json na efi_transactions (para recovery de pagamentos)
--   2. Corrige o cleanup para NUNCA deletar reservas que tenham PIX gerado
--   3. Adiciona função de limpeza de reservas cancelled antigas (>48h)
-- ==================================================================================


-- ══════════════════════════════════════════════════════════════════════════════════
-- 1. ADICIONAR COLUNA numbers_json À TABELA efi_transactions
-- Armazena os números da compra para o webhook poder recuperar pagamentos perdidos.
-- ══════════════════════════════════════════════════════════════════════════════════
ALTER TABLE efi_transactions ADD COLUMN IF NOT EXISTS numbers_json TEXT;

COMMENT ON COLUMN efi_transactions.numbers_json IS
    'JSON array dos números comprados (ex: ["01","05","42"]). Usado pelo webhook para recovery de pagamentos perdidos.';


-- ══════════════════════════════════════════════════════════════════════════════════
-- 2. CORRIGIR delete_expired_reservations()
--
-- ANTES (BUG): Apagava TODAS as reservas pending expiradas, inclusive as com PIX
-- ativo. Quando o webhook chegava depois, não encontrava nada para marcar como pago.
--
-- DEPOIS (CORREÇÃO): Só APAGA reservas temporárias SEM PIX (seleções abandonadas).
-- Reservas COM PIX expirado são MARCADAS como 'cancelled' (mantidas no banco para
-- o webhook poder encontrar e confirmar o pagamento).
-- ══════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION delete_expired_reservations()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  del_count INTEGER;
  cancel_count INTEGER;
BEGIN
  -- 1. Deletar apenas reservas temporárias SEM PIX que expiraram (seleções abandonadas)
  DELETE FROM reservations
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL
    AND efi_txid IS NULL;           -- ← SEM PIX = pode apagar com segurança

  GET DIAGNOSTICS del_count = ROW_COUNT;

  -- 2. Reservas COM PIX expirado → marcar como 'cancelled' (NÃO deletar!)
  -- O webhook ainda pode chegar e confirmar o pagamento.
  UPDATE reservations
  SET status = 'cancelled', updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL
    AND efi_txid IS NOT NULL;       -- ← COM PIX = manter para recovery

  GET DIAGNOSTICS cancel_count = ROW_COUNT;

  IF cancel_count > 0 THEN
    RAISE NOTICE '⚠️ Canceladas % reservas PIX expiradas (mantidas para recovery do webhook)', cancel_count;
  END IF;

  RAISE NOTICE '🗑️ Deletadas % reservas temporárias expiradas (sem PIX)', del_count;

  RETURN QUERY SELECT del_count + cancel_count;
END;
$$ LANGUAGE plpgsql;


-- ══════════════════════════════════════════════════════════════════════════════════
-- 3. CORRIGIR expire_old_reservations() (mesma lógica)
-- ══════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS TABLE(expired_count INTEGER) AS $$
DECLARE
  del_count INTEGER;
  cancel_count INTEGER;
BEGIN
  -- 1. Deletar reservas temporárias SEM PIX
  DELETE FROM reservations
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL
    AND efi_txid IS NULL;

  GET DIAGNOSTICS del_count = ROW_COUNT;

  -- 2. Marcar como cancelled reservas COM PIX expirado (NÃO deletar!)
  UPDATE reservations
  SET status = 'cancelled', updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL
    AND efi_txid IS NOT NULL;

  GET DIAGNOSTICS cancel_count = ROW_COUNT;

  RETURN QUERY SELECT del_count + cancel_count;
END;
$$ LANGUAGE plpgsql;


-- ══════════════════════════════════════════════════════════════════════════════════
-- 4. LIMPEZA DE RESERVAS CANCELLED ANTIGAS (>48h)
-- Para não acumular lixo no banco. Depois de 48h, o pagamento é antigo demais.
-- ══════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION cleanup_old_cancelled_reservations()
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  DELETE FROM reservations
  WHERE status = 'cancelled'
    AND updated_at < NOW() - INTERVAL '48 hours';

  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_cancelled_reservations IS
    'Remove reservas cancelled com mais de 48h. Seguro de executar a qualquer momento.';


-- ══════════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO: Confirmar que as funções foram atualizadas
-- ══════════════════════════════════════════════════════════════════════════════════
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
    'delete_expired_reservations',
    'expire_old_reservations',
    'cleanup_old_cancelled_reservations'
)
AND routine_schema = 'public';
