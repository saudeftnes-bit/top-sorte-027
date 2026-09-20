-- ============================================================
-- CORREÇÃO DEFINITIVA — RACE CONDITION NO SISTEMA DE RESERVAS
-- Criado em: 20/09/2026
-- Substitui TODOS os scripts SQL anteriores relacionados a reservas.
-- Execute este arquivo INTEIRO no Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- PARTE 1: LIMPAR FUNÇÕES E TRIGGERS ANTIGOS (CONFLITANTES)
-- ============================================================
DROP TRIGGER IF EXISTS trg_prevent_overwrite_paid ON reservations;
DROP TRIGGER IF EXISTS trg_prevent_wrong_txid_payment ON reservations;
DROP TRIGGER IF EXISTS trg_prevent_duplicate_pix ON reservations;
DROP TRIGGER IF EXISTS set_expiration_on_insert ON reservations;

DROP FUNCTION IF EXISTS prevent_overwrite_paid() CASCADE;
DROP FUNCTION IF EXISTS prevent_wrong_txid_payment() CASCADE;
DROP FUNCTION IF EXISTS prevent_duplicate_pix() CASCADE;
DROP FUNCTION IF EXISTS set_reservation_expiration() CASCADE;
DROP FUNCTION IF EXISTS lock_numbers_for_pix(text, text[], text, text, text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS lock_numbers_for_pix(uuid, text[], text, text, text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS reserve_number_atomic(text, text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS reserve_number_atomic(uuid, text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS confirm_payment_by_txid(text, text) CASCADE;
DROP FUNCTION IF EXISTS confirm_payment_by_txid(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS expire_old_reservations() CASCADE;
DROP FUNCTION IF EXISTS delete_expired_reservations() CASCADE;
DROP FUNCTION IF EXISTS safe_create_pix_reservations(uuid, text[], text, text, text, text, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS check_numbers_availability(uuid, text[]) CASCADE;
DROP FUNCTION IF EXISTS save_transaction_numbers(text, text) CASCADE;
DROP FUNCTION IF EXISTS update_efi_transaction_status(text, text, text, jsonb) CASCADE;


-- ============================================================
-- PARTE 2: FUNÇÃO ATÔMICA PARA SELEÇÃO TEMPORÁRIA
-- Chamada quando usuário clica no número na grade.
-- Usa SELECT FOR UPDATE para evitar race condition.
-- ============================================================
CREATE OR REPLACE FUNCTION reserve_number_atomic(
    p_raffle_id uuid,
    p_number    text,
    p_session_id text,
    p_expires_minutes integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing reservations%ROWTYPE;
    v_expires_at timestamptz;
BEGIN
    -- Tenta adquirir lock na linha existente (SELECT FOR UPDATE)
    -- Isso bloqueia outras transações concorrentes que tentam o mesmo número
    SELECT * INTO v_existing
    FROM reservations
    WHERE raffle_id = p_raffle_id
      AND number    = p_number
    FOR UPDATE SKIP LOCKED;  -- SKIP LOCKED: se outra transação já travou, retorna vazio imediatamente

    -- Se outra transação está processando este número agora, rejeita
    -- (SKIP LOCKED retorna sem resultado quando o row está locked)
    -- Nota: se não existia linha, v_existing fica NULL — isso é OK, criamos abaixo

    IF FOUND THEN
        -- Linha existe — verificar se pode ser sobrescrita
        IF v_existing.status = 'paid' THEN
            RETURN jsonb_build_object(
                'success', false,
                'reason', 'paid',
                'message', 'Este número já foi pago por outro comprador.'
            );
        END IF;

        IF v_existing.status = 'pending'
           AND v_existing.efi_txid IS NOT NULL
           AND v_existing.expires_at > NOW()
           AND v_existing.buyer_name <> p_session_id THEN
            RETURN jsonb_build_object(
                'success', false,
                'reason', 'pix_active',
                'message', 'Este número está sendo pago por outro comprador (PIX ativo).'
            );
        END IF;

        IF v_existing.status = 'pending'
           AND v_existing.efi_txid IS NULL
           AND v_existing.expires_at > NOW()
           AND v_existing.buyer_name <> p_session_id THEN
            RETURN jsonb_build_object(
                'success', false,
                'reason', 'reserved',
                'message', 'Este número está reservado por outro usuário.'
            );
        END IF;

        -- Pode sobrescrever (expirado, cancelado, ou é do próprio usuário)
        v_expires_at := NOW() + (p_expires_minutes || ' minutes')::interval;

        UPDATE reservations SET
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
        -- Linha não existe OU estava locked por outra transação
        -- Verifica novamente sem FOR UPDATE para distinguir os casos
        PERFORM 1 FROM reservations
        WHERE raffle_id = p_raffle_id AND number = p_number;

        IF FOUND THEN
            -- Estava locked por outra transação concorrente — rejeita
            RETURN jsonb_build_object(
                'success', false,
                'reason', 'concurrent',
                'message', 'Este número está sendo processado por outro usuário. Tente novamente em instantes.'
            );
        END IF;

        -- Linha não existe — INSERT novo
        v_expires_at := NOW() + (p_expires_minutes || ' minutes')::interval;

        INSERT INTO reservations (
            raffle_id, number, buyer_name, buyer_email, buyer_phone,
            status, efi_txid, expires_at, created_at, updated_at
        ) VALUES (
            p_raffle_id, p_number, p_session_id,
            'temp_' || p_session_id || '@selecting.local',
            '', 'pending', NULL, v_expires_at, NOW(), NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'reason', 'ok',
        'message', 'Número reservado com sucesso.',
        'expires_at', v_expires_at
    );

EXCEPTION
    WHEN unique_violation THEN
        -- Conflito de UNIQUE — outro usuário inseriu no mesmo instante
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'conflict',
            'message', 'Este número acabou de ser reservado por outro usuário.'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'error',
            'message', SQLERRM
        );
END;
$$;


-- ============================================================
-- PARTE 3: FUNÇÃO ATÔMICA PARA GERAR PIX (lock_numbers_for_pix)
-- Chamada pelo efi-charge.ts ANTES de criar a cobrança na EFI.
-- Garante que todos os números estão disponíveis E os reserva
-- atomicamente. Se QUALQUER número falhar, NENHUM é reservado.
-- ============================================================
CREATE OR REPLACE FUNCTION lock_numbers_for_pix(
    p_raffle_id      uuid,
    p_numbers        text[],
    p_buyer_name     text,
    p_buyer_phone    text,
    p_buyer_email    text,
    p_session_id     text,
    p_timeout_seconds integer DEFAULT 900
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_number        text;
    v_existing      reservations%ROWTYPE;
    v_blocked       text[] := ARRAY[]::text[];
    v_expires_at    timestamptz;
BEGIN
    v_expires_at := NOW() + (p_timeout_seconds || ' seconds')::interval;

    -- Fase 1: Verificar e travar TODOS os números (ou falhar sem modificar nada)
    FOREACH v_number IN ARRAY p_numbers LOOP

        -- Tenta adquirir lock exclusivo na linha
        SELECT * INTO v_existing
        FROM reservations
        WHERE raffle_id = p_raffle_id AND number = v_number
        FOR UPDATE SKIP LOCKED;

        IF NOT FOUND THEN
            -- Linha não existe OU está locked por outra transação
            PERFORM 1 FROM reservations
            WHERE raffle_id = p_raffle_id AND number = v_number;

            IF FOUND THEN
                -- Estava locked — número em uso por outro
                v_blocked := array_append(v_blocked, v_number);
            END IF;
            -- Se não existe, ok — vai ser criado na fase 2
        ELSE
            -- Linha existe — verificar disponibilidade
            IF v_existing.status = 'paid' THEN
                v_blocked := array_append(v_blocked, v_number);

            ELSIF v_existing.status = 'pending'
               AND v_existing.efi_txid IS NOT NULL
               AND v_existing.expires_at > NOW()
               AND v_existing.buyer_name <> p_session_id THEN
                -- PIX ativo de outro comprador
                v_blocked := array_append(v_blocked, v_number);
            END IF;
        END IF;

    END LOOP;

    -- Se qualquer número estiver bloqueado, retorna erro SEM modificar nada
    IF array_length(v_blocked, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Um ou mais números não estão disponíveis.',
            'numbers', v_blocked
        );
    END IF;

    -- Fase 2: Todos disponíveis — reservar todos com os dados do comprador
    FOREACH v_number IN ARRAY p_numbers LOOP

        INSERT INTO reservations (
            raffle_id, number, buyer_name, buyer_phone, buyer_email,
            status, efi_txid, expires_at, created_at, updated_at
        ) VALUES (
            p_raffle_id, v_number, p_buyer_name, p_buyer_phone, p_buyer_email,
            'pending', NULL, v_expires_at, NOW(), NOW()
        )
        ON CONFLICT (raffle_id, number) DO UPDATE SET
            buyer_name  = CASE WHEN reservations.status = 'paid' THEN reservations.buyer_name ELSE EXCLUDED.buyer_name END,
            buyer_phone = CASE WHEN reservations.status = 'paid' THEN reservations.buyer_phone ELSE EXCLUDED.buyer_phone END,
            buyer_email = CASE WHEN reservations.status = 'paid' THEN reservations.buyer_email ELSE EXCLUDED.buyer_email END,
            status      = CASE WHEN reservations.status = 'paid' THEN 'paid' ELSE 'pending' END,
            expires_at  = CASE WHEN reservations.status = 'paid' THEN reservations.expires_at ELSE EXCLUDED.expires_at END,
            updated_at  = NOW();

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


-- ============================================================
-- PARTE 4: FUNÇÃO PARA CONFIRMAR PAGAMENTO (WEBHOOK + POLLING)
-- Única função que marca número como pago. Verifica txid.
-- ============================================================
CREATE OR REPLACE FUNCTION confirm_payment_by_txid(
    p_txid      text,
    p_raffle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated integer := 0;
    v_txdata  record;
BEGIN
    -- Buscar dados da transação
    SELECT raffle_id, buyer_name, buyer_phone, buyer_email, amount, numbers_json
    INTO v_txdata
    FROM efi_transactions
    WHERE txid = p_txid;

    IF NOT FOUND OR v_txdata.numbers_json IS NULL THEN
        -- Fallback: atualiza por efi_txid diretamente
        UPDATE reservations SET
            status     = 'paid',
            expires_at = NULL,
            updated_at = NOW()
        WHERE efi_txid = p_txid
          AND status <> 'paid';  -- Nunca sobrescrever já-pagos

        GET DIAGNOSTICS v_updated = ROW_COUNT;

        RETURN jsonb_build_object(
            'success', true,
            'method', 'by_txid_fallback',
            'updated', v_updated
        );
    END IF;

    -- Atualizar cada número individualmente com verificação de txid
    -- Garante que só marca como pago se o efi_txid bate OU se o número está pendente
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
            efi_txid = p_txid           -- É a reserva deste PIX
            OR (
               status = 'pending'
               AND efi_txid IS NULL     -- Seleção temporária sem PIX ainda
            )
            OR status = 'cancelled'     -- Cleanup cancelou mas pagamento veio
          )
      AND status <> 'paid';             -- Nunca sobrescrever já-pagos

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    -- Se nenhum número foi atualizado pela query acima, pode ser que o
    -- cleanup deletou as reservas. Recriar a partir dos dados da transação.
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
            status      = CASE WHEN reservations.status = 'paid' THEN 'paid' ELSE 'paid' END,
            buyer_name  = CASE WHEN reservations.status = 'paid' AND reservations.efi_txid <> p_txid
                               THEN reservations.buyer_name   -- Mantém dono original se já pago com outro txid
                               ELSE EXCLUDED.buyer_name END,
            efi_txid    = CASE WHEN reservations.status = 'paid' AND reservations.efi_txid <> p_txid
                               THEN reservations.efi_txid
                               ELSE p_txid END,
            expires_at  = NULL,
            updated_at  = NOW();

        GET DIAGNOSTICS v_updated = ROW_COUNT;
    END IF;

    -- Atualizar status na tabela efi_transactions
    UPDATE efi_transactions SET
        status     = 'CONCLUIDA',
        updated_at = NOW()
    WHERE txid = p_txid;

    RETURN jsonb_build_object(
        'success', true,
        'method', 'by_numbers_json',
        'updated', v_updated
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', SQLERRM,
            'updated', 0
        );
END;
$$;


-- ============================================================
-- PARTE 5: FUNÇÃO DE CLEANUP DEFINITIVA E SEGURA
-- Versão única e definitiva. NUNCA apaga pagos ou PIX válidos.
-- ============================================================
CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted   integer := 0;
    v_cancelled integer := 0;
    v_total     integer := 0;
    v_safe_margin interval := '10 minutes';  -- Margem de segurança para webhook chegar
BEGIN
    -- 1. Deletar apenas reservas SEM PIX que expiraram
    --    (seleções temporárias da grade que o usuário abandonou)
    DELETE FROM reservations
    WHERE status     = 'pending'
      AND efi_txid   IS NULL
      AND expires_at < NOW();

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- 2. Cancelar (NÃO deletar) reservas COM PIX que expiraram há mais de 10 minutos
    --    A margem de 10 min garante que webhooks atrasados ainda possam confirmar.
    --    Reservas canceladas permanecem no banco para o webhook reativá-las se necessário.
    UPDATE reservations SET
        status     = 'cancelled',
        updated_at = NOW()
    WHERE status     = 'pending'
      AND efi_txid   IS NOT NULL
      AND expires_at < NOW() - v_safe_margin;

    GET DIAGNOSTICS v_cancelled = ROW_COUNT;

    v_total := v_deleted + v_cancelled;
    RETURN v_total;

END;
$$;

-- Alias mantido por compatibilidade com cleanup.ts que chama ambas
CREATE OR REPLACE FUNCTION delete_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN expire_old_reservations();
END;
$$;


-- ============================================================
-- PARTE 6: FUNÇÃO update_efi_transaction_status (WEBHOOK RPC)
-- Atualiza efi_transactions E confirma pagamento de forma segura.
-- ============================================================
CREATE OR REPLACE FUNCTION update_efi_transaction_status(
    p_txid    text,
    p_status  text,
    p_paid_at text DEFAULT '',
    p_event   jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_raffle_id uuid;
    v_result    jsonb;
BEGIN
    -- Atualizar a tabela de transações
    UPDATE efi_transactions SET
        status     = p_status,
        paid_at    = CASE WHEN p_paid_at <> '' THEN p_paid_at::timestamptz ELSE paid_at END,
        updated_at = NOW()
    WHERE txid = p_txid
    RETURNING raffle_id INTO v_raffle_id;

    -- Se status é CONCLUIDA, confirmar pagamento de forma segura
    IF p_status = 'CONCLUIDA' AND v_raffle_id IS NOT NULL THEN
        v_result := confirm_payment_by_txid(p_txid, v_raffle_id);
    ELSE
        v_result := jsonb_build_object('success', true, 'updated', 0);
    END IF;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- ============================================================
-- PARTE 7: TRIGGERS DE PROTEÇÃO
-- ============================================================

-- Trigger 1: NUNCA permite sobrescrever uma reserva 'paid' com status diferente
CREATE OR REPLACE FUNCTION prevent_overwrite_paid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
        RAISE EXCEPTION 'PROTEÇÃO: Número % (raffle %) está pago e não pode ser sobrescrito. Comprador: %',
            OLD.number, OLD.raffle_id, OLD.buyer_name;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_overwrite_paid
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_overwrite_paid();

-- Trigger 2: NUNCA permite INSERT que sobrescreva um número pago
CREATE OR REPLACE FUNCTION prevent_insert_over_paid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Este trigger previne que o ON CONFLICT DO UPDATE sobrescreva um pago
    -- O trigger é chamado ANTES do UPDATE no caso de conflito
    IF TG_OP = 'UPDATE' AND OLD.status = 'paid' AND NEW.status <> 'paid' THEN
        RAISE EXCEPTION 'PROTEÇÃO: Número % já está pago. Operação bloqueada.', OLD.number;
    END IF;
    RETURN NEW;
END;
$$;


-- ============================================================
-- PARTE 8: VERIFICAÇÃO FINAL
-- Execute após aplicar para confirmar que tudo foi criado.
-- ============================================================
SELECT
    routine_name,
    'CRIADA' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'reserve_number_atomic',
    'lock_numbers_for_pix',
    'confirm_payment_by_txid',
    'expire_old_reservations',
    'delete_expired_reservations',
    'update_efi_transaction_status',
    'prevent_overwrite_paid'
  )
ORDER BY routine_name;

SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    'ATIVO' as status
FROM information_schema.triggers
WHERE event_object_table = 'reservations'
ORDER BY trigger_name;
