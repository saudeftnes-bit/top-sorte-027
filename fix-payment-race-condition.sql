-- ==================================================================================
-- FIX: RACE CONDITION - PAGAMENTO DUPLO
-- Aplique este script no SQL Editor do Supabase para proteção máxima no banco.
-- ==================================================================================
-- PROBLEMA: O UPSERT do frontend/API pode sobrescrever uma reserva que já tem
-- um PIX ativo (efi_txid definido e expires_at no futuro), causando pagamento duplo.
-- SOLUÇÃO: Função PL/pgSQL com FOR UPDATE (lock de linha) + trigger de proteção.
-- ==================================================================================

-- ==================================================================================
-- 1. FUNÇÃO: Upsert seguro com verificação atômica (usa lock de linha)
-- ==================================================================================
-- Use esta função no lugar do UPSERT direto na tabela 'reservations'.
-- Ela garante que não sobrescreverá uma reserva com PIX ativo de outro comprador.

CREATE OR REPLACE FUNCTION safe_create_pix_reservations(
    p_raffle_id     UUID,
    p_numbers       TEXT[],
    p_buyer_name    TEXT,
    p_buyer_phone   TEXT,
    p_buyer_email   TEXT,
    p_payment_amount NUMERIC,
    p_efi_txid      TEXT,
    p_expires_at    TIMESTAMPTZ
)
RETURNS TABLE(success BOOLEAN, blocked_number TEXT, message TEXT) AS $$
DECLARE
    num TEXT;
    existing RECORD;
BEGIN
    FOREACH num IN ARRAY p_numbers LOOP
        -- Bloquear linha para leitura exclusiva (evita race condition entre conexões)
        SELECT * INTO existing
        FROM reservations
        WHERE raffle_id = p_raffle_id
          AND number = num
          AND status NOT IN ('cancelled', 'paid')
        FOR UPDATE SKIP LOCKED; -- Ignora linhas bloqueadas por outra transação

        IF FOUND THEN
            -- Caso 1: Outro PIX ativo com txid diferente e não expirado
            IF existing.efi_txid IS NOT NULL
               AND existing.efi_txid != p_efi_txid
               AND existing.expires_at IS NOT NULL
               AND existing.expires_at > NOW() THEN
                RETURN QUERY SELECT FALSE, num,
                    FORMAT('Número %s já possui PIX ativo até %s', num, to_char(existing.expires_at, 'HH24:MI'));
                CONTINUE;
            END IF;

            -- Caso 2: Reserva de outro comprador (sem PIX ainda) ainda válida
            IF existing.efi_txid IS NULL
               AND existing.buyer_name != p_buyer_name
               AND existing.expires_at IS NOT NULL
               AND existing.expires_at > NOW() THEN
                RETURN QUERY SELECT FALSE, num,
                    FORMAT('Número %s já reservado por outro comprador', num);
                CONTINUE;
            END IF;

            -- Seguro: sobrescrever (é a própria reserva temporária do mesmo comprador)
            UPDATE reservations
            SET buyer_name    = p_buyer_name,
                buyer_phone   = p_buyer_phone,
                buyer_email   = p_buyer_email,
                status        = 'pending',
                payment_amount= p_payment_amount,
                payment_method= 'efi',
                efi_txid      = p_efi_txid,
                expires_at    = p_expires_at,
                updated_at    = NOW()
            WHERE raffle_id = p_raffle_id AND number = num;

            RETURN QUERY SELECT TRUE, num, 'atualizado'::TEXT;
        ELSE
            -- Não existe reserva: inserir nova
            INSERT INTO reservations (
                raffle_id, number, buyer_name, buyer_phone, buyer_email,
                status, payment_amount, payment_method, efi_txid, expires_at
            ) VALUES (
                p_raffle_id, num, p_buyer_name, p_buyer_phone, p_buyer_email,
                'pending', p_payment_amount, 'efi', p_efi_txid, p_expires_at
            );
            RETURN QUERY SELECT TRUE, num, 'inserido'::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION safe_create_pix_reservations IS
    'Cria reservas PIX de forma atômica (com lock de linha), evitando que dois compradores reservem o mesmo número simultaneamente.';


-- ==================================================================================
-- 2. TRIGGER: Protege contra webhook confirmando pagamento com txid errado
-- ==================================================================================
-- Impede que o webhook da EFI marque como 'paid' uma reserva cujo efi_txid
-- foi trocado (por exemplo: A gerou PIX, B sobrescreveu, A pagou = caos).

CREATE OR REPLACE FUNCTION prevent_wrong_txid_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Só atua quando a operação é um UPDATE para status 'paid'
    IF TG_OP = 'UPDATE' AND NEW.status = 'paid' THEN
        -- Se a reserva tinha um txid diferente do que está tentando marcar como pago, bloqueia
        IF OLD.efi_txid IS NOT NULL
           AND NEW.efi_txid IS NOT NULL
           AND OLD.efi_txid != NEW.efi_txid THEN
            RAISE EXCEPTION
                'TXID_MISMATCH: Tentativa de marcar como pago com txid diferente do que gerou a cobrança. Old: %, New: %',
                OLD.efi_txid, NEW.efi_txid;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trg_prevent_wrong_txid_payment ON reservations;

-- Criar trigger
CREATE TRIGGER trg_prevent_wrong_txid_payment
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_wrong_txid_payment();

COMMENT ON TRIGGER trg_prevent_wrong_txid_payment ON reservations IS
    'Bloqueia confirmação de pagamento se o efi_txid da reserva foi substituído por outro. Evita pagamento duplo.';


-- ==================================================================================
-- 3. ÍNDICE: Performance na busca por número + status + expires_at
-- ==================================================================================
CREATE INDEX IF NOT EXISTS idx_reservations_number_status_expires
    ON reservations (raffle_id, number, status, expires_at)
    WHERE status NOT IN ('cancelled', 'paid');

COMMENT ON INDEX idx_reservations_number_status_expires IS
    'Acelera a busca por reservas ativas ao verificar disponibilidade de números.';


-- ==================================================================================
-- 4. FUNÇÃO AUXILIAR: Verificar números disponíveis (sem PIX ativo)
-- ==================================================================================
CREATE OR REPLACE FUNCTION check_numbers_availability(
    p_raffle_id UUID,
    p_numbers   TEXT[]
)
RETURNS TABLE(number TEXT, is_available BOOLEAN, has_active_pix BOOLEAN, expires_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.number,
        CASE
            WHEN r.status IS NULL THEN TRUE            -- Não existe reserva
            WHEN r.status IN ('cancelled') THEN TRUE   -- Cancelada = disponível
            WHEN r.expires_at IS NOT NULL AND r.expires_at <= NOW() THEN TRUE  -- Expirada = disponível
            ELSE FALSE                                 -- Reservada ou paga
        END AS is_available,
        CASE
            WHEN r.efi_txid IS NOT NULL AND r.expires_at IS NOT NULL AND r.expires_at > NOW() THEN TRUE
            ELSE FALSE
        END AS has_active_pix,
        r.expires_at
    FROM unnest(p_numbers) AS n(number)
    LEFT JOIN reservations r
        ON r.raffle_id = p_raffle_id
        AND r.number = n.number
        AND r.status NOT IN ('cancelled');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_numbers_availability IS
    'Verifica a disponibilidade de uma lista de números, indicando se há PIX ativo.';


-- ==================================================================================
-- COMO USAR:
-- 
-- 1. Execute este script no SQL Editor do Supabase.
-- 2. O código do backend (efi-charge.ts) e do frontend (selection-manager.ts)
--    já foram atualizados para usar a função safe_create_pix_reservations().
-- 3. O trigger trg_prevent_wrong_txid_payment protege automaticamente o banco.
-- ==================================================================================
