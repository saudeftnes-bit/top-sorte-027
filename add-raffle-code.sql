-- Add 'code' column to raffles table
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS code TEXT;

-- Populate existing raffles with a default code (e.g., based on creation order or just '0001')
DO $$
DECLARE
    r RECORD;
    counter INT := 1;
BEGIN
    FOR r IN SELECT id FROM raffles ORDER BY created_at ASC LOOP
        UPDATE raffles 
        SET code = LPAD(counter::text, 4, '0') 
        WHERE id = r.id AND code IS NULL;
        
        counter := counter + 1;
    END LOOP;
END $$;

-- Make code unique if desired (optional but recommended)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_raffles_code ON raffles(code);
