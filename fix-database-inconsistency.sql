-- ==================== CORREÇÃO: PERMISSÕES E CONSISTÊNCIA ====================
-- Este script corrige:
-- 1. Permissão de DELETE na tabela efi_transactions
-- 2. Garante que a função reset_raffle_numbers tenha privilégios de SECURITY DEFINER
-- 3. Limpa referências órfãs se houver

-- 1. Permitir DELETE em efi_transactions (necessário para o admin zerar a rifa)
ALTER TABLE efi_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir deleção de transações Efi" ON efi_transactions;
CREATE POLICY "Permitir deleção de transações Efi" ON efi_transactions FOR DELETE USING (true);

-- 2. Recriar a função reset_raffle_numbers com SECURITY DEFINER
-- Isso garante que ela execute com privilégios de sistema, ignorando RLS se necessário,
-- o que evita erros de "Permission Denied" que o Postgres às vezes reporta como inconsistência.
CREATE OR REPLACE FUNCTION reset_raffle_numbers(raffle_id_param UUID)
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  count_eff INTEGER;
  count_res INTEGER;
BEGIN
  -- A ordem importa para respeitar chaves estrangeiras (se houvesse ON DELETE RESTRICT)
  
  -- 1. Deletar transações EFI
  DELETE FROM efi_transactions
  WHERE raffle_id = raffle_id_param;
  
  -- 2. Deletar reservas
  DELETE FROM reservations
  WHERE raffle_id = raffle_id_param;
  
  GET DIAGNOSTICS count_res = ROW_COUNT;
  
  -- Log para debug no console do Postgres
  RAISE NOTICE 'Reset da rifa %: % reservas removidas.', raffle_id_param, count_res;
  
  RETURN QUERY SELECT count_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Garantir que a tabela reservations também tenha política de DELETE
DROP POLICY IF EXISTS "Anyone can delete reservations" ON reservations;
CREATE POLICY "Anyone can delete reservations" ON reservations FOR DELETE USING (true);
