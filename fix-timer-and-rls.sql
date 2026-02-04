-- ==================== CORREÇÃO: TIMER E PERMISSÕES ====================
-- Este script corrige:
-- 1. Timer de expiração usando timezone UTC consistente
-- 2. Permissões RLS para atualizar sorteios no admin

-- ==================== 1. CORRIGIR TIMER DE EXPIRAÇÃO ====================

-- Remover trigger antigo
DROP TRIGGER IF EXISTS set_expiration_on_insert ON reservations;

-- Recriar função com timezone UTC explícito
CREATE OR REPLACE FUNCTION set_reservation_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Usar timezone UTC para evitar problemas de fuso horário
  NEW.expires_at := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger
CREATE TRIGGER set_expiration_on_insert
BEFORE INSERT ON reservations
FOR EACH ROW
EXECUTE FUNCTION set_reservation_expiration();

-- ==================== 2. VERIFICAR/CORRIGIR RLS RAFFLES ====================

-- Garantir que RLS está ativado
ALTER TABLE raffles ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Anyone can read raffles" ON raffles;
DROP POLICY IF EXISTS "Anyone can insert raffles" ON raffles;
DROP POLICY IF EXISTS "Anyone can update raffles" ON raffles;
DROP POLICY IF EXISTS "Anyone can delete raffles" ON raffles;

-- Permitir leitura pública
CREATE POLICY "Anyone can read raffles"
ON raffles FOR SELECT
USING (true);

-- Permitir inserção pública
CREATE POLICY "Anyone can insert raffles"
ON raffles FOR INSERT
WITH CHECK (true);

-- IMPORTANTE: Permitir UPDATE para TODOS
CREATE POLICY "Anyone can update raffles"
ON raffles FOR UPDATE
USING (true)
WITH CHECK (true);

-- Permitir DELETE para todos
CREATE POLICY "Anyone can delete raffles"
ON raffles FOR DELETE
USING (true);

-- ==================== 3. INFORMAÇÕES PARA DEBUG ====================

-- Ver políticas atuais da tabela raffles
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'raffles';

-- Ver se RLS está ativado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'raffles';

-- ==================== NOTA IMPORTANTE ====================
-- 
-- SEGURANÇA: As políticas acima permitem UPDATE/DELETE para QUALQUER um.
-- Em produção, você deve:
-- 1. Configurar autenticação Supabase
-- 2. Restringir UPDATE/DELETE apenas para usuários autenticados com role 'admin'
-- 
-- Exemplo de política mais segura (requer autenticação):
-- CREATE POLICY "Only admins can update raffles"
-- ON raffles FOR UPDATE
-- USING (auth.jwt() ->> 'role' = 'admin')
-- WITH CHECK (auth.jwt() ->> 'role' = 'admin');
-- 
-- ====================
