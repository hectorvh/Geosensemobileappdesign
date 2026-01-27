-- ============================================================================
-- ADD BOUNDARY_BUFFER_M COLUMN TO SETTINGS
-- ============================================================================
-- This migration adds a boundary_buffer_m column to the settings table
-- to store the Boundary Buffer distance in meters (0-50).
--
-- This value is controlled from the "Boundary Buffer" setting in customize-alerts.
-- - If toggle is OFF → value is 0
-- - If toggle is ON → value is slider value (0-50)
-- ============================================================================

-- ============================================================================
-- STEP 1: Add boundary_buffer_m column
-- ============================================================================
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS boundary_buffer_m INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- STEP 2: Add CHECK constraint to ensure value is between 0 and 50
-- ============================================================================
ALTER TABLE public.settings
  ADD CONSTRAINT check_boundary_buffer_m_range
  CHECK (boundary_buffer_m >= 0 AND boundary_buffer_m <= 50);

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================
COMMENT ON COLUMN public.settings.boundary_buffer_m IS 
  'Boundary buffer distance in meters (0-50). Controlled from customize-alerts screen. Value is 0 when toggle is OFF, slider value (0-50) when toggle is ON.';

-- ============================================================================
-- STEP 4: Verify RLS policies (should already exist from 002_rls_policies.sql)
-- ============================================================================
-- RLS policies for settings should already allow:
-- - SELECT: Users can read their own settings (auth.uid() = user_id)
-- - UPDATE: Users can update their own settings (auth.uid() = user_id)
-- - INSERT: Users can insert their own settings (auth.uid() = user_id)
--
-- Verify with:
-- SELECT * FROM pg_policies WHERE tablename = 'settings';
--
-- Expected policies:
-- - "Users can view own settings" FOR SELECT USING (auth.uid() = user_id)
-- - "Users can update own settings" FOR UPDATE USING (auth.uid() = user_id)
-- - "Users can insert own settings" FOR INSERT WITH CHECK (auth.uid() = user_id)
--
-- If policies don't exist, they should be created in 002_rls_policies.sql
