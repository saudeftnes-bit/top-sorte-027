-- ==================================================================================
-- PROTEÇÃO: Impedir que UPSERT sobrescreva reservas PAGAS
-- ==================================================================================
-- EXECUTE NO SQL EDITOR DO SUPABASE IMEDIATAMENTE.
--
-- O que faz:
--   Cria um trigger que BLOQUEIA qualquer UPDATE que tente mudar o status
--   de uma reserva 'paid' para qualquer outra coisa.
--   O UPSERT silenciosamente ignora a operação — a reserva paga fica intacta.
-- ==================================================================================

-- 1. Criar a função do trigger
CREATE OR REPLACE FUNCTION prevent_overwrite_paid()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a reserva ATUAL está paga, e a nova operação tenta mudar o status
    -- para algo diferente de 'paid', CANCELAR a operação silenciosamente.
    -- Isso impede que o UPSERT (seleção temporária, novo PIX, etc.)
    -- sobrescreva uma reserva que já foi paga.
    IF OLD.status = 'paid' AND NEW.status != 'paid' THEN
        -- Log para debug
        RAISE NOTICE '🔒 BLOQUEADO: tentativa de sobrescrever reserva PAGA do número % (comprador: %)', OLD.number, OLD.buyer_name;
        RETURN NULL; -- Cancela o UPDATE silenciosamente
    END IF;
    RETURN NEW; -- Permite outros UPDATEs normalmente
END;
$$ LANGUAGE plpgsql;

-- 2. Criar o trigger na tabela reservations
DROP TRIGGER IF EXISTS trg_prevent_overwrite_paid ON reservations;
CREATE TRIGGER trg_prevent_overwrite_paid
BEFORE UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION prevent_overwrite_paid();

-- 3. Verificação
SELECT tgname, tgtype, tgenabled
FROM pg_trigger
WHERE tgrelid = 'reservations'::regclass
AND tgname = 'trg_prevent_overwrite_paid';
