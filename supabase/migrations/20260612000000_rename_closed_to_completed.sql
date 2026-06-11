-- Rename status 'closed' → 'completed' for finished games
-- Drop and recreate the check constraint if it exists
DO $$
BEGIN
  -- Update existing rows first
  UPDATE games SET status = 'completed' WHERE status = 'closed';

  -- Re-create check constraint if one exists that excludes 'completed'
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'games' AND constraint_type = 'CHECK' AND constraint_name LIKE '%status%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE games DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'games' AND constraint_type = 'CHECK' AND constraint_name LIKE '%status%'
      LIMIT 1
    );
    ALTER TABLE games ADD CONSTRAINT games_status_check
      CHECK (status IN ('open', 'full', 'in_progress', 'completed', 'cancelled'));
  END IF;
END $$;
