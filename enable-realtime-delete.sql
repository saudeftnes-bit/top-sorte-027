-- ==================== RECONFIGURAR REALTIME PARA INCLUIR DELETE ====================
-- A tabela já está na publicação, mas pode não estar publicando DELETE

-- 1. Ver configuração atual da publicação
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- 2. Remover tabela da publicação
ALTER PUBLICATION supabase_realtime DROP TABLE reservations;

-- 3. Re-adicionar com configuração explícita de DELETE
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;

-- 4. Garantir que está publicando todos os eventos (INSERT, UPDATE, DELETE)
-- NOTA: Por padrão, publicações incluem todos os eventos, mas vamos garantir
ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete');

-- 5. Verificar resultado
SELECT 
    pubname,
    puballtables,
    pubinsert,
    pubupdate,
    pubdelete
FROM pg_publication 
WHERE pubname = 'supabase_realtime';

-- 6. Verificar que a tabela está na publicação
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reservations';
