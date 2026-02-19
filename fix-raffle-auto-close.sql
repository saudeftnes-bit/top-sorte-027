-- 1. FUNÇÃO PARA VERIFICAR E ENCERRAR RIFA AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION public.check_and_finish_raffle()
RETURNS TRIGGER AS $$
DECLARE
    total_nums INTEGER;
    paid_nums INTEGER;
BEGIN
    -- Obter o total de números da rifa
    SELECT total_numbers INTO total_nums FROM public.raffles WHERE id = NEW.raffle_id;
    
    -- Contar quantos números estão pagos
    SELECT COUNT(*) INTO paid_nums FROM public.reservations 
    WHERE raffle_id = NEW.raffle_id AND status = 'paid';
    
    -- Se atingiu o total, marca como encerrada
    IF paid_nums >= total_nums THEN
        UPDATE public.raffles SET status = 'finished' WHERE id = NEW.raffle_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TRIGGER PARA EXECUTAR APÓS CADA ATUALIZAÇÃO DE RESERVA
DROP TRIGGER IF EXISTS tr_check_raffle_completion ON public.reservations;
CREATE TRIGGER tr_check_raffle_completion
AFTER UPDATE OF status ON public.reservations
FOR EACH ROW
WHEN (NEW.status = 'paid')
EXECUTE FUNCTION public.check_and_finish_raffle();

-- 3. CORREÇÃO DA FUNÇÃO DE EXPIRAÇÃO (Apenas para garantir segurança)
CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS TABLE(expired_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  -- Cancela apenas reservas que estão PENDENTES e expiradas
  UPDATE reservations
  SET status = 'cancelled'
  WHERE status = 'pending'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;
