-- ============================================================================
-- SETTINGS BOOLEAN COLUMNS MIGRATION
-- ============================================================================
-- This migration adds boolean columns for inactivity and low battery alerts
-- and migrates existing data from numeric columns to booleans
--
-- Note: Column names match requirement exactly: enable_inactiviy (with typo)
-- ============================================================================

-- ============================================================================
-- STEP 1: Add new boolean columns with defaults
-- ============================================================================
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS enable_inactiviy BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_low_battery BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- STEP 2: Migrate existing data
-- ============================================================================
-- For enable_inactiviy:
--   - If inactivity_minutes exists and is NOT NULL and > 0, set enable_inactiviy = true
--   - Otherwise, set enable_inactiviy = false
UPDATE public.settings
SET enable_inactiviy = CASE
  WHEN inactivity_minutes IS NOT NULL AND inactivity_minutes > 0 THEN true
  ELSE false
END
WHERE enable_inactiviy = false; -- Only update if still at default

-- For enable_low_battery:
--   - If low_battery_threshold exists and is NOT NULL, set enable_low_battery = true
--   - Otherwise, set enable_low_battery = false
UPDATE public.settings
SET enable_low_battery = CASE
  WHEN low_battery_threshold IS NOT NULL THEN true
  ELSE false
END
WHERE enable_low_battery = false; -- Only update if still at default

-- ============================================================================
-- STEP 3: Add comments
-- ============================================================================
COMMENT ON COLUMN public.settings.enable_inactiviy IS 
  'Enable inactivity alerts (boolean). Note: column name matches requirement exactly.';
COMMENT ON COLUMN public.settings.enable_low_battery IS 
  'Enable low battery alerts (boolean)';

-- ============================================================================
-- NOTES
-- ============================================================================
-- Old columns (inactivity_minutes, low_battery_threshold) are kept for now
-- but should not be used by new code. They can be dropped in a future migration
-- after confirming all code has been updated.
--
-- RLS policies on settings table already ensure users can only access their own settings.
