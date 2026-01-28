-- ============================================================================
-- 025 - DEVICES ACTIVE (30s) + AUTOMATIC ALERT CLEARING (5s inside)
-- ============================================================================
-- Goal:
-- 1) Set devices.active = TRUE immediately on live_locations update
-- 2) Set devices.active = FALSE via scheduled job when last_update > 30s old
-- 3) Clear out-of-zone alerts when device returns inside geofence for 5+ seconds
--
-- CRITICAL RULES:
-- 1) DO NOT modify live_locations table (no ALTER, no FK, no RLS changes)
-- 2) Triggers must never block ingestion; always RETURN NEW
-- 3) Use scheduled jobs (pg_cron) for time-based decay and alert clearing
-- ============================================================================

-- Ensure PostGIS extension is available
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- STEP 1: ENSURE DEVICES COLUMNS EXIST
-- ============================================================================

-- devices.last_update (should already exist from 018/024)
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS last_update TIMESTAMPTZ;

-- devices.active (should already exist from initial schema)
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT false;

-- devices.geom (should already exist from 018/024)
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS geom GEOMETRY(POINT, 4326);

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_devices_tracker_id
  ON public.devices(tracker_id);

CREATE INDEX IF NOT EXISTS idx_devices_user_id
  ON public.devices(user_id);

CREATE INDEX IF NOT EXISTS idx_devices_geom
  ON public.devices USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_devices_last_update
  ON public.devices(last_update);

-- ============================================================================
-- STEP 2: ADD alerts.clear_candidate_at COLUMN
-- ============================================================================

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS clear_candidate_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.alerts.clear_candidate_at IS
  'Timestamp when device returned inside geofence (for out-of-zone alerts). Alert is deleted if this timestamp is >= 5 seconds old and device still inside.';

-- Index for efficient querying of candidates for deletion
CREATE INDEX IF NOT EXISTS idx_alerts_clear_candidate
  ON public.alerts(clear_candidate_at)
  WHERE clear_candidate_at IS NOT NULL AND active = true;

-- ============================================================================
-- STEP 3: UPDATE TRIGGER FUNCTION FOR DEVICES SYNC + ALERT CLEAR CANDIDATE
-- ============================================================================
-- This function:
-- A) Syncs devices.geom, devices.last_update, sets devices.active = TRUE immediately
-- B) Inserts "out" alerts when ACTIVE device is outside ALL user's geofences
-- C) Sets/resets alerts.clear_candidate_at based on whether device is inside geofence

CREATE OR REPLACE FUNCTION public.handle_live_location_update_devices_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  -- ========================================================================
  -- A) SYNC DEVICES FIELDS FROM live_locations
  -- ========================================================================
  -- Update all devices rows linked to this tracker_id
  -- Set active = TRUE immediately (scheduled job will set FALSE after 30s)
  UPDATE public.devices d
  SET
    last_update = NEW.updated_at,
    geom = NEW.geom,  -- Use real position from live_locations.geom (no computation)
    active = true  -- Set TRUE immediately on update
  WHERE d.tracker_id = NEW.tracker_id
    AND NEW.geom IS NOT NULL;  -- Only update when real geometry is available

  -- ========================================================================
  -- B) INSERT OUT-OF-ZONE ALERTS FOR ACTIVE DEVICES
  -- ========================================================================
  -- Logic:
  -- - Device is OUT if it does NOT intersect ANY of the user's geofences
  -- - Only create alerts if user actually has geofences
  -- - Use ON CONFLICT DO NOTHING to prevent duplicates
  
  INSERT INTO public.alerts (device_id, user_id, type_alert, active, created_at, updated_at)
  SELECT DISTINCT
    d.id AS device_id,
    d.user_id AS user_id,
    'out' AS type_alert,
    true AS active,  -- Device is active (just updated)
    now() AS created_at,
    d.last_update AS updated_at
  FROM public.devices d
  WHERE d.tracker_id = NEW.tracker_id
    AND d.geom IS NOT NULL
    AND d.user_id IS NOT NULL
    -- Only create alerts if user has at least one geofence
    AND EXISTS (
      SELECT 1 FROM public.geofences g
      WHERE g.user_id = d.user_id
        AND g.boundary_inner IS NOT NULL
    )
    -- Device is OUT if it does NOT intersect ANY of the user's geofences
    AND NOT EXISTS (
      SELECT 1 FROM public.geofences g
      WHERE g.user_id = d.user_id
        AND g.boundary_inner IS NOT NULL
        AND ST_Intersects(d.geom, g.boundary_inner)
    )
    -- Prevent duplicate active alerts
    AND NOT EXISTS (
      SELECT 1 FROM public.alerts a
      WHERE a.device_id = d.id
        AND a.type_alert = 'out'
        AND a.active = true
    )
  ON CONFLICT (device_id, type_alert) WHERE active = true
  DO NOTHING;

  -- ========================================================================
  -- C) SET/RESET clear_candidate_at FOR OUT-OF-ZONE ALERTS
  -- ========================================================================
  -- For each device linked to this tracker:
  -- - If device is INSIDE any geofence: set clear_candidate_at = now() (if NULL)
  -- - If device is OUTSIDE all geofences: reset clear_candidate_at = NULL
  
  DO $$
  DECLARE
    d_rec RECORD;
    inside_any_zone BOOLEAN;
  BEGIN
    FOR d_rec IN
      SELECT d.id, d.user_id, d.geom
      FROM public.devices d
      WHERE d.tracker_id = NEW.tracker_id
        AND d.geom IS NOT NULL
        AND d.user_id IS NOT NULL
    LOOP
      -- Check if device intersects ANY geofence owned by the same user
      SELECT EXISTS (
        SELECT 1
        FROM public.geofences g
        WHERE g.user_id = d_rec.user_id
          AND g.boundary_inner IS NOT NULL
          AND ST_Intersects(d_rec.geom, g.boundary_inner)
      ) INTO inside_any_zone;

      IF inside_any_zone THEN
        -- Device is inside: set clear_candidate_at if not already set
        UPDATE public.alerts
        SET clear_candidate_at = COALESCE(clear_candidate_at, now())
        WHERE device_id = d_rec.id
          AND type_alert IN ('out', 'out_of_zone', 'Out of Range')
          AND active = true
          AND clear_candidate_at IS NULL;
      ELSE
        -- Device is outside: reset clear_candidate_at (timer must restart)
        UPDATE public.alerts
        SET clear_candidate_at = NULL
        WHERE device_id = d_rec.id
          AND type_alert IN ('out', 'out_of_zone', 'Out of Range')
          AND active = true;
      END IF;
    END LOOP;
  END $$;

  -- Always return NEW to allow live_locations insert/update to proceed
  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- CRITICAL: Never block live_locations ingestion
    -- Log error but always return NEW
    RAISE NOTICE 'handle_live_location_update_devices_alerts error: %', SQLERRM;
    RETURN NEW;
END;
$func$;

-- ============================================================================
-- STEP 4: CREATE SCHEDULED JOB FUNCTIONS
-- ============================================================================

-- Function to set devices.active = FALSE for devices not updated in 30+ seconds
CREATE OR REPLACE FUNCTION public.job_set_devices_inactive()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.devices
  SET active = false
  WHERE active = true
    AND last_update IS NOT NULL
    AND last_update < (now() - interval '30 seconds');
END;
$$;

-- Function to delete alerts that have been inside geofence for 5+ seconds
CREATE OR REPLACE FUNCTION public.job_clear_out_of_zone_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete alerts where:
  -- 1) clear_candidate_at is set and >= 5 seconds old
  -- 2) Device still intersects a geofence (safety check)
  -- 3) Alert is active and type is out-of-zone
  DELETE FROM public.alerts a
  USING public.devices d
  WHERE a.device_id = d.id
    AND a.type_alert IN ('out', 'out_of_zone', 'Out of Range')
    AND a.active = true
    AND a.clear_candidate_at IS NOT NULL
    AND a.clear_candidate_at <= (now() - interval '5 seconds')
    -- Safety check: ensure device still intersects a geofence
    AND EXISTS (
      SELECT 1
      FROM public.geofences g
      WHERE g.user_id = d.user_id
        AND g.boundary_inner IS NOT NULL
        AND d.geom IS NOT NULL
        AND ST_Intersects(d.geom, g.boundary_inner)
    );
END;
$$;

-- ============================================================================
-- STEP 5: SET UP SCHEDULED JOBS (pg_cron)
-- ============================================================================
-- Note: pg_cron must be enabled in Supabase project settings.
-- If pg_cron is not available, these jobs can be called via Supabase Edge Functions
-- scheduled to run every 10s and 5s respectively.

-- Enable pg_cron extension (if available)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_cron extension not available. Scheduled jobs must be set up manually via Supabase Dashboard → Database → Cron Jobs or Edge Functions.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not enable pg_cron: %', SQLERRM;
END $$;

-- Schedule job to set devices inactive (every 10 seconds)
DO $$
BEGIN
  -- Drop existing job if it exists
  PERFORM cron.unschedule('set-devices-inactive');
  
  -- Schedule new job (use unique dollar-quote tag to avoid nesting conflict)
  PERFORM cron.schedule(
    'set-devices-inactive',
    '*/10 * * * * *',  -- Every 10 seconds
    $job1$SELECT public.job_set_devices_inactive()$job1$
  );
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available. To enable scheduled jobs:';
    RAISE NOTICE '1) Enable pg_cron in Supabase Dashboard → Database → Extensions';
    RAISE NOTICE '2) Or create Supabase Edge Functions that call job_set_devices_inactive() and job_clear_out_of_zone_alerts()';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule set-devices-inactive job: %', SQLERRM;
END $$;

-- Schedule job to clear out-of-zone alerts (every 5 seconds)
DO $$
BEGIN
  -- Drop existing job if it exists
  PERFORM cron.unschedule('clear-out-of-zone-alerts');
  
  -- Schedule new job (use unique dollar-quote tag to avoid nesting conflict)
  PERFORM cron.schedule(
    'clear-out-of-zone-alerts',
    '*/5 * * * * *',  -- Every 5 seconds
    $job2$SELECT public.job_clear_out_of_zone_alerts()$job2$
  );
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available. To enable scheduled jobs:';
    RAISE NOTICE '1) Enable pg_cron in Supabase Dashboard → Database → Extensions';
    RAISE NOTICE '2) Or create Supabase Edge Functions that call job_set_devices_inactive() and job_clear_out_of_zone_alerts()';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule clear-out-of-zone-alerts job: %', SQLERRM;
END $$;

-- ============================================================================
-- STEP 6: VERIFICATION CHECKLIST
-- ============================================================================
-- After running this migration, verify:
--
-- 1) live_locations update sets devices.active = TRUE immediately:
--    UPDATE live_locations SET updated_at = now() WHERE tracker_id = 'test';
--    SELECT active, last_update FROM devices WHERE tracker_id = 'test';
--    -- Should show active = true, last_update = current time
--
-- 2) After 30s without updates, scheduled job flips devices.active to FALSE:
--    -- Wait 30+ seconds, then check:
--    SELECT active FROM devices WHERE tracker_id = 'test';
--    -- Should show active = false (if job ran)
--
-- 3) When device returns inside a geofence, clear_candidate_at is set:
--    -- Move device inside geofence (update live_locations with geom inside boundary)
--    SELECT clear_candidate_at FROM alerts WHERE device_id = (SELECT id FROM devices WHERE tracker_id = 'test');
--    -- Should show a timestamp
--
-- 4) If device stays inside >= 5s, alert row is deleted:
--    -- Wait 5+ seconds, then check:
--    SELECT COUNT(*) FROM alerts WHERE device_id = (SELECT id FROM devices WHERE tracker_id = 'test');
--    -- Should be 0 (alert deleted)
--
-- 5) If device leaves before 5s, clear_candidate_at resets and alert is NOT deleted:
--    -- Move device outside geofence before 5s elapse
--    SELECT clear_candidate_at FROM alerts WHERE device_id = (SELECT id FROM devices WHERE tracker_id = 'test');
--    -- Should be NULL
--    SELECT COUNT(*) FROM alerts WHERE device_id = (SELECT id FROM devices WHERE tracker_id = 'test');
--    -- Should be 1 (alert still exists)
--
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
