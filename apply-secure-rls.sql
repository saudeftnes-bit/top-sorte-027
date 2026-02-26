-- =========================================================================
-- SCRIPT DE SEGURANÇA: FECHANDO VULNERABILIDADES DE RLS E PROTEGENDO BANCO
-- =========================================================================

-- 1. Tabela 'raffles' (rifas)
-- Como o painel Admin não usa o Supabase Auth (usa senha na tela do React), 
-- nós precisamos manter as operações liberadas na chave pública para que você consiga criar rifas.
-- CUIDADO: O acesso está fixado no front-end por senha, mas a API teóricamente fica aberta. 
DROP POLICY IF EXISTS "Anyone can read raffles" ON raffles;
DROP POLICY IF EXISTS "Anyone can insert raffles" ON raffles;
DROP POLICY IF EXISTS "Anyone can update raffles" ON raffles;
DROP POLICY IF EXISTS "Anyone can delete raffles" ON raffles;

CREATE POLICY "Anyone can read raffles" ON raffles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert raffles" ON raffles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update raffles" ON raffles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete raffles" ON raffles FOR DELETE USING (true);

-- 2. Protegendo a tabela 'reservations' (Números)
-- AQUI É O NÚCLEO DA SEGURANÇA: NENHUM cliente manipulado pode rodar UPDATE num ticket para status="paid" de graça.
DROP POLICY IF EXISTS "Anyone can read all reservations" ON reservations;
DROP POLICY IF EXISTS "Anyone can insert reservations" ON reservations;
DROP POLICY IF EXISTS "Anyone can update reservations" ON reservations;
DROP POLICY IF EXISTS "Anyone can delete reservations" ON reservations;

-- Leitura de Ingressos Mantida: Todo mundo precisa saber quem comprou para a cartela preencher de roxo/amarelo.
CREATE POLICY "Anyone can read all reservations"
ON reservations FOR SELECT
USING (true);

-- Insert Mantido: Todo mundo pode clicar num número livre para torná-lo 'pending' (A cartela inicializa assim)
CREATE POLICY "Anyone can insert reservations"
ON reservations FOR INSERT
WITH CHECK (status = 'pending'); -- Ninguém consegue inserir um número 'paid' burlado logo na escolha

-- UPDATE BLOQUEADO TOTALMENTE NA CHAVE PÚBLICA (ANON_KEY):
-- Nenhum Front-End no celular do cliente vai poder dar UPDATE (Nenhuma "gambiarra" no Console de Desenvolvedor vai hackear pra 'paid').
-- O ÚNICO sistema que pode dar UPDATE agora é a API Efi e o Painel Vercel Backend (Eles pulam RLS usando SERVICE ROLE KEY).

-- DELETE RESTRITO: 
-- 1. O cliente só pode desselecionar número AMARELO (pending). Ninguém deleta status PAGO.
-- 2. O Admin do painel precisa deletar na marra, nesse caso, teremos que contornar as rotinas do Admin via Backend. Mas por hora vamos manter o backend limpando, ou permitir que qualquer um delete "pendentes":
CREATE POLICY "Anyone can delete their pending reservations"
ON reservations FOR DELETE
USING (status = 'pending');

-- =========================================================================
-- FIM DA MIGRAÇÃO DE SEGURANÇA
-- =========================================================================
