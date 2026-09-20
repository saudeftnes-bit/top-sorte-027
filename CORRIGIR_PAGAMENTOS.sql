-- ==================================================================================
-- CORREÇÃO DEFINITIVA: NÚMEROS AMARELOS APÓS PAGAMENTO
-- ==================================================================================
-- EXECUTE ESTE SCRIPT NO SQL EDITOR DO SUPABASE
--
-- Problema: O webhook (Vercel) falha ao atualizar os números para verde ('paid')
-- devido a bloqueios de segurança (RLS) no Supabase quando usa chave anônima.
--
-- Solução: Mover a lógica de confirmação para dentro do banco de dados (RPC),
-- usando SECURITY DEFINER, o que permite bypassar o RLS e garantir que os 
-- números sejam confirmados (ficando verdes e não sendo liberados novamente).
-- ==================================================================================

CREATE OR REPLACE FUNCTION update_efi_transaction_status(
  p_txid VARCHAR, 
  p_status VARCHAR, 
  p_paid_at TEXT, 
  p_event JSONB
)
RETURNS VOID AS $$
DECLARE
  v_transaction record;
  v_numbers json;
  v_num text;
BEGIN
  -- 1. Atualiza a transação na tabela efi_transactions
  UPDATE efi_transactions
  SET 
    status = p_status,
    paid_at = CASE WHEN p_paid_at IS NOT NULL AND p_paid_at != '' THEN p_paid_at::timestamp ELSE paid_at END,
    webhook_events = COALESCE(webhook_events, '[]'::jsonb) || jsonb_build_array(p_event),
    updated_at = NOW()
  WHERE txid = p_txid;

  -- 2. Se o pagamento foi CONCLUIDO, forçamos a atualização dos números bypassando o RLS
  IF p_status = 'CONCLUIDA' THEN
    SELECT * INTO v_transaction FROM efi_transactions WHERE txid = p_txid;
    
    IF v_transaction.numbers_json IS NOT NULL THEN
      v_numbers := v_transaction.numbers_json::json;
      
      IF json_array_length(v_numbers) > 0 THEN
        FOR v_num IN SELECT * FROM json_array_elements_text(v_numbers)
        LOOP
          -- O UPSERT garante que mesmo se o número foi apagado, ele será recriado como PAGO
          INSERT INTO reservations (
            raffle_id, number, buyer_name, buyer_phone, buyer_email, 
            status, payment_amount, payment_method, efi_txid, expires_at, updated_at
          ) VALUES (
            v_transaction.raffle_id, v_num, v_transaction.buyer_name, v_transaction.buyer_phone, v_transaction.buyer_email,
            'paid', (v_transaction.amount / json_array_length(v_numbers)), 'efi', p_txid, null, NOW()
          )
          ON CONFLICT (raffle_id, number) DO UPDATE 
          SET 
            status = 'paid', 
            buyer_name = EXCLUDED.buyer_name,
            buyer_phone = EXCLUDED.buyer_phone,
            efi_txid = p_txid,
            expires_at = null,
            updated_at = NOW();
        END LOOP;
      END IF;
    ELSE
      -- Fallback caso não tenha json salvo
      UPDATE reservations 
      SET status = 'paid', expires_at = null, updated_at = NOW() 
      WHERE efi_txid = p_txid;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permissões adequadas
GRANT EXECUTE ON FUNCTION update_efi_transaction_status TO authenticated;
GRANT EXECUTE ON FUNCTION update_efi_transaction_status TO anon;
GRANT EXECUTE ON FUNCTION update_efi_transaction_status TO service_role;
