-- ==================== FUNÇÃO PARA ZERAR TODOS OS NÚMEROS DE UM SORTEIO ====================
-- Esta função deleta todas as reservas de um sorteio específico
-- Útil para resetar um sorteio e começar novo concurso

CREATE OR REPLACE FUNCTION reset_raffle_numbers(raffle_id_param UUID)
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  -- Deletar todas as reservas do sorteio
  DELETE FROM reservations
  WHERE raffle_id = raffle_id_param;
  
  GET DIAGNOSTICS count = ROW_COUNT;
  
  -- Log para debug
  RAISE NOTICE 'Deletadas % reservas do sorteio %', count, raffle_id_param;
  
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- Comentário
COMMENT ON FUNCTION reset_raffle_numbers(UUID) IS 'Deleta todas as reservas de um sorteio específico. Use para resetar números.';

-- ==================== TESTE ====================
-- Para testar (substitua o UUID pelo ID do seu sorteio):
-- SELECT reset_raffle_numbers('seu-raffle-id-aqui');
