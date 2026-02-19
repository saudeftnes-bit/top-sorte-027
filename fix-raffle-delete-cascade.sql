-- 1. ADICIONAR CASCADE NO DELETE PARA RESERVAS
-- Isso permite deletar uma rifa e automaticamente remover todas as suas reservas relacionadas

ALTER TABLE public.reservations
DROP CONSTRAINT IF EXISTS reservations_raffle_id_fkey;

ALTER TABLE public.reservations
ADD CONSTRAINT reservations_raffle_id_fkey
FOREIGN KEY (raffle_id)
REFERENCES public.raffles(id)
ON DELETE CASCADE;

-- 2. VERIFICAÇÃO
SELECT
    conname AS constraint_name,
    confdeltype AS delete_type -- 'c' significa cascade
FROM pg_constraint
WHERE conname = 'reservations_raffle_id_fkey';
