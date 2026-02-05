-- ==================== CORREÇÃO: LIMPEZA AUTOMÁTICA DE RESERVAS EXPIRADAS ====================
-- Este script corrige o problema de números ficarem amarelos após expirar
-- Cria função para DELETAR (não apenas cancelar) reservas expiradas

-- ==================== 1. FUNÇÃO PARA DELETAR RESERVAS EXPIRADAS ====================

-- Esta função deleta reservas que:
-- 1. Têm status 'pending' (aguardando pagamento)
-- 2. Já passaram do tempo de expiração
CREATE OR REPLACE FUNCTION delete_expired_reservations()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  -- Deletar reservas pending que expiraram
  DELETE FROM reservations
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL;
  
  GET DIAGNOSTICS count = ROW_COUNT;
  
  -- Log para debug
  RAISE NOTICE 'Deletadas % reservas expiradas', count;
  
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- ==================== 2. ATUALIZAR FUNÇÃO ANTIGA ====================

-- Atualizar função antiga para também checar 'pending'
CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS TABLE(expired_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  -- Deletar reservas pending expiradas
  DELETE FROM reservations
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL;
  
  GET DIAGNOSTICS count = ROW_COUNT;
  
  -- Também cancelar reservas 'paid' sem comprovante
  UPDATE reservations
  SET status = 'cancelled'
  WHERE status = 'paid'
    AND (payment_proof_url IS NULL OR payment_proof_url = '')
    AND expires_at < NOW()
    AND expires_at IS NOT NULL;
  
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- ==================== 3. COMENTÁRIOS ====================

COMMENT ON FUNCTION delete_expired_reservations() IS 'Deleta reservas pending expiradas automaticamente. Chamado pelo frontend.';
COMMENT ON FUNCTION expire_old_reservations() IS 'Limpa reservas expiradas (deleta pending, cancela paid sem comprovante).';

-- ==================== 4. TESTES ====================

-- Ver quantas reservas expiradas existem agora
SELECT 
    status,
    COUNT(*) as total,
    MIN(expires_at) as primeira_expiracao,
    MAX(expires_at) as ultima_expiracao
FROM reservations
WHERE expires_at < NOW()
GROUP BY status;

-- Executar limpeza manual (testar)
SELECT delete_expired_reservations();

-- Verificar resultado
SELECT 
    status,
    COUNT(*) as total
FROM reservations
GROUP BY status;

-- ==================== NOTA IMPORTANTE ====================
-- 
-- Esta função será chamada automaticamente pelo frontend
-- toda vez que carregar os dados da página.
-- 
-- Alternativamente, pode configurar um cron job no Supabase
-- (apenas em planos pagos) para executar a cada minuto:
-- 
-- SELECT cron.schedule(
--   'delete-expired-reservations',
--   '* * * * *',  -- A cada minuto
--   $$ SELECT delete_expired_reservations(); $$
-- );
-- 
-- ====================
