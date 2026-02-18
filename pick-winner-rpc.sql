-- 1. Adicionar colunas de ganhador na tabela raffles
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS winner_number TEXT;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS winner_name TEXT;

-- 2. Função RPC para escolher um ganhador aleatório entre os pagos
CREATE OR REPLACE FUNCTION pick_random_winner(raffle_id_param UUID)
RETURNS TABLE(
    number TEXT,
    buyer_name TEXT,
    buyer_phone TEXT
) AS $$
DECLARE
    selected_winner_record RECORD;
BEGIN
    -- Escolher uma reserva 'paid' aleatória
    SELECT r.number, r.buyer_name, r.buyer_phone 
    INTO selected_winner_record
    FROM reservations r
    WHERE r.raffle_id = raffle_id_param AND r.status = 'paid'
    ORDER BY random()
    LIMIT 1;

    -- Se não encontrar nenhum ganhador (ninguém pagou ainda), retornar vazio
    IF selected_winner_record IS NULL THEN
        RETURN;
    END IF;

    -- Atualizar a rifa com os dados do ganhador e marcar como finalizado
    UPDATE raffles 
    SET winner_number = selected_winner_record.number,
        winner_name = selected_winner_record.buyer_name,
        status = 'finished',
        updated_at = NOW()
    WHERE id = raffle_id_param;

    -- Retornar os dados do ganhador
    RETURN QUERY SELECT selected_winner_record.number, selected_winner_record.buyer_name, selected_winner_record.buyer_phone;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION pick_random_winner(UUID) IS 'Escolhe um ganhador aleatório entre as reservas pagas e finaliza o sorteio.';
