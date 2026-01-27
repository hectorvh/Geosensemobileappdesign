-- ============================================================================
-- VERIFY TUTORIAL_SEEN COLUMN AND RLS POLICIES
-- ============================================================================
-- This migration verifies that tutorial_seen column exists and RLS is properly
-- configured. The tutorial_seen column should already exist from migration 003.
--
-- Schema: profiles.id (UUID) = auth.users.id (primary key)
-- RLS: auth.uid() = id (users can only access their own profile)

-- ============================================================================
-- STEP 1: Ensure tutorial_seen column exists
-- ============================================================================
-- Column should already exist from 003_add_tutorial_seen.sql, but ensure it's there
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS tutorial_seen BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- STEP 2: Verify/Add comment
-- ============================================================================
COMMENT ON COLUMN public.profiles.tutorial_seen IS 
  'Whether the user has seen the tutorial screen. Used to skip tutorial on subsequent logins.';

-- ============================================================================
-- STEP 3: Verify RLS policies (should already exist from 002_rls_policies.sql)
-- ============================================================================
-- RLS policies for profiles should already allow:
-- - SELECT: Users can read their own profile (auth.uid() = id)
-- - UPDATE: Users can update their own profile (auth.uid() = id)
-- - INSERT: Users can insert their own profile (auth.uid() = id)
--
-- Verify with:
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';
--
-- Expected policies:
-- - "Users can view own profile" FOR SELECT USING (auth.uid() = id)
-- - "Users can update own profile" FOR UPDATE USING (auth.uid() = id)
-- - "Users can insert own profile" FOR INSERT WITH CHECK (auth.uid() = id)
--
-- If policies don't exist, they should be created in 002_rls_policies.sql
