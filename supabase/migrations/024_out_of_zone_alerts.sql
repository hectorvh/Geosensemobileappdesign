-- ============================================================================
-- 024 - AUTOMATIC OUT-OF-ZONE ALERTS TRIGGER
-- ============================================================================
-- Goal: Implement automatic "out-of-zone" alert creation when active devices
--       are outside ALL of the user's geofences, triggered by live_locations updates.
--
-- CRITICAL RULES:
-- 1) DO NOT modify live_locations table (no ALTER TABLE, no PK changes, no RLS changes)
-- 2) Trigger must be defensive: never block ingestion, never throw exceptions
-- 3) Use PostGIS ST_Intersects for multi-geofence safety (device is OUT if NOT EXISTS intersection)
-- 4) Prevent duplicate active alerts using partial unique index + ON CONFLICT
-- ============================================================================

-- Ensure PostGIS extension is available
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- STEP 1: ENSURE DEVICES TABLE HAS REQUIRED COLUMNS
-- ============================================================================

-- Add devices.geom if missing (geometry Point, SRID 4326)
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS geom GEOMETRY(POINT, 4326);

-- Add devices.last_update if missing
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS last_update TIMESTAMPTZ;

-- Ensure devices.active exists (should already exist, but verify)
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT false;

-- Ensure devices.user_id is NOT NULL (if not already)
DO $$
BEGIN
  -- Only alter if column exists and is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'devices'
      AND column_name = 'user_id'
      AND is_nullable = 'YES'
  ) THEN
    -- First, set default for any NULL values (use a placeholder or skip)
    -- Then enforce NOT NULL
    ALTER TABLE public.devices
      ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- Ensure devices.tracker_id exists and matches live_locations.tracker_id type
-- (Should already exist, but verify it's TEXT to match live_locations)

-- ============================================================================
-- STEP 2: ENSURE ALERTS TABLE HAS REQUIRED COLUMNS
-- ============================================================================

-- Add alerts.user_id if missing
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Backfill alerts.user_id from devices.user_id where possible
UPDATE public.alerts a
SET user_id = d.user_id
FROM public.devices d
WHERE d.id = a.device_id
  AND a.user_id IS NULL;

-- Add FK to auth.users(id) if not exists
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
END $$;

-- Attempt to enforce NOT NULL on alerts.user_id if safe
DO $$
DECLARE
  v_has_nulls BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.alerts WHERE user_id IS NULL) INTO v_has_nulls;
  IF NOT v_has_nulls THEN
    -- Only set NOT NULL if no NULLs exist
    ALTER TABLE public.alerts
      ALTER COLUMN user_id SET NOT NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If column is already NOT NULL or other error, ignore
    NULL;
END $$;

-- Ensure alerts.type_alert CHECK constraint includes 'out' (or 'out_of_zone')
DO $$
BEGIN
  -- Check if constraint exists and includes 'out'
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alerts_type_alert_check'
      AND conrelid = 'public.alerts'::regclass
  ) THEN
    -- Check current constraint definition
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_get_constraintdef(c.oid) AS def ON true
      WHERE c.conname = 'alerts_type_alert_check'
        AND def LIKE '%out%'
    ) THEN
      -- Drop old constraint and recreate with 'out'
      ALTER TABLE public.alerts
        DROP CONSTRAINT alerts_type_alert_check;
      
      ALTER TABLE public.alerts
        ADD CONSTRAINT alerts_type_alert_check
        CHECK (type_alert IN ('Inactivity Detected', 'Out of Range', 'Low Battery', 'out', 'out_of_zone'));
    END IF;
  ELSE
    -- Create constraint if it doesn't exist
    ALTER TABLE public.alerts
      ADD CONSTRAINT alerts_type_alert_check
      CHECK (type_alert IN ('Inactivity Detected', 'Out of Range', 'Low Battery', 'out', 'out_of_zone'));
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If constraint already exists with different definition, try to handle gracefully
    RAISE NOTICE 'Could not update alerts_type_alert_check: %', SQLERRM;
END $$;

-- Ensure alerts.active exists (should already exist)
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Ensure alerts.created_at and updated_at exist
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ============================================================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index on devices.tracker_id (for FK and trigger lookups)
CREATE INDEX IF NOT EXISTS idx_devices_tracker_id
  ON public.devices(tracker_id);

-- Index on devices.user_id (for RLS and queries)
CREATE INDEX IF NOT EXISTS idx_devices_user_id
  ON public.devices(user_id);

-- Index on devices.geom (GiST for spatial queries)
CREATE INDEX IF NOT EXISTS idx_devices_geom
  ON public.devices USING GIST (geom);

-- Index on geofences.user_id (for trigger lookups)
CREATE INDEX IF NOT EXISTS idx_geofences_user_id
  ON public.geofences(user_id);

-- Index on geofences.boundary_inner (GiST for spatial queries)
CREATE INDEX IF NOT EXISTS idx_geofences_boundary_inner
  ON public.geofences USING GIST (boundary_inner);

-- ============================================================================
-- STEP 4: CREATE PARTIAL UNIQUE INDEX FOR ALERT DEDUPLICATION
-- ============================================================================
-- Prevents duplicate active "out" alerts for the same device

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_device_type_active
  ON public.alerts(device_id, type_alert)
  WHERE active = true;

-- ============================================================================
-- STEP 5: ENSURE FK FROM devices.tracker_id TO live_locations.tracker_id
-- ============================================================================
-- (Only allowed direction: devices → live_locations, NOT live_locations → devices)

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
END $$;

-- ============================================================================
-- STEP 6: CREATE TRIGGER FUNCTION FOR DEVICES SYNC + OUT-OF-ZONE ALERTS
-- ============================================================================
-- This function:
-- A) Syncs devices.geom, devices.last_update, devices.active from live_locations
-- B) Inserts "out" alerts when ACTIVE device is outside ALL user's geofences
-- C) Uses ST_Intersects with NOT EXISTS for multi-geofence safety
-- D) Never throws exceptions (defensive, ingestion-safe)

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
  -- (May affect 0, 1, or many rows due to many-to-many linking)
  UPDATE public.devices d
  SET
    last_update = NEW.updated_at,
    geom = NEW.geom,
    active = COALESCE(NEW.updated_at >= (now() - interval '1 minute'), false)
  WHERE d.tracker_id = NEW.tracker_id;

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
    d.active AS active,
    now() AS created_at,
    d.last_update AS updated_at
  FROM public.devices d
  WHERE d.tracker_id = NEW.tracker_id
    AND d.active = true
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
-- STEP 7: CREATE TRIGGER ON live_locations
-- ============================================================================
-- Attach trigger AFTER INSERT OR UPDATE (never BEFORE, to avoid blocking)

DROP TRIGGER IF EXISTS trg_live_locations_devices_alerts ON public.live_locations;

CREATE TRIGGER trg_live_locations_devices_alerts
  AFTER INSERT OR UPDATE ON public.live_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_live_location_update_devices_alerts();

-- ============================================================================
-- STEP 8: VERIFY RLS POLICIES (DO NOT MODIFY live_locations RLS)
-- ============================================================================
-- Ensure RLS is enabled on devices and alerts (if not already)

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies for devices and alerts should already exist from previous migrations.
-- This migration does NOT modify live_locations RLS (as per critical rule #1).

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- Verification checklist:
-- 1) Update live_locations for a tracker_id → devices fields sync correctly
-- 2) devices.active flips based on last_update recency (<= 1 minute)
-- 3) Out-of-zone update creates exactly one active alert (no duplicates)
-- 4) Different users linked to same tracker create alerts only for their own geofences
-- 5) Trigger never blocks live_locations ingestion (test with invalid data)
-- ============================================================================
