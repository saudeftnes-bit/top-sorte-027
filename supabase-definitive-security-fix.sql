-- ============================================================================
-- TOP SORTE 027 — CORREÇÃO DEFINITIVA DE INTEGRIDADE, IDEMPOTÊNCIA E SEGURANÇA
-- Execute este script INTEIRO no Supabase SQL Editor.
-- ============================================================================

-- 1. Garantir colunas e tabela de auditoria de conflitos
ALTER TABLE efi_transactions ADD COLUMN IF NOT EXISTS numbers_json TEXT;

CREATE TABLE IF NOT EXISTS payment_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL,
    number TEXT NOT NULL,
    conflicting_txid TEXT NOT NULL,
    existing_txid TEXT,
    existing_buyer_name TEXT,
    conflicting_buyer_name TEXT,
    amount NUMERIC,
    resolved BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices de desempenho para evitar sobrecarga nas consultas em tempo real
CREATE INDEX IF NOT EXISTS idx_reservations_raffle_status_exp
    ON reservations (raffle_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_reservations_efi_txid
    ON reservations (efi_txid)
    WHERE efi_txid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_efi_transactions_txid
    ON efi_transactions (txid);

-- 3. Trigger de proteção absoluta de números PAGOS
--    Impede:
--      a) Alterar status 'paid' para qualquer outro status
--      b) Trocar o efi_txid de um número já pago por outro txid
--      c) Trocar o dono (buyer_name) de um número já pago
DROP TRIGGER IF EXISTS trg_prevent_overwrite_paid ON reservations;
DROP FUNCTION IF EXISTS prevent_overwrite_paid() CASCADE;

CREATE FUNCTION prevent_overwrite_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status = 'paid' THEN
        IF NEW.status <> 'paid' THEN
            RAISE EXCEPTION 'PROTEÇÃO: Número % (raffle %) já está pago e não pode voltar para status %.',
                OLD.number, OLD.raffle_id, NEW.status;
        END IF;

        IF OLD.efi_txid IS NOT NULL AND NEW.efi_txid IS DISTINCT FROM OLD.efi_txid THEN
            RAISE EXCEPTION 'PROTEÇÃO: Número % (raffle %) já pertence ao txid % e não pode ser transferido para %.',
                OLD.number, OLD.raffle_id, OLD.efi_txid, NEW.efi_txid;
        END IF;

        IF OLD.buyer_name IS NOT NULL AND OLD.buyer_name <> '' AND NEW.buyer_name IS DISTINCT FROM OLD.buyer_name THEN
            RAISE EXCEPTION 'PROTEÇÃO: Número % (raffle %) já pertence a % e não pode ser transferido para %.',
                OLD.number, OLD.raffle_id, OLD.buyer_name, NEW.buyer_name;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_overwrite_paid
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_overwrite_paid();

-- 4. Bloqueio atômico para geração de PIX (lock_numbers_for_pix)
--    Corrigido: agora também bloqueia seleções temporárias ATIVAS (efi_txid IS NULL)
--    de outras sessões, além de PIX ativos e números pagos.
DROP FUNCTION IF EXISTS lock_numbers_for_pix(uuid, text[], text, text, text, text, integer) CASCADE;

CREATE FUNCTION lock_numbers_for_pix(
    p_raffle_id       uuid,
    p_numbers         text[],
    p_buyer_name      text,
    p_buyer_phone     text,
    p_buyer_email     text,
    p_session_id      text,
    p_timeout_seconds integer DEFAULT 900
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_number     text;
    v_existing   reservations%ROWTYPE;
    v_blocked    text[] := ARRAY[]::text[];
    v_expires_at timestamptz;
BEGIN
    v_expires_at := NOW() + (p_timeout_seconds || ' seconds')::interval;

    -- Fase 1: Validar e travar todos os números solicitados
    FOREACH v_number IN ARRAY p_numbers LOOP
        SELECT * INTO v_existing
        FROM reservations
        WHERE raffle_id = p_raffle_id AND number = v_number
        FOR UPDATE SKIP LOCKED;

        IF NOT FOUND THEN
            PERFORM 1 FROM reservations
            WHERE raffle_id = p_raffle_id AND number = v_number;

            IF FOUND THEN
                -- Linha travada por outra transação concorrente
                v_blocked := array_append(v_blocked, v_number);
            END IF;
        ELSE
            IF v_existing.status = 'paid' THEN
                v_blocked := array_append(v_blocked, v_number);

            ELSIF v_existing.status = 'pending'
               AND v_existing.expires_at > NOW()
               AND v_existing.buyer_name <> COALESCE(NULLIF(p_session_id, ''), p_buyer_name)
               AND v_existing.buyer_name <> p_buyer_name THEN
                -- Bloqueado por outro usuário (seja com PIX ativo ou em seleção ativa na grade)
                v_blocked := array_append(v_blocked, v_number);
            END IF;
        END IF;
    END LOOP;

    IF array_length(v_blocked, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Um ou mais números não estão disponíveis.',
            'numbers', v_blocked
        );
    END IF;

    -- Fase 2: Reservar todos atomicamente para este comprador
    FOREACH v_number IN ARRAY p_numbers LOOP
        INSERT INTO reservations (
            raffle_id, number, buyer_name, buyer_phone, buyer_email,
            status, efi_txid, expires_at, created_at, updated_at
        ) VALUES (
            p_raffle_id, v_number, p_buyer_name, p_buyer_phone, p_buyer_email,
            'pending', NULL, v_expires_at, NOW(), NOW()
        )
        ON CONFLICT (raffle_id, number) DO UPDATE SET
            buyer_name  = EXCLUDED.buyer_name,
            buyer_phone = EXCLUDED.buyer_phone,
            buyer_email = EXCLUDED.buyer_email,
            status      = 'pending',
            efi_txid    = NULL,
            expires_at  = EXCLUDED.expires_at,
            updated_at  = NOW()
        WHERE reservations.status <> 'paid';
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Números reservados com sucesso.',
        'numbers', p_numbers,
        'expires_at', v_expires_at
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Erro interno ao reservar números: ' || SQLERRM,
            'numbers', p_numbers
        );
END;
$$;

-- 5. Função ÚNICA, ATÔMICA e IDEMPOTENTE de confirmação de pagamento EFI
--    Chamada por: api/efi-webhook, api/efi-status e api/pre-cleanup.
DROP FUNCTION IF EXISTS confirm_efi_payment(TEXT) CASCADE;
DROP FUNCTION IF EXISTS confirm_efi_payment(TEXT, TIMESTAMPTZ) CASCADE;

CREATE FUNCTION confirm_efi_payment(
    p_txid    TEXT,
    p_paid_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction      efi_transactions%ROWTYPE;
    v_numbers          TEXT[];
    v_number           TEXT;
    v_existing         reservations%ROWTYPE;
    v_updated_count    INTEGER := 0;
    v_already_paid_cnt INTEGER := 0;
    v_conflicts        TEXT[] := ARRAY[]::TEXT[];
    v_price_per_number NUMERIC := 0;
BEGIN
    -- Travar a linha da transação para evitar corrida entre webhook + polling + pre-cleanup
    SELECT * INTO v_transaction
    FROM efi_transactions
    WHERE txid = p_txid
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Fallback raro: transação sem registro em efi_transactions, tenta por efi_txid
        UPDATE reservations
        SET
            status     = 'paid',
            expires_at = NULL,
            updated_at = NOW()
        WHERE efi_txid = p_txid
          AND status <> 'paid';

        GET DIAGNOSTICS v_updated_count = ROW_COUNT;

        RETURN jsonb_build_object(
            'success', true,
            'idempotent', false,
            'updated', v_updated_count,
            'conflicts', '[]'::jsonb
        );
    END IF;

    -- Idempotência: se já está CONCLUIDA e já existem reservas pagas com este txid, retorna sem reprocessar
    SELECT COUNT(*) INTO v_already_paid_cnt
    FROM reservations
    WHERE efi_txid = p_txid
      AND status = 'paid';

    IF v_transaction.status = 'CONCLUIDA' AND v_already_paid_cnt > 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'updated', 0,
            'alreadyPaid', v_already_paid_cnt,
            'conflicts', '[]'::jsonb
        );
    END IF;

    -- Primeiro, confirmar reservas já vinculadas diretamente a este txid
    UPDATE reservations
    SET
        status     = 'paid',
        expires_at = NULL,
        updated_at = NOW()
    WHERE efi_txid = p_txid
      AND status <> 'paid';

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- Se houver numbers_json, validar/garantir cada número individualmente sem sobrescrever outro dono pago
    IF v_transaction.numbers_json IS NOT NULL AND v_transaction.numbers_json <> '' THEN
        BEGIN
            SELECT ARRAY(
                SELECT jsonb_array_elements_text(v_transaction.numbers_json::jsonb)
            ) INTO v_numbers;
        EXCEPTION WHEN OTHERS THEN
            v_numbers := NULL;
        END;

        IF v_numbers IS NOT NULL AND array_length(v_numbers, 1) > 0 THEN
            v_price_per_number := COALESCE(v_transaction.amount, 0) / array_length(v_numbers, 1);

            FOREACH v_number IN ARRAY v_numbers LOOP
                SELECT * INTO v_existing
                FROM reservations
                WHERE raffle_id = v_transaction.raffle_id
                  AND number    = v_number
                FOR UPDATE;

                IF NOT FOUND THEN
                    -- Número havia sido deletado pelo cleanup: recriar como PAID
                    INSERT INTO reservations (
                        raffle_id, number, buyer_name, buyer_phone, buyer_email,
                        status, payment_amount, payment_method, efi_txid, expires_at,
                        created_at, updated_at
                    ) VALUES (
                        v_transaction.raffle_id,
                        v_number,
                        COALESCE(v_transaction.buyer_name, ''),
                        COALESCE(v_transaction.buyer_phone, ''),
                        COALESCE(v_transaction.buyer_email, ''),
                        'paid',
                        v_price_per_number,
                        'efi',
                        p_txid,
                        NULL,
                        NOW(),
                        NOW()
                    );
                    v_updated_count := v_updated_count + 1;

                ELSIF v_existing.status = 'paid' THEN
                    IF v_existing.efi_txid IS DISTINCT FROM p_txid THEN
                        -- CONFLITO: Número já foi pago por OUTRO comprador/txid!
                        -- Preserva o dono original e registra auditoria.
                        v_conflicts := array_append(v_conflicts, v_number);

                        INSERT INTO payment_conflicts (
                            raffle_id, number, conflicting_txid, existing_txid,
                            existing_buyer_name, conflicting_buyer_name, amount, notes
                        ) VALUES (
                            v_transaction.raffle_id,
                            v_number,
                            p_txid,
                            v_existing.efi_txid,
                            v_existing.buyer_name,
                            v_transaction.buyer_name,
                            v_price_per_number,
                            'Pagamento recebido após número já pago por outro txid. Dono original preservado.'
                        );
                    END IF;
                ELSE
                    -- Reserva está pending ou cancelled: confirmar para este txid
                    UPDATE reservations
                    SET
                        status         = 'paid',
                        buyer_name     = COALESCE(NULLIF(v_transaction.buyer_name, ''), buyer_name),
                        buyer_phone    = COALESCE(NULLIF(v_transaction.buyer_phone, ''), buyer_phone),
                        buyer_email    = COALESCE(NULLIF(v_transaction.buyer_email, ''), buyer_email),
                        payment_amount = COALESCE(payment_amount, v_price_per_number),
                        payment_method = COALESCE(payment_method, 'efi'),
                        efi_txid       = p_txid,
                        expires_at     = NULL,
                        updated_at     = NOW()
                    WHERE id = v_existing.id;

                    v_updated_count := v_updated_count + 1;
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- Marcar transação como CONCLUIDA
    UPDATE efi_transactions
    SET
        status     = 'CONCLUIDA',
        paid_at    = COALESCE(p_paid_at, paid_at, NOW()),
        updated_at = NOW()
    WHERE txid = p_txid;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'updated', v_updated_count,
        'conflicts', to_jsonb(v_conflicts)
    );
END;
$$;

-- 6. Unificar update_efi_transaction_status para delegar para confirm_efi_payment
DROP FUNCTION IF EXISTS update_efi_transaction_status(text, text, text, jsonb) CASCADE;

CREATE FUNCTION update_efi_transaction_status(
    p_txid    text,
    p_status  text,
    p_paid_at text DEFAULT '',
    p_event   jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_paid_ts timestamptz := NULL;
BEGIN
    IF p_paid_at IS NOT NULL AND p_paid_at <> '' THEN
        v_paid_ts := p_paid_at::timestamptz;
    END IF;

    IF p_status = 'CONCLUIDA' THEN
        RETURN confirm_efi_payment(p_txid, v_paid_ts);
    END IF;

    UPDATE efi_transactions
    SET
        status     = p_status,
        paid_at    = COALESCE(v_paid_ts, paid_at),
        updated_at = NOW()
    WHERE txid = p_txid;

    RETURN jsonb_build_object('success', true, 'updated', 0);
END;
$$;

-- 7. Cleanup seguro (seleções sem PIX expiram na hora; PIX com 5 min de grace period)
DROP FUNCTION IF EXISTS expire_old_reservations();
CREATE FUNCTION expire_old_reservations()
RETURNS TABLE(expired_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_temp INTEGER := 0;
    v_deleted_pix  INTEGER := 0;
BEGIN
    -- 1. Seleções temporárias na grade (sem PIX): expiraram -> liberar imediatamente
    DELETE FROM reservations
    WHERE status = 'pending'
      AND efi_txid IS NULL
      AND expires_at IS NOT NULL
      AND expires_at < NOW();

    GET DIAGNOSTICS v_deleted_temp = ROW_COUNT;

    -- 2. Reservas com PIX gerado: aguardar grace period de 5 minutos após expirar
    DELETE FROM reservations
    WHERE status = 'pending'
      AND efi_txid IS NOT NULL
      AND expires_at IS NOT NULL
      AND expires_at < NOW() - INTERVAL '5 minutes';

    GET DIAGNOSTICS v_deleted_pix = ROW_COUNT;

    RETURN QUERY SELECT (v_deleted_temp + v_deleted_pix);
END;
$$;

DROP FUNCTION IF EXISTS delete_expired_reservations();
CREATE FUNCTION delete_expired_reservations()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY SELECT expired_count FROM expire_old_reservations();
END;
$$;
