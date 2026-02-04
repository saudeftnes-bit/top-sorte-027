-- ==================== CORRIGIR RLS PARA RESERVAS ====================
-- Problema: RLS pode estar bloqueando leitura de reservas temporárias
-- Solução: Criar política que permite ler TODAS as reservas

-- 1. Verificar se RLS está habilitado
SELECT tablename,rowsecurity FROM pg_tables WHERE tablename = 'reservations';

-- 2. Listar políticas atuais
SELECT * FROM pg_policies WHERE tablename = 'reservations';

-- 3. Criar política de leitura permissiva
DROP POLICY IF EXISTS "Anyone can read all reservations" ON reservations;
CREATE POLICY "Anyone can read all reservations"
ON reservations FOR SELECT
USING (true); -- Permite ler TUDO

-- 4. Política de inserção (já deve existir, mas garantir)
DROP POLICY IF EXISTS "Anyone can insert reservations" ON reservations;
CREATE POLICY "Anyone can insert reservations"
ON reservations FOR INSERT
WITH CHECK (true);

-- 5. Política de atualização
DROP POLICY IF EXISTS "Anyone can update reservations" ON reservations;
CREATE POLICY "Anyone can update reservations"
ON reservations FOR UPDATE
USING (true);

-- 6. Política de deleção
DROP POLICY IF EXISTS "Anyone can delete reservations" ON reservations;
CREATE POLICY "Anyone can delete reservations"
ON reservations FOR DELETE
USING (true);

-- 7. Verificar resultado
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'reservations';
