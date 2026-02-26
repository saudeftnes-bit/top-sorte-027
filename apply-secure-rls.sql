-- =========================================================================
-- SCRIPT "SLEDGEHAMMER" DE LIMPEZA GERAL DE POLÍTICAS DE RLS
-- =========================================================================

-- O arquivo zera COMPLETAMENTE qualquer política existente nas tabelas
-- ignorando os nomes variados que o Chrome criou.

-- Passo 1: Limpar as políticas das duas principais tabelas na marra!
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE tablename IN ('raffles', 'reservations')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END
$$;

-- Passo 2: Reaplicar Políticas do Admin (Abertas para INSERT/UPDATE local na tela dele)
CREATE POLICY "raffles_read_policy" ON raffles FOR SELECT USING (true);
CREATE POLICY "raffles_insert_policy" ON raffles FOR INSERT WITH CHECK (true);
CREATE POLICY "raffles_update_policy" ON raffles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "raffles_delete_policy" ON raffles FOR DELETE USING (true);


-- Passo 3: Reaplicar Políticas de Segurança Intransponíveis para Compras
-- Usa nomes simples e técnicos para evitar que o navegador "entenda" como frase pra traduzir
CREATE POLICY "reservations_read_all" ON reservations FOR SELECT USING (true);
CREATE POLICY "reservations_insert_pending" ON reservations FOR INSERT WITH CHECK (status = 'pending' OR status IS NULL);
CREATE POLICY "reservations_delete_pending" ON reservations FOR DELETE USING (status = 'pending');
