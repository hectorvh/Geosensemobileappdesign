-- ============================================================================
-- GEOFENCES SECURITY HARDENING
-- ============================================================================
-- This migration ensures strict data protection for geofences:
-- 1. Enforce user_id NOT NULL constraint
-- 2. Strengthen RLS policies with WITH CHECK clauses
-- 3. Add composite index for user_id + id lookups
-- 4. Verify existing policies are correct

-- ============================================================================
-- STEP 1: Ensure user_id is NOT NULL
-- ============================================================================
-- Check if there are any NULL user_id values and handle them
DO $$
BEGIN
  -- If there are any geofences with NULL user_id, we need to handle them
  -- For now, we'll just ensure the constraint is set
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'geofences' 
    AND column_name = 'user_id' 
    AND is_nullable = 'YES'
  ) THEN
    -- First, delete any orphaned geofences (no user_id)
    -- This is safe because they can't be accessed anyway
    DELETE FROM public.geofences WHERE user_id IS NULL;
    
    -- Now add NOT NULL constraint
    ALTER TABLE public.geofences
      ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Drop and recreate RLS policies with WITH CHECK clauses
-- ============================================================================
-- This ensures both USING (for SELECT/UPDATE/DELETE) and WITH CHECK (for INSERT/UPDATE)
-- are properly enforced

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own geofences" ON public.geofences;
DROP POLICY IF EXISTS "Users can insert own geofences" ON public.geofences;
DROP POLICY IF EXISTS "Users can update own geofences" ON public.geofences;
DROP POLICY IF EXISTS "Users can delete own geofences" ON public.geofences;

-- Recreate with explicit WITH CHECK clauses

-- SELECT: Users can only view their own geofences
CREATE POLICY "Users can view own geofences"
  ON public.geofences FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can only insert geofences with their own user_id
CREATE POLICY "Users can insert own geofences"
  ON public.geofences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own geofences
-- USING: Check existing row ownership
-- WITH CHECK: Ensure updated row still belongs to user
CREATE POLICY "Users can update own geofences"
  ON public.geofences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can only delete their own geofences
CREATE POLICY "Users can delete own geofences"
  ON public.geofences FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 3: Add composite index for efficient user_id + id lookups
-- ============================================================================
-- This supports queries like: WHERE user_id = ? AND id = ?
CREATE INDEX IF NOT EXISTS idx_geofences_user_id_id 
  ON public.geofences(user_id, id);

-- ============================================================================
-- STEP 4: Verify RLS is enabled
-- ============================================================================
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- ============================================================================
-- Run these as different users to verify RLS works:
--
-- 1. As User A: SELECT * FROM geofences; -- Should only see User A's geofences
-- 2. As User B: SELECT * FROM geofences WHERE id = <User A's geofence id>; -- Should return 0 rows
-- 3. As User B: UPDATE geofences SET name = 'Hacked' WHERE id = <User A's geofence id>; -- Should affect 0 rows
-- 4. As User B: DELETE FROM geofences WHERE id = <User A's geofence id>; -- Should affect 0 rows
