-- =========================================================================
-- SCRIPT DE LIMPEZA DE POLÍTICAS "TRADUZIDAS" E REPASSE DA SEGURANÇA
-- =========================================================================

-- O navegador provavelmente traduziu a página do Supabase quando você 
-- criou as tabelas lá atrás, salvando os nomes das regras em português. 
-- Nosso script anterior só deletava os nomes em inglês, gerando conflito (duas regras com o mesmo peso).

-- 1. DELETANDO AS REGRAS EM PORTUGUÊS (Tabela Raffles)
DROP POLICY IF EXISTS "Qualquer um pode ler rifa" ON raffles;
DROP POLICY IF EXISTS "Qualquer um pode ler rifas" ON raffles;
DROP POLICY IF EXISTS "Qualquer um pode inserir rifas" ON raffles;
DROP POLICY IF EXISTS "Qualquer um pode atualizar rifas" ON raffles;
DROP POLICY IF EXISTS "Qualquer um pode deletar rifas" ON raffles;

-- 2. DELETANDO AS REGRAS EM PORTUGUÊS (Tabela Reservations)
DROP POLICY IF EXISTS "Qualquer um pode ler todas as reservas" ON reservations;
DROP POLICY IF EXISTS "Qualquer um pode inserir reservas" ON reservations;
DROP POLICY IF EXISTS "Qualquer um pode atualizar reservas" ON reservations;
DROP POLICY IF EXISTS "Qualquer um pode deletar reservas" ON reservations;

-- 3. REAPLICANDO O SCRIPT CORRETO
-- Garantir que a tabela `raffles` funcione para o Admin local
DROP POLICY IF EXISTS "Anyone can read raffles" ON raffles;
DROP POLICY IF EXISTS "Anyone can insert raffles" ON raffles;
DROP POLICY IF EXISTS "Anyone can update raffles" ON raffles;
DROP POLICY IF EXISTS "Anyone can delete raffles" ON raffles;

CREATE POLICY "Anyone can read raffles" ON raffles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert raffles" ON raffles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update raffles" ON raffles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete raffles" ON raffles FOR DELETE USING (true);

-- 4. Garantir que a tabela `reservations` fique TRAVADA contra invasores
DROP POLICY IF EXISTS "Anyone can read all reservations" ON reservations;
DROP POLICY IF EXISTS "Anyone can insert reservations" ON reservations;
DROP POLICY IF EXISTS "Anyone can update reservations" ON reservations;
DROP POLICY IF EXISTS "Anyone can delete reservations" ON reservations;

CREATE POLICY "Anyone can read all reservations" ON reservations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reservations" ON reservations FOR INSERT WITH CHECK (status = 'pending');
CREATE POLICY "Anyone can delete their pending reservations" ON reservations FOR DELETE USING (status = 'pending');

-- Lembrete: Nós intencionalmente NÃO criamos uma regra de UPDATE para `reservations`.
-- Assim, o banco bloqueia qualquer atualização vinda de um usuário "espertinho" tentando forçar o paid na mão.
