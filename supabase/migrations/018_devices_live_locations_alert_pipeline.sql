-- ============================================================================
-- DEVICES / LIVE_LOCATIONS / ALERTS PIPELINE
-- ============================================================================
-- This migration wires live_locations updates into devices and alerts:
-- 1) Sync devices.geom and devices.last_update from live_locations.geom/updated_at
-- 2) Maintain devices.active based on recency of live_locations.updated_at (<= 60s)
-- 3) Create out_of_zone alerts when an active device is outside its owner's geofences
-- ============================================================================

-- ============================================================================
-- STEP 1: Add geom column to devices
-- ============================================================================
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS geom GEOMETRY(POINT, 4326);

COMMENT ON COLUMN public.devices.geom IS 'Last known location for this device (from live_locations.geom)';

-- last_update column already added by 010_update_devices_for_linking.sql
-- active column already exists from initial schema

-- Optional: spatial index for devices.geom
CREATE INDEX IF NOT EXISTS idx_devices_geom ON public.devices USING GIST (geom);

-- ============================================================================
-- STEP 2: Extend alerts schema for out_of_zone alerts
-- ============================================================================
-- Add resolved flag if it does not exist yet
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT false;

DO $$
DECLARE
  v_constraint_name TEXT;
  v_exists BOOLEAN;
BEGIN
  -- If our new constraint already exists, do nothing (migration is idempotent)
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.alerts'::regclass
      AND conname = 'alerts_type_alert_check'
  ) INTO v_exists;

  IF v_exists THEN
    RETURN;
  END IF;

  -- Find any existing CHECK constraint on type_alert (older version)
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.alerts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%type_alert%IN%';

  -- Drop the old constraint if found
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.alerts DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  -- Add new CHECK constraint including out_of_zone
  ALTER TABLE public.alerts
    ADD CONSTRAINT alerts_type_alert_check
    CHECK (type_alert IN ('Inactivity Detected', 'Out of Range', 'Low Battery', 'out_of_zone'));
END$$;

-- Prevent duplicate active out_of_zone alerts per device
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_unique_out_of_zone_active
  ON public.alerts(device_id, type_alert)
  WHERE active = true AND resolved = false AND type_alert = 'out_of_zone';

-- Optional composite index for querying by device_id / type_alert / resolved
CREATE INDEX IF NOT EXISTS idx_alerts_device_type_resolved
  ON public.alerts(device_id, type_alert, resolved);

-- ============================================================================
-- STEP 3: Trigger function to sync devices and create alerts
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_live_location_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync devices.geom, devices.last_update, and devices.active from live_locations
  UPDATE public.devices d
  SET
    geom = NEW.geom,
    last_update = NEW.updated_at,
    active = (NEW.updated_at >= (now() - interval '60 seconds'))
  WHERE d.tracker_id = NEW.tracker_id;

  -- Create out_of_zone alerts for active devices that are outside their owner's geofences
  INSERT INTO public.alerts (device_id, type_alert, active, resolved, created_at, updated_at)
  SELECT DISTINCT d.id, 'out_of_zone', true, false, now(), now()
  FROM public.devices d
  JOIN public.geofences g
    ON g.user_id = d.user_id
  WHERE d.tracker_id = NEW.tracker_id
    AND d.active = true
    AND d.geom IS NOT NULL
    AND g.boundary_inner IS NOT NULL
    AND ST_Disjoint(
          d.geom,
          ST_SetSRID(
            ST_GeomFromGeoJSON(g.boundary_inner::text),
            4326
          )
        )
    AND NOT EXISTS (
      SELECT 1 FROM public.alerts a
      WHERE a.device_id = d.id
        AND a.type_alert = 'out_of_zone'
        AND a.active = true
        AND a.resolved = false
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Attach trigger to live_locations
-- ============================================================================
DROP TRIGGER IF EXISTS trg_live_locations_devices_alerts ON public.live_locations;

CREATE TRIGGER trg_live_locations_devices_alerts
AFTER INSERT OR UPDATE ON public.live_locations
FOR EACH ROW
EXECUTE FUNCTION public.handle_live_location_update();

-- ============================================================================
-- NOTES
-- ============================================================================
-- - live_locations.geom is GEOMETRY(POINT, 4326) and updated by existing trigger
-- - devices.active is now DB-driven, based on last live_locations.updated_at (60s window)
-- - out_of_zone alerts are only created when:
--     * device is active
--     * device.geom is outside ALL geofences for that device.user_id
--     * AND no existing active, unresolved out_of_zone alert already exists
-- - RLS on devices, geofences, alerts, and live_locations is unchanged and
--   continues to enforce that users only see their own data.

