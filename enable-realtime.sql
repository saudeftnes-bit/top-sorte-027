-- ==================== HABILITAR REALTIME ====================
-- Execute este SQL no seu projeto Supabase para habilitar sincronização em tempo real

-- 1. Habilitar Realtime para a tabela reservations
ALTER publication supabase_realtime ADD TABLE reservations;

-- 2. Verificar se foi habilitado (deve retornar 'reservations')
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- ==================== VERIFICAÇÃO ====================
-- Se der erro "publication supabase_realtime does not exist", execute:
-- CREATE PUBLICATION supabase_realtime;
-- ALTER publication supabase_realtime ADD TABLE reservations;
