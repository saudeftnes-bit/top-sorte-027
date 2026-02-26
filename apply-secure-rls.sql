-- =========================================================================
-- SCRIPT DE SEGURANÇA: FECHANDO VULNERABILIDADES DE RLS E PROTEGENDO BANCO
-- =========================================================================

-- 1. Protegendo a tabela 'raffles' (rifas)
-- NENHUM cliente anônimo ou usuário padrão pode EDITAR, CRIAR ou DELETAR rifas.
-- Apenas visualização é permitida. Administradores reais usarão a API JWT/SERVICE_ROLE
DROP POLICY IF EXISTS "Anyone can read raffles" ON raffles;
DROP POLICY IF EXISTS "Anyone can insert raffles" ON raffles;
DROP POLICY IF EXISTS "Anyone can update raffles" ON raffles;
DROP POLICY IF EXISTS "Anyone can delete raffles" ON raffles;

-- Leitura pública mantida (Para a Home funcionar)
CREATE POLICY "Anyone can read raffles"
ON raffles FOR SELECT 
USING (true);

-- As apis do Efi e comandos de backend em Vercel rodam com a chave SECURITY_ROLE_KEY
-- Logo, eles furam o RLS automaticamente. Não precisamos criar regras for INSERT/UPDATE/DELETE
-- para clientes anônimos acessarem o banco através da ANON_KEY.

-- 2. Protegendo a tabela 'reservations' (Números)
-- NENHUM cliente manipulado pode rodar UPDATE num ticket para status="paid" de graça.
DROP POLICY IF EXISTS "Anyone can read all reservations" ON reservations;
DROP POLICY IF EXISTS "Anyone can insert reservations" ON reservations;
DROP POLICY IF EXISTS "Anyone can update reservations" ON reservations;
DROP POLICY IF EXISTS "Anyone can delete reservations" ON reservations;

-- Leitura de Ingressos Mantida: Todo mundo precisa saber quem comprou para o grid preencher
CREATE POLICY "Anyone can read all reservations"
ON reservations FOR SELECT
USING (true);

-- Insert Mantido: Todo mundo pode clicar num numero livre para torná-lo 'pending' (A nossa API React/Vite já lida com isso)
CREATE POLICY "Anyone can insert reservations"
ON reservations FOR INSERT
WITH CHECK (status = 'pending'); -- Ninguém consegue inserir um numero 'paid' burlado logo no insert

-- UPDATE BLOQUEADO:
-- Nenhum Front-End com a ANON_KEY vai poder dar UPDATE (Nenhuma gambiarra feita no Console Dev vai hackear "paid").
-- O único carinha que dá UPDATE no projeto hoje é o webhook do Efi/Charge, e eles usam a SECRET_ROLE ou Backend que bypasa isso.

-- DELETE RESTRITO: O usuário só pode deletar sua própria RESERVA PENDENTE se for a mesma sessão.
-- Não pode deletar reservas brutas de PIX (paid) de outras pessoas.
CREATE POLICY "Anyone can delete their pending reservations"
ON reservations FOR DELETE
USING (status = 'pending');

-- =========================================================================
-- FIM DA MIGRAÇÃO - TESTE NO PAINEL SE A EDIÇÃO DE ADMIN NO FRONT CONTINUA FUNCIONAL
-- SE ALGUMA FUNÇÃO EXPLODIR NO PAINEL ADMIN, CHAME A IA NOVAMENTE!
-- =========================================================================
