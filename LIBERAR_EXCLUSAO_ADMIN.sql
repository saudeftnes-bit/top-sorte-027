-- =========================================================================
-- FUNÇÃO DE EXCLUSÃO DE RESERVAS PARA O PAINEL ADMINISTRATIVO
-- =========================================================================
-- Execute este script no SQL Editor do Supabase (https://supabase.com)
-- 
-- O que ele faz:
-- 1. Cria a função 'admin_force_delete_reservations' com SECURITY DEFINER
--    (permite ao painel admin apagar/liberar qualquer cota com segurança)
-- 2. Concede permissão de execução para o painel admin
-- 3. Atualiza a política de DELETE para permitir exclusão
-- =========================================================================

-- 1. Função que apaga reservas por lista de IDs (bypassa travas de RLS)
CREATE OR REPLACE FUNCTION admin_force_delete_reservations(p_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Se houver transações EFI pendentes associadas, pode manter ou limpar se necessário
  DELETE FROM reservations WHERE id = ANY(p_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Conceder permissão de execução
GRANT EXECUTE ON FUNCTION admin_force_delete_reservations(UUID[]) TO anon, authenticated, service_role;

-- 3. Garantir política de exclusão
DROP POLICY IF EXISTS "Anyone can delete reservations" ON reservations;
DROP POLICY IF EXISTS "reservations_delete_policy" ON reservations;
CREATE POLICY "Anyone can delete reservations" ON reservations FOR DELETE USING (true);
