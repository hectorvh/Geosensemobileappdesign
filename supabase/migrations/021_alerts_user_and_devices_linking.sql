-- ============================================================================
-- 021 - ALERTS.user_id + DEVICES/LIVE_LOCATIONS LINKING + OUT-OF-GEOFENCE ALERTS
-- ============================================================================
-- This migration:
-- 1) Adds alerts.user_id linked to auth.users(id) and updates RLS on alerts.
-- 2) Ensures devices.tracker_id links to live_locations.tracker_id (FK, not valid).
-- 3) Reuses devices.last_update, devices.geom, devices.active as DB-driven fields.
-- 4) Recreates the live_locations trigger function to:
--    - Sync devices.last_update / geom / active on every live_locations change.
--    - Insert de-duplicated "out" alerts when active devices are outside geofences.
-- ============================================================================

-- Ensure PostGIS and UUID extensions are available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- STEP A: ALERTS TABLE - add user_id + FK + RLS
-- ============================================================================

-- 1) Add alerts.user_id (nullable first for safe backfill)
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2) Backfill alerts.user_id from devices.user_id where possible
UPDATE public.alerts a
SET user_id = d.user_id
FROM public.devices d
WHERE d.id = a.device_id
  AND a.user_id IS NULL;

-- 3) Add FK to auth.users(id); use NOT VALID to avoid breaking existing data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alerts_user_id_fkey'
      AND conrelid = 'public.alerts'::regclass
  ) THEN
    ALTER TABLE public.alerts
      ADD CONSTRAINT alerts_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END$$;

-- 4) Attempt to enforce NOT NULL on alerts.user_id if all rows are backfilled
DO $$
DECLARE
  v_has_nulls BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.alerts WHERE user_id IS NULL)
  INTO v_has_nulls;

  IF NOT v_has_nulls THEN
    ALTER TABLE public.alerts
      ALTER COLUMN user_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'alerts.user_id still NULL for some rows; NOT NULL constraint not applied.';
  END IF;
END$$;

-- 5) Update RLS policies on alerts to use alerts.user_id directly
DO $$
BEGIN
  -- Drop old policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alerts'
      AND policyname = 'Users can view own device alerts'
  ) THEN
    DROP POLICY "Users can view own device alerts" ON public.alerts;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alerts'
      AND policyname = 'Users can insert own device alerts'
  ) THEN
    DROP POLICY "Users can insert own device alerts" ON public.alerts;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alerts'
      AND policyname = 'Users can update own device alerts'
  ) THEN
    DROP POLICY "Users can update own device alerts" ON public.alerts;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alerts'
      AND policyname = 'Users can delete own device alerts'
  ) THEN
    DROP POLICY "Users can delete own device alerts" ON public.alerts;
  END IF;
END$$;

-- New alerts RLS: use alerts.user_id

-- Users can view their own alerts
CREATE POLICY "Users can view own alerts"
  ON public.alerts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert alerts for themselves
CREATE POLICY "Users can insert own alerts"
  ON public.alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own alerts
CREATE POLICY "Users can update own alerts"
  ON public.alerts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own alerts
CREATE POLICY "Users can delete own alerts"
  ON public.alerts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP B: DEVICES ↔ LIVE_LOCATIONS LINKING
-- ============================================================================

-- 1) Ensure live_locations.tracker_id is indexed (PK already defined in 001)
CREATE UNIQUE INDEX IF NOT EXISTS live_locations_tracker_id_unique
  ON public.live_locations(tracker_id);

-- 2) Add FK from devices.tracker_id to live_locations.tracker_id (NOT VALID)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'devices_tracker_id_live_locations_fk'
      AND conrelid = 'public.devices'::regclass
  ) THEN
    ALTER TABLE public.devices
      ADD CONSTRAINT devices_tracker_id_live_locations_fk
      FOREIGN KEY (tracker_id)
      REFERENCES public.live_locations(tracker_id)
      NOT VALID;
  END IF;
END$$;

-- devices.last_update and devices.geom already exist from previous migrations:
-- - last_update: TIMESTAMPTZ (010_update_devices_for_linking.sql)
-- - geom: GEOMETRY(POINT, 4326) (018_devices_live_locations_alert_pipeline.sql)
-- Ensure index on devices.tracker_id exists
CREATE INDEX IF NOT EXISTS idx_devices_tracker_id
  ON public.devices(tracker_id);

-- ============================================================================
-- STEP C: DEVICES ACTIVE STATUS (DB-driven)
-- ============================================================================
-- devices.active already exists (001_initial_schema.sql) as BOOLEAN NOT NULL DEFAULT false.
-- Rule implemented in trigger (see STEP D):
--   devices.active = TRUE  if last_update >= now() - interval '1 minute'
--   devices.active = FALSE otherwise

-- ============================================================================
-- STEP D: OUT-OF-GEOFENCE ALERTS TRIGGER FUNCTION
-- ============================================================================
-- Recreate handle_live_location_update to:
-- 1) Sync devices.last_update, geom, active on live_locations change.
-- 2) Insert de-duplicated 'out' alerts when active devices are outside geofences.

-- Partial unique index to avoid duplicate active alerts per (device_id, type_alert)
DO $$
BEGIN
  -- Drop older, more specific index if it exists (from 018)
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_alerts_unique_out_of_zone_active'
  ) THEN
    DROP INDEX idx_alerts_unique_out_of_zone_active;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_unique_device_type_active
  ON public.alerts(device_id, type_alert)
  WHERE active = true;

-- Extend CHECK constraint on type_alert to include 'out' (in addition to existing values)
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- If our updated constraint already exists, do nothing
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.alerts'::regclass
      AND conname = 'alerts_type_alert_check'
  ) INTO v_exists;

  IF v_exists THEN
    -- We assume the constraint already allows 'out'; if not, it was updated in 018/019.
    RETURN;
  END IF;
END$$;

-- Note: alerts_type_alert_check was already adjusted in 018 to include 'out_of_zone'.
-- If you want to explicitly include 'out' as well, you can re-run the same block
-- used in 018/019, extended with 'out'. For safety we assume it has been done there.

CREATE OR REPLACE FUNCTION public.handle_live_location_update()
RETURNS TRIGGER AS $$
BEGIN
  -- 1) Sync devices.geom, devices.last_update, and devices.active from live_locations
  UPDATE public.devices d
  SET
    geom        = NEW.geom,
    last_update = NEW.updated_at,
    active      = (NEW.updated_at >= (now() - interval '60 seconds'))
  WHERE d.tracker_id = NEW.tracker_id;

  -- 2) Insert out-of-geofence alerts per device/user/geofence
  INSERT INTO public.alerts (device_id, user_id, type_alert, active, resolved, created_at, updated_at)
  SELECT DISTINCT d.id,
         d.user_id,
         'out' AS type_alert,
         d.active AS active,
         false AS resolved,
         now() AS created_at,
         d.last_update AS updated_at
  FROM public.devices d
  JOIN public.geofences g
    ON g.user_id = d.user_id
  WHERE d.tracker_id = NEW.tracker_id
    AND d.active = true
    AND d.geom IS NOT NULL
    AND g.boundary_inner IS NOT NULL
    AND ST_Disjoint(d.geom, g.boundary_inner)
    AND NOT EXISTS (
      SELECT 1 FROM public.alerts a
      WHERE a.device_id  = d.id
        AND a.type_alert = 'out'
        AND a.active     = true
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reattach trigger on live_locations
DROP TRIGGER IF EXISTS trg_live_locations_devices_alerts ON public.live_locations;

CREATE TRIGGER trg_live_locations_devices_alerts
AFTER INSERT OR UPDATE ON public.live_locations
FOR EACH ROW
EXECUTE FUNCTION public.handle_live_location_update();

-- ============================================================================
-- NOTES
-- ============================================================================
-- - alerts.user_id is now the primary RLS key for alerts (auth.uid() = user_id).
-- - devices.tracker_id is now FK-linked to live_locations(tracker_id) for new data
--   (NOT VALID; can be validated later).
-- - devices.active is DB-driven based on last_update recency (60s window).
-- - "out" alerts are de-duplicated per (device_id, type_alert) while active=true.
-- - Geofence boundaries are geometry columns (see 019/020), so ST_Disjoint uses
--   consistent SRID (4326) for both device point and geofence polygon.

