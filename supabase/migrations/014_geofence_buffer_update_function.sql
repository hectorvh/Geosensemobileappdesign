-- ============================================================================
-- GEOFENCE BUFFER UPDATE FUNCTION
-- ============================================================================
-- This function safely updates geofence buffer_m and boundary_outer
-- Uses PostGIS geography cast to ensure meters are used correctly
-- (boundary_inner is stored as JSONB GeoJSON, needs conversion to geometry)

-- ============================================================================
-- FUNCTION: update_geofence_buffer
-- ============================================================================
-- Parameters:
--   p_geofence_id: The ID of the geofence to update
--   p_buffer_m: Buffer distance in meters (0-50)
--   p_user_id: Current user ID (for RLS verification)
--
-- Behavior:
--   - If p_buffer_m > 0: Sets buffer_m and computes boundary_outer using ST_Buffer
--   - If p_buffer_m = 0: Sets buffer_m = 0 and boundary_outer = boundary_inner
--
-- Security:
--   - Verifies geofence belongs to p_user_id (RLS also enforces this)
--   - Returns error if geofence not found or not owned by user
--
-- Returns:
--   - Updated geofence record (buffer_m, boundary_outer)
--   - Error if geofence not found or permission denied
-- ============================================================================

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
  v_boundary_inner JSONB;
  v_boundary_outer JSONB;
  v_geom_inner GEOMETRY;
  v_geom_outer GEOMETRY;
BEGIN
  -- Validate buffer_m range
  IF p_buffer_m < 0 OR p_buffer_m > 50 THEN
    RAISE EXCEPTION 'Buffer distance must be between 0 and 50 meters';
  END IF;

  -- Fetch the geofence and verify ownership
  SELECT g.boundary_inner INTO v_boundary_inner
  FROM public.geofences g
  WHERE g.id = p_geofence_id
    AND g.user_id = p_user_id;

  -- Check if geofence exists and belongs to user
  IF v_boundary_inner IS NULL THEN
    RAISE EXCEPTION 'Geofence not found or you do not have permission to update it';
  END IF;

  -- Convert JSONB GeoJSON to PostGIS geometry
  -- boundary_inner is stored as GeoJSON Polygon in JSONB
  BEGIN
    v_geom_inner := ST_SetSRID(ST_GeomFromGeoJSON(v_boundary_inner::text), 4326);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid boundary_inner geometry: %', SQLERRM;
  END;

  -- Compute boundary_outer based on buffer_m
  IF p_buffer_m > 0 THEN
    -- Buffer using geography cast to ensure meters are used correctly
    -- ST_Buffer on geography uses meters, then cast back to geometry
    v_geom_outer := ST_Buffer(v_geom_inner::geography, p_buffer_m)::geometry;
  ELSE
    -- If buffer_m = 0, boundary_outer = boundary_inner (exact copy)
    v_geom_outer := v_geom_inner;
  END IF;

  -- Convert geometry back to GeoJSON JSONB
  v_boundary_outer := ST_AsGeoJSON(v_geom_outer)::jsonb;

  -- Update the geofence
  -- Use explicit table alias to avoid any ambiguity
  UPDATE public.geofences g
  SET 
    buffer_m = p_buffer_m,
    boundary_outer = v_boundary_outer,
    updated_at = now()
  WHERE g.id = p_geofence_id
    AND g.user_id = p_user_id;

  -- Check if update succeeded (RLS might have blocked it)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Update failed: geofence not found or permission denied';
  END IF;

  -- Return updated values
  -- Use explicit column aliases to avoid ambiguity with RETURN TABLE column names
  RETURN QUERY
  SELECT 
    g.id AS id,
    g.buffer_m AS buffer_m,
    g.boundary_outer AS boundary_outer
  FROM public.geofences g
  WHERE g.id = p_geofence_id
    AND g.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_geofence_buffer(BIGINT, INTEGER, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION update_geofence_buffer IS 
  'Updates geofence buffer_m and boundary_outer. Uses PostGIS geography cast for accurate meter-based buffering.';
