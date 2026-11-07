-- ==============================================================================
-- CORREÇÃO DEFINITIVA: ELIMINAÇÃO DE AMBIGUIDADE DE FUNÇÕES E CONCORRÊNCIA
-- ==============================================================================
-- Este script elimina a ambiguidade PGRST203 no Supabase / PostgREST
-- causada pela sobrecarga das funções update_efi_transaction_status (varchar vs text).
-- ==============================================================================

-- 1. Elimina a versão antiga com tipos VARCHAR
DROP FUNCTION IF EXISTS public.update_efi_transaction_status(character varying, character varying, text, jsonb);
DROP FUNCTION IF EXISTS public.update_efi_transaction_status(character varying, character varying, text);
DROP FUNCTION IF EXISTS public.update_efi_transaction_status(character varying, character varying);

-- 2. Elimina a versão com TEXT para recriar de forma limpa e sem duplicatas
DROP FUNCTION IF EXISTS public.update_efi_transaction_status(text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.update_efi_transaction_status(text, text, text);
DROP FUNCTION IF EXISTS public.update_efi_transaction_status(text, text);

-- 3. Recria a função oficial única de atualização com tipos TEXT
CREATE OR REPLACE FUNCTION public.update_efi_transaction_status(
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
    v_raffle_id uuid;
    v_result    jsonb;
BEGIN
    -- Atualizar a tabela de transações
    UPDATE efi_transactions SET
        status         = p_status,
        paid_at        = CASE WHEN p_paid_at IS NOT NULL AND p_paid_at <> '' THEN p_paid_at::timestamptz ELSE paid_at END,
        webhook_events = COALESCE(webhook_events, '[]'::jsonb) || jsonb_build_array(p_event),
        updated_at     = NOW()
    WHERE txid = p_txid
    RETURNING raffle_id INTO v_raffle_id;

    -- Se status é CONCLUIDA, confirmar pagamento de forma segura
    IF p_status = 'CONCLUIDA' AND v_raffle_id IS NOT NULL THEN
        v_result := confirm_payment_by_txid(p_txid, v_raffle_id);
    ELSE
        v_result := jsonb_build_object('success', true, 'updated', 0, 'status', p_status);
    END IF;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 4. Notificar PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
