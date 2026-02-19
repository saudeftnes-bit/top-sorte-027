-- ================================================================================
-- FIX CRITICAL REALTIME SYNC (REPLICA IDENTITY & PUBLICATION) - VERSÃO CORRIGIDA
-- ================================================================================
-- Execute este script no SQL Editor do Supabase para corrigir falhas de 
-- sincronização entre múltiplos sorteios e o problema de números "pendurados".

-- 1. GARANTIR QUE A TABELA ENVIE TODOS OS DADOS EM CASO DE DELETE
-- Com 'FULL', ele envia a linha inteira, permitindo que o site saiba 
-- de QUAL sorteio (raffle_id) aquele número foi removido.
ALTER TABLE public.reservations REPLICA IDENTITY FULL;

-- 2. RECONFIGURAR PUBLICAÇÃO SUPABASE_REALTIME
-- Garante que todas as tabelas e eventos estejam sendo transmitidos.

-- Verifica se a publicação existe, se não, cria
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Tenta adicionar a tabela reservations
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Tabela reservations já está na publicação';
END $$;

-- Tenta adicionar a tabela raffles
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.raffles;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Tabela raffles já está na publicação';
END $$;

-- Garante que a publicação emita todos os tipos de eventos
ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete');

-- 3. VERIFICAÇÃO FINAL (Deve retornar 'f' na coluna relreplident)
SELECT 
    relname as tabela, 
    CASE relreplident 
        WHEN 'd' THEN 'default' 
        WHEN 'n' THEN 'nothing' 
        WHEN 'f' THEN 'full' 
        WHEN 'i' THEN 'index' 
    END AS tipo_identidade
FROM pg_class c 
JOIN pg_namespace n ON n.oid = c.relnamespace 
WHERE relname = 'reservations' AND n.nspname = 'public';
