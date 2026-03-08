-- Este script força a rifa ativa no banco de dados a baixar o limite de números de 10000 para 100.
-- Sem ele, o site bateria na trava de 10000 gravada ontem no Supabase.

UPDATE raffles
SET total_numbers = 100
WHERE status = 'active';

-- O limite global de 100 agora prevalece no banco!
