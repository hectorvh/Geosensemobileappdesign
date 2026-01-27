-- ============================================================================
-- UPDATE DEVICES TABLE FOR MANY-TO-MANY TRACKER LINKING
-- ============================================================================
-- This migration updates the devices table to support:
-- - Many-to-many relationship between users and trackers
-- - Linking trackers from live_locations.tracker_id
-- - Additional metadata fields (age, weight, batch_id, last_update)

-- ============================================================================
-- STEP 1: Add missing columns to devices table
-- ============================================================================
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS weight NUMERIC,
  ADD COLUMN IF NOT EXISTS batch_id TEXT,
  ADD COLUMN IF NOT EXISTS last_update TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN public.devices.age IS 'Animal age in years';
COMMENT ON COLUMN public.devices.weight IS 'Animal weight in kg';
COMMENT ON COLUMN public.devices.batch_id IS 'Batch identifier for grouping animals';
COMMENT ON COLUMN public.devices.last_update IS 'Last update timestamp from live_locations when linked';

-- ============================================================================
-- STEP 2: Remove UNIQUE constraint on tracker_id to allow many-to-many
-- ============================================================================
-- First, drop the existing unique constraint if it exists
DO $$
BEGIN
  -- Drop unique constraint on tracker_id if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'devices_tracker_id_key'
  ) THEN
    ALTER TABLE public.devices DROP CONSTRAINT devices_tracker_id_key;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Make name column NOT NULL (required field)
-- ============================================================================
ALTER TABLE public.devices
  ALTER COLUMN name SET NOT NULL;

-- ============================================================================
-- STEP 4: Add composite unique constraint for (user_id, tracker_id)
-- ============================================================================
-- This ensures one user can't link the same tracker twice
-- But allows multiple users to link the same tracker
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_user_tracker_unique 
  ON public.devices(user_id, tracker_id);

-- ============================================================================
-- STEP 5: Add index on (user_id, tracker_id) for faster lookups
-- ============================================================================
-- (Already exists via unique index above, but ensure it's there)
-- Additional index on tracker_id alone for reverse lookups
CREATE INDEX IF NOT EXISTS idx_devices_tracker_id_lookup 
  ON public.devices(tracker_id);

-- ============================================================================
-- STEP 6: Update RLS policy for live_locations to allow tracker existence check
-- ============================================================================
-- Add a policy that allows users to check if a tracker_id exists
-- This is read-only and doesn't expose location data
CREATE POLICY "Users can check tracker existence"
  ON public.live_locations FOR SELECT
  USING (
    -- Allow if user owns the location OR if just checking existence
    -- For existence checks, we'll use a function instead (see below)
    auth.uid() = user_id
  );

-- ============================================================================
-- STEP 7: Create secure function to check tracker existence
-- ============================================================================
-- This function allows checking if a tracker_id exists without exposing location data
CREATE OR REPLACE FUNCTION check_tracker_exists(p_tracker_id TEXT)
RETURNS TABLE (
  tracker_exists BOOLEAN,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE AS tracker_exists,
    ll.updated_at
  FROM public.live_locations ll
  WHERE ll.tracker_id = p_tracker_id
  LIMIT 1;
  
  -- If no rows found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE AS tracker_exists, NULL::TIMESTAMPTZ AS updated_at;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_tracker_exists(TEXT) TO authenticated;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. The 'trackers' table (from migration 004) is kept separate and is used
--    by the speed aggregation system. It is NOT used for device linking.
-- 2. Device linking uses live_locations.tracker_id as the source of truth.
-- 3. Many-to-many relationship: Multiple users can link the same tracker_id,
--    and one user can link multiple trackers.
-- 4. The composite unique constraint (user_id, tracker_id) prevents
--    duplicate links by the same user to the same tracker.
