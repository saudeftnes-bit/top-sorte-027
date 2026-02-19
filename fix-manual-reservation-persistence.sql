-- 1. CORREÇÃO DO GATILHO DE EXPIRAÇÃO
-- Agora ele respeita valores manuais e desabilita expiração para Pagos
CREATE OR REPLACE FUNCTION public.set_reservation_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Se for PAGO, a expiração deve ser sempre NULL (nunca expira)
  IF NEW.status = 'paid' THEN
    NEW.expires_at := NULL;
    RETURN NEW;
  END IF;

  -- Se for PENDENTE e não foi enviada uma expiração (reserva manual envia 24h)
  -- Mantemos o padrão de 30 minutos apenas para fluxo normal de usuário
  IF NEW.expires_at IS NULL AND NEW.status = 'pending' THEN
    NEW.expires_at := NOW() + INTERVAL '30 minutes';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CORREÇÃO DA FUNÇÃO DE LIMPEZA (RPC)
-- Agora ela NUNCA toca em reservas pagas, independentemente de comprovante
DROP FUNCTION IF EXISTS public.expire_old_reservations();

CREATE OR REPLACE FUNCTION public.expire_old_reservations()
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  -- Cancela APENAS reservas PENDENTES que passaram do tempo
  UPDATE public.reservations
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN count;
END;
$$ LANGUAGE plpgsql;

-- 3. GARANTIR QUE RESERVAS PAGAS ATUAIS NÃO TENHAM EXPIRAÇÃO
UPDATE public.reservations 
SET expires_at = NULL 
WHERE status = 'paid';
