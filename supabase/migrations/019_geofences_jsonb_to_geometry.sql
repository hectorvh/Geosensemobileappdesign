-- ============================================================================
-- 019 - GEOFENCES JSONB → GEOMETRY MIGRATION
-- ============================================================================
-- Goal:
-- - Migrate geofences.boundary_inner / boundary_outer from JSONB GeoJSON
--   to real PostGIS geometry columns (MultiPolygon, 4326)
-- - Keep existing app behavior:
--   * boundary_inner: valid, simple polygon
--   * boundary_outer: buffered version of inner, or same as inner when buffer_m = 0
-- - Keep JSONB columns around (renamed *_jsonb) for safety, but stop using them
-- - Update buffer RPC + alert trigger function to use geometry columns
-- ============================================================================

-- ============================================================================
-- STEP 1: Add new geometry columns (MultiPolygon, 4326)
-- ============================================================================
ALTER TABLE public.geofences
  ADD COLUMN IF NOT EXISTS boundary_inner_geom GEOMETRY(MultiPolygon, 4326),
  ADD COLUMN IF NOT EXISTS boundary_outer_geom GEOMETRY(MultiPolygon, 4326);

COMMENT ON COLUMN public.geofences.boundary_inner_geom IS
  'Inner geofence boundary as MultiPolygon geometry (SRID 4326).';

COMMENT ON COLUMN public.geofences.boundary_outer_geom IS
  'Outer/buffered geofence boundary as MultiPolygon geometry (SRID 4326).';

-- ============================================================================
-- STEP 2: Backfill geometry columns from existing JSONB GeoJSON
-- ============================================================================
-- Assumes boundary_inner / boundary_outer currently store valid GeoJSON Polygon.
-- We convert to geometry, set SRID=4326, and wrap as MultiPolygon.

-- Backfill boundary_inner_geom
UPDATE public.geofences
SET boundary_inner_geom = ST_Multi(
  ST_SetSRID(
    ST_GeomFromGeoJSON(boundary_inner::text),
    4326
  )
)
WHERE boundary_inner IS NOT NULL
  AND boundary_inner_geom IS NULL;

-- Backfill boundary_outer_geom (if any)
UPDATE public.geofences
SET boundary_outer_geom = ST_Multi(
  ST_SetSRID(
    ST_GeomFromGeoJSON(boundary_outer::text),
    4326
  )
)
WHERE boundary_outer IS NOT NULL
  AND boundary_outer_geom IS NULL;

-- ============================================================================
-- STEP 3: Add validity / simplicity / SRID / type constraints
-- ============================================================================

-- Inner boundary: must be present, valid, simple MultiPolygon/Polygon in SRID 4326
ALTER TABLE public.geofences
  ADD CONSTRAINT geofences_boundary_inner_geom_valid
  CHECK (
    boundary_inner_geom IS NOT NULL
    AND ST_IsValid(boundary_inner_geom)
    AND ST_IsSimple(boundary_inner_geom)
    AND GeometryType(boundary_inner_geom) IN ('MULTIPOLYGON', 'POLYGON')
    AND ST_SRID(boundary_inner_geom) = 4326
  );

-- Outer boundary: when present, must also be valid/simple MultiPolygon/Polygon in SRID 4326
ALTER TABLE public.geofences
  ADD CONSTRAINT geofences_boundary_outer_geom_valid
  CHECK (
    boundary_outer_geom IS NULL
    OR (
      ST_IsValid(boundary_outer_geom)
      AND ST_IsSimple(boundary_outer_geom)
      AND GeometryType(boundary_outer_geom) IN ('MULTIPOLYGON', 'POLYGON')
      AND ST_SRID(boundary_outer_geom) = 4326
    )
  );

-- Ensure boundary_inner_geom is NOT NULL after backfill
ALTER TABLE public.geofences
  ALTER COLUMN boundary_inner_geom SET NOT NULL;

-- ============================================================================
-- STEP 4: Add spatial indexes on geometry columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_geofences_boundary_inner_geom
  ON public.geofences USING GIST (boundary_inner_geom);

CREATE INDEX IF NOT EXISTS idx_geofences_boundary_outer_geom
  ON public.geofences USING GIST (boundary_outer_geom);

-- ============================================================================
-- STEP 5: Rename columns – geometry becomes canonical, JSONB kept as *_jsonb
-- ============================================================================
-- We keep JSONB copies for safety / debugging, but stop using them in code.

-- Rename old JSONB columns
ALTER TABLE public.geofences
  RENAME COLUMN boundary_inner TO boundary_inner_jsonb;

ALTER TABLE public.geofences
  RENAME COLUMN boundary_outer TO boundary_outer_jsonb;

-- Rename geometry columns to canonical names
ALTER TABLE public.geofences
  RENAME COLUMN boundary_inner_geom TO boundary_inner;

ALTER TABLE public.geofences
  RENAME COLUMN boundary_outer_geom TO boundary_outer;

-- Update comments to reflect new types
COMMENT ON COLUMN public.geofences.boundary_inner IS
  'Inner geofence boundary as MultiPolygon geometry (SRID 4326).';

COMMENT ON COLUMN public.geofences.boundary_outer IS
  'Outer/buffered geofence boundary as MultiPolygon geometry (SRID 4326).';

COMMENT ON COLUMN public.geofences.boundary_inner_jsonb IS
  'LEGACY: Inner boundary stored as GeoJSON Polygon in JSONB (no longer used).';

COMMENT ON COLUMN public.geofences.boundary_outer_jsonb IS
  'LEGACY: Outer boundary stored as GeoJSON Polygon in JSONB (no longer used).';

-- Re-create spatial indexes on the renamed geometry columns (idempotent)
CREATE INDEX IF NOT EXISTS idx_geofences_boundary_inner_geom
  ON public.geofences USING GIST (boundary_inner);

CREATE INDEX IF NOT EXISTS idx_geofences_boundary_outer_geom
  ON public.geofences USING GIST (boundary_outer);

-- ============================================================================
-- STEP 6: Update update_geofence_buffer() to use geometry columns
-- ============================================================================
-- Signature stays the same so frontend RPC calls continue to work:
--   update_geofence_buffer(p_geofence_id BIGINT, p_buffer_m INTEGER, p_user_id UUID)
-- Returns JSONB GeoJSON for boundary_outer for UI convenience,
-- but stores geometry in geofences.boundary_outer.

CREATE OR REPLACE FUNCTION update_geofence_buffer(
  p_geofence_id BIGINT,
  p_buffer_m INTEGER,
  p_user_id UUID
)
RETURNS TABLE (
  id BIGINT,
  buffer_m INTEGER,
  boundary_outer JSONB
) AS $$
DECLARE
  v_geom_inner GEOMETRY;
  v_geom_outer GEOMETRY;
BEGIN
  -- Validate buffer_m range
  IF p_buffer_m < 0 OR p_buffer_m > 50 THEN
    RAISE EXCEPTION 'Buffer distance must be between 0 and 50 meters';
  END IF;

  -- Fetch the geofence geometry and verify ownership
  SELECT g.boundary_inner INTO v_geom_inner
  FROM public.geofences g
  WHERE g.id = p_geofence_id
    AND g.user_id = p_user_id;

  IF v_geom_inner IS NULL THEN
    RAISE EXCEPTION 'Geofence not found or you do not have permission to update it';
  END IF;

  -- Compute boundary_outer based on buffer_m
  IF p_buffer_m > 0 THEN
    -- Buffer using geography cast to ensure meters are used correctly
    v_geom_outer := ST_Buffer(v_geom_inner::geography, p_buffer_m)::geometry;
  ELSE
    -- If buffer_m = 0, boundary_outer = boundary_inner (exact copy)
    v_geom_outer := v_geom_inner;
  END IF;

  -- Normalize outer geometry to MultiPolygon, SRID 4326
  v_geom_outer := ST_Multi(
    ST_SetSRID(
      ST_CollectionExtract(ST_MakeValid(v_geom_outer), 3),
      4326
    )
  );

  -- Update the geofence geometry
  UPDATE public.geofences g
  SET 
    buffer_m = p_buffer_m,
    boundary_outer = v_geom_outer,
    updated_at = now()
  WHERE g.id = p_geofence_id
    AND g.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Update failed: geofence not found or permission denied';
  END IF;

  -- Return updated values, with boundary_outer as GeoJSON JSONB for UI
  RETURN QUERY
  SELECT 
    g.id AS id,
    g.buffer_m AS buffer_m,
    ST_AsGeoJSON(g.boundary_outer)::jsonb AS boundary_outer
  FROM public.geofences g
  WHERE g.id = p_geofence_id
    AND g.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_geofence_buffer(BIGINT, INTEGER, UUID) TO authenticated;

COMMENT ON FUNCTION update_geofence_buffer IS 
  'Updates geofence buffer_m and boundary_outer geometry. Uses PostGIS geography cast for accurate meter-based buffering and returns GeoJSON for UI.';

-- ============================================================================
-- STEP 7: Update handle_live_location_update() to use geometry boundaries
-- ============================================================================
-- This function was originally defined in 018_devices_live_locations_alert_pipeline.sql.
-- We re-create it here so that it now uses geofences.boundary_inner geometry
-- instead of JSONB GeoJSON.

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
    AND ST_Disjoint(d.geom, g.boundary_inner)
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

-- Trigger should already exist; keep name but ensure it points to updated function
DROP TRIGGER IF EXISTS trg_live_locations_devices_alerts ON public.live_locations;

CREATE TRIGGER trg_live_locations_devices_alerts
AFTER INSERT OR UPDATE ON public.live_locations
FOR EACH ROW
EXECUTE FUNCTION public.handle_live_location_update();

-- ============================================================================
-- NOTES
-- ============================================================================
-- - JSONB columns boundary_inner_jsonb / boundary_outer_jsonb are kept as legacy
--   but no longer used by application logic. Geometry columns are now canonical.
-- - Frontend continues to send/receive GeoJSON shapes; PostgREST + PostGIS
--   automatically cast GeoJSON to geometry and serialize geometry back to GeoJSON.
-- - RLS policies on geofences are unchanged and continue to restrict access
--   by user_id.

