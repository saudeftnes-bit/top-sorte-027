-- ============================================================
-- CONSOLIDATED FIX: RESERVATION PERSISTENCE & TIMEOUT FLOW
-- ============================================================
-- This script fixes the issues where reservations disappear 
-- or fail to register during the EFI payment flow.

-- 1. FIX RLS PERMISSIONS
-- Ensure the 'anon' role (used by frontend/API) can manage reservations
-- especially DELETE which is used by efi-charge and selection-manager.

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read all reservations" ON public.reservations;
CREATE POLICY "Anyone can read all reservations" ON public.reservations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert reservations" ON public.reservations;
CREATE POLICY "Anyone can insert reservations" ON public.reservations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update reservations" ON public.reservations;
CREATE POLICY "Anyone can update reservations" ON public.reservations FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete reservations" ON public.reservations;
CREATE POLICY "Anyone can delete reservations" ON public.reservations FOR DELETE USING (true);

-- 2. FIX EXPIRATION TRIGGER
-- The trigger should only apply 30m if NO DATE IS PROVIDED.
-- If efi-charge provides a specific date from the EFI API, we MUST respect it.
-- If the status is 'paid', it NEVER expires.

CREATE OR REPLACE FUNCTION public.set_reservation_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Paid reservations never expire
  IF NEW.status = 'paid' THEN
    NEW.expires_at := NULL;
    RETURN NEW;
  END IF;

  -- 2. If an expiration date was already provided (manual or from EFI API), respect it
  IF NEW.expires_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 3. Default for new pending reservations (selection flow): 30 minutes
  IF NEW.status = 'pending' THEN
    NEW.expires_at := NOW() + INTERVAL '30 minutes';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-enable the trigger just in case
DROP TRIGGER IF EXISTS set_expiration_on_insert ON public.reservations;
CREATE TRIGGER set_expiration_on_insert
BEFORE INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.set_reservation_expiration();

-- 3. FIX CLEANUP RPC
-- The cleanup should DELETE expired pending reservations to free up the UNIQUE constraint.
-- It should NOT touch paid reservations.

DROP FUNCTION IF EXISTS public.expire_old_reservations();
DROP FUNCTION IF EXISTS public.delete_expired_reservations();

CREATE OR REPLACE FUNCTION public.expire_old_reservations()
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  -- DELETE instead of UPDATE to free up the (raffle_id, number) UNIQUE constraint!
  DELETE FROM public.reservations
  WHERE status = 'pending'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN count;
END;
$$ LANGUAGE plpgsql;

-- Alias for naming consistency in older code
CREATE OR REPLACE FUNCTION public.delete_expired_reservations()
RETURNS TABLE(deleted_count INTEGER) AS $$
BEGIN
  RETURN QUERY SELECT public.expire_old_reservations();
END;
$$ LANGUAGE plpgsql;

-- 4. EMERGENCY CLEANUP
-- Fix currently stuck reservations that became 'paid' but still have an expiration date
UPDATE public.reservations 
SET expires_at = NULL 
WHERE status = 'paid' AND expires_at IS NOT NULL;

-- 5. CASCADE DELETE
-- Ensure that deleting a raffle also deletes its transactions to avoid orphan records
ALTER TABLE public.efi_transactions
DROP CONSTRAINT IF EXISTS efi_transactions_raffle_id_fkey,
ADD CONSTRAINT efi_transactions_raffle_id_fkey 
    FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE;
