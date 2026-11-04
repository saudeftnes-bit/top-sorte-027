-- ==================================================================================
-- CORREÇÃO DEFINITIVA – NÚMEROS PRESOS NA GRADE PREMIAMAX
-- Versão Oficial: Novembro/2026
-- Prioridade Máxima: Eliminação definitiva da causa raiz dos bloqueios de números.
-- ==================================================================================
-- INSTRUÇÕES:
-- Execute este script completo no SQL Editor do Supabase.
-- ==================================================================================

-- 1. ADICIONAR COLUNA session_id CASO NÃO EXISTA
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE reservations ADD COLUMN session_id text;
        RAISE NOTICE 'Coluna session_id adicionada com sucesso à tabela reservations.';
    END IF;
END $$;

-- 2. CRIAR ÍNDICES PARA ALTA PERFORMANCE E CONCORRÊNCIA
CREATE INDEX IF NOT EXISTS idx_reservations_raffle_number ON reservations(raffle_id, number);
CREATE INDEX IF NOT EXISTS idx_reservations_session_id ON reservations(session_id);
CREATE INDEX IF NOT EXISTS idx_reservations_cleanup ON reservations(status, expires_at);

-- 3. FUNÇÃO ATÔMICA PARA SELEÇÃO TEMPORÁRIA NA GRADE (reserve_number_atomic)
-- Chamada imediatamente quando o usuário toca num número livre.
CREATE OR REPLACE FUNCTION reserve_number_atomic(
    p_raffle_id       uuid,
    p_number          text,
    p_session_id      text,
    p_expires_minutes integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing   reservations%ROWTYPE;
    v_expires_at timestamptz;
BEGIN
    -- 1. Tenta lock exclusivo na linha existente (SELECT FOR UPDATE)
    SELECT * INTO v_existing
    FROM reservations
    WHERE raffle_id = p_raffle_id
      AND number    = p_number
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
        -- A) PAGO: Bloqueio permanente
        IF v_existing.status = 'paid' THEN
            RETURN jsonb_build_object(
                'success', false,
                'reason', 'paid',
                'message', 'Este número já foi adquirido e pago.'
            );
        END IF;

        -- B) PENDENTE: Verificar se ainda está válido e se pertence a OUTRO usuário
        IF v_existing.status = 'pending' THEN
            -- Se expirou ou está sem expiração, LIBERA IMEDIATAMENTE!
            IF v_existing.expires_at IS NOT NULL AND v_existing.expires_at > NOW() THEN
                -- Ainda dentro do prazo: verificar se é de outro comprador
                IF (v_existing.session_id IS NOT NULL AND v_existing.session_id <> p_session_id)
                   OR (v_existing.session_id IS NULL AND v_existing.buyer_name <> p_session_id) THEN
                    
                    IF v_existing.efi_txid IS NOT NULL THEN
                        RETURN jsonb_build_object(
                            'success', false,
                            'reason', 'pix_active',
                            'message', 'Este número está em processo de pagamento PIX por outro comprador.'
                        );
                    ELSE
                        RETURN jsonb_build_object(
                            'success', false,
                            'reason', 'reserved',
                            'message', 'Este número está temporariamente reservado por outro usuário.'
                        );
                    END IF;
                END IF;
            END IF;
        END IF;

        -- C) PODE SOBRESCREVER (expirado, cancelado, ou pertence à mesma sessão)
        v_expires_at := NOW() + (p_expires_minutes || ' minutes')::interval;

        UPDATE reservations SET
            session_id  = p_session_id,
            buyer_name  = p_session_id,
            buyer_email = 'temp_' || p_session_id || '@selecting.local',
            buyer_phone = '',
            status      = 'pending',
            efi_txid    = NULL,
            expires_at  = v_expires_at,
            updated_at  = NOW()
        WHERE raffle_id = p_raffle_id
          AND number    = p_number;

    ELSE
        -- 2. Linha não existe OU estava sob lock concorrente
        PERFORM 1 FROM reservations
        WHERE raffle_id = p_raffle_id AND number = p_number;

        IF FOUND THEN
            -- Estava locked por outra transação ativa no mesmo milissegundo
            RETURN jsonb_build_object(
                'success', false,
                'reason', 'concurrent',
                'message', 'Este número está sendo selecionado por outro participante neste exato instante.'
            );
        END IF;

        -- 3. Inserir nova reserva temporária
        v_expires_at := NOW() + (p_expires_minutes || ' minutes')::interval;

        INSERT INTO reservations (
            raffle_id, number, session_id, buyer_name, buyer_email, buyer_phone,
            status, efi_txid, expires_at, created_at, updated_at
        ) VALUES (
            p_raffle_id, p_number, p_session_id, p_session_id,
            'temp_' || p_session_id || '@selecting.local',
            '', 'pending', NULL, v_expires_at, NOW(), NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'reason', 'ok',
        'message', 'Número selecionado com sucesso.',
        'expires_at', v_expires_at
    );

EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'conflict',
            'message', 'Este número acabou de ser reservado.'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'error',
            'message', SQLERRM
        );
END;
$$;


-- 4. FUNÇÃO ATÔMICA DE BLOQUEIO PARA PIX (lock_numbers_for_pix)
-- Chamada pelo backend efi-charge antes de gerar a cobrança.
CREATE OR REPLACE FUNCTION lock_numbers_for_pix(
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
SECURITY DEFINER
AS $$
DECLARE
    v_number     text;
    v_existing   reservations%ROWTYPE;
    v_blocked    text[] := ARRAY[]::text[];
    v_expires_at timestamptz;
BEGIN
    v_expires_at := NOW() + (p_timeout_seconds || ' seconds')::interval;

    -- Fase 1: Validar disponibilidade de TODOS os números
    FOREACH v_number IN ARRAY p_numbers LOOP
        SELECT * INTO v_existing
        FROM reservations
        WHERE raffle_id = p_raffle_id AND number = v_number
        FOR UPDATE SKIP LOCKED;

        IF FOUND THEN
            -- Se for PAGO: indisponível
            IF v_existing.status = 'paid' THEN
                v_blocked := array_append(v_blocked, v_number);

            -- Se for PENDENTE válido com PIX ativo de OUTRO usuário: bloqueado
            ELSIF v_existing.status = 'pending'
               AND v_existing.efi_txid IS NOT NULL
               AND v_existing.expires_at IS NOT NULL
               AND v_existing.expires_at > NOW()
               AND (
                   (v_existing.session_id IS NOT NULL AND v_existing.session_id <> p_session_id)
                   OR (v_existing.session_id IS NULL AND v_existing.buyer_name <> p_buyer_name AND v_existing.buyer_name <> p_session_id)
               ) THEN
                v_blocked := array_append(v_blocked, v_number);
            END IF;
            -- Cancelados, expirados ou da mesma sessão: PERMITIDOS!
        END IF;
    END LOOP;

    -- Se algum número estiver bloqueado, falhar sem modificar nada
    IF array_length(v_blocked, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Um ou mais números selecionados não estão disponíveis.',
            'numbers', v_blocked
        );
    END IF;

    -- Fase 2: Reservar todos os números atomicamente
    FOREACH v_number IN ARRAY p_numbers LOOP
        INSERT INTO reservations (
            raffle_id, number, session_id, buyer_name, buyer_phone, buyer_email,
            status, efi_txid, expires_at, created_at, updated_at
        ) VALUES (
            p_raffle_id, v_number, p_session_id, p_buyer_name, p_buyer_phone, p_buyer_email,
            'pending', NULL, v_expires_at, NOW(), NOW()
        )
        ON CONFLICT (raffle_id, number) DO UPDATE SET
            session_id  = CASE WHEN reservations.status = 'paid' THEN reservations.session_id ELSE EXCLUDED.session_id END,
            buyer_name  = CASE WHEN reservations.status = 'paid' THEN reservations.buyer_name ELSE EXCLUDED.buyer_name END,
            buyer_phone = CASE WHEN reservations.status = 'paid' THEN reservations.buyer_phone ELSE EXCLUDED.buyer_phone END,
            buyer_email = CASE WHEN reservations.status = 'paid' THEN reservations.buyer_email ELSE EXCLUDED.buyer_email END,
            status      = CASE WHEN reservations.status = 'paid' THEN 'paid' ELSE 'pending' END,
            expires_at  = CASE WHEN reservations.status = 'paid' THEN reservations.expires_at ELSE EXCLUDED.expires_at END,
            updated_at  = NOW();
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Números bloqueados com sucesso para pagamento.',
        'numbers', p_numbers,
        'expires_at', v_expires_at
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Erro ao reservar números: ' || SQLERRM,
            'numbers', p_numbers
        );
END;
$$;


-- 5. FUNÇÃO PARA CANCELAMENTO E LIBERAÇÃO INSTANTÂNEA DE RESERVAS (cancel_reservation_atomic)
-- Chamada quando o usuário desiste no checkout, fecha o modal ou o timer expira.
CREATE OR REPLACE FUNCTION cancel_reservation_atomic(
    p_raffle_id  uuid,
    p_numbers    text[],
    p_session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted   integer := 0;
    v_cancelled integer := 0;
BEGIN
    -- 1. Deletar seleções sem PIX
    DELETE FROM reservations
    WHERE raffle_id = p_raffle_id
      AND number = ANY(p_numbers)
      AND status = 'pending'
      AND efi_txid IS NULL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- 2. Marcar como cancelled reservas com PIX não pagas
    UPDATE reservations SET
        status     = 'cancelled',
        updated_at = NOW()
    WHERE raffle_id = p_raffle_id
      AND number = ANY(p_numbers)
      AND status = 'pending';

    GET DIAGNOSTICS v_cancelled = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted', v_deleted,
        'cancelled', v_cancelled,
        'total', v_deleted + v_cancelled
    );
END;
$$;


-- 6. FUNÇÃO DE EXPIRAÇÃO AUTOMÁTICA EM BACKGROUND (expire_old_reservations)
-- Chamada pelo cron da Vercel e periodicamente pelo sistema.
-- ELIMINADA A MARGEM EXCESSIVA DE 10 MINUTOS que prendia números por 25 minutos.
CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted   integer := 0;
    v_cancelled integer := 0;
BEGIN
    -- 1. Deletar seleções temporárias na grade que já expiraram (sem PIX gerado)
    DELETE FROM reservations
    WHERE status = 'pending'
      AND efi_txid IS NULL
      AND (expires_at < NOW() OR expires_at IS NULL);

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- 2. Cancelar reservas com PIX cujo prazo de pagamento venceu
    -- Fica imediatamente DISPONÍVEL (verde) na grade para qualquer participante
    UPDATE reservations SET
        status     = 'cancelled',
        updated_at = NOW()
    WHERE status = 'pending'
      AND efi_txid IS NOT NULL
      AND (expires_at < NOW() OR expires_at IS NULL);

    GET DIAGNOSTICS v_cancelled = ROW_COUNT;

    RETURN v_deleted + v_cancelled;
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


-- 7. CONFIRMAÇÃO SEGURA DE PAGAMENTOS (confirm_payment_by_txid)
CREATE OR REPLACE FUNCTION confirm_payment_by_txid(
    p_txid      text,
    p_raffle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated integer := 0;
    v_txdata  record;
BEGIN
    SELECT raffle_id, buyer_name, buyer_phone, buyer_email, amount, numbers_json
    INTO v_txdata
    FROM efi_transactions
    WHERE txid = p_txid;

    IF NOT FOUND OR v_txdata.numbers_json IS NULL THEN
        UPDATE reservations SET
            status     = 'paid',
            expires_at = NULL,
            updated_at = NOW()
        WHERE efi_txid = p_txid
          AND status <> 'paid';

        GET DIAGNOSTICS v_updated = ROW_COUNT;

        RETURN jsonb_build_object('success', true, 'method', 'by_txid_fallback', 'updated', v_updated);
    END IF;

    -- Atualizar cada número individualmente garantindo txid correto
    UPDATE reservations SET
        status      = 'paid',
        buyer_name  = v_txdata.buyer_name,
        buyer_phone = v_txdata.buyer_phone,
        buyer_email = v_txdata.buyer_email,
        efi_txid    = p_txid,
        expires_at  = NULL,
        updated_at  = NOW()
    WHERE raffle_id = v_txdata.raffle_id
      AND number = ANY(
            SELECT jsonb_array_elements_text(v_txdata.numbers_json::jsonb)
          )
      AND (
            efi_txid = p_txid
            OR (status = 'pending' AND efi_txid IS NULL)
            OR status = 'cancelled'
          )
      AND status <> 'paid';

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    -- Se não existia linha (ex: havia sido deletada pelo cleanup), recriar como PAGO
    IF v_updated = 0 THEN
        INSERT INTO reservations (
            raffle_id, number, buyer_name, buyer_phone, buyer_email,
            status, efi_txid, expires_at, created_at, updated_at
        )
        SELECT
            v_txdata.raffle_id,
            n.value::text,
            v_txdata.buyer_name,
            v_txdata.buyer_phone,
            v_txdata.buyer_email,
            'paid',
            p_txid,
            NULL,
            NOW(),
            NOW()
        FROM jsonb_array_elements_text(v_txdata.numbers_json::jsonb) AS n(value)
        ON CONFLICT (raffle_id, number) DO UPDATE SET
            status      = 'paid',
            buyer_name  = CASE WHEN reservations.status = 'paid' AND reservations.efi_txid <> p_txid
                               THEN reservations.buyer_name
                               ELSE EXCLUDED.buyer_name END,
            efi_txid    = CASE WHEN reservations.status = 'paid' AND reservations.efi_txid <> p_txid
                               THEN reservations.efi_txid
                               ELSE p_txid END,
            expires_at  = NULL,
            updated_at  = NOW();

        GET DIAGNOSTICS v_updated = ROW_COUNT;
    END IF;

    UPDATE efi_transactions SET
        status     = 'CONCLUIDA',
        updated_at = NOW()
    WHERE txid = p_txid;

    RETURN jsonb_build_object('success', true, 'method', 'by_numbers_json', 'updated', v_updated);

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM, 'updated', 0);
END;
$$;


-- 8. TRIGGER DE PROTEÇÃO ABSOLUTA DE NÚMEROS PAGOS
CREATE OR REPLACE FUNCTION prevent_overwrite_paid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
        RAISE EXCEPTION 'PROTEÇÃO MÁXIMA: O número % já está pago e confirmado. Operação abortada.', OLD.number;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_overwrite_paid ON reservations;
CREATE TRIGGER trg_prevent_overwrite_paid
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_overwrite_paid();

-- 9. EXECUÇÃO IMEDIATA DA ROTINA DE LIMPEZA
SELECT expire_old_reservations() AS reservas_expiradas_liberadas_agora;
