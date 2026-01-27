-- ============================================================================
-- POLYGON VALIDATION FUNCTION
-- ============================================================================
-- This function validates that a polygon is simple (non-self-intersecting)
-- using PostGIS ST_IsSimple and ST_IsValid functions

CREATE OR REPLACE FUNCTION validate_polygon_simple(p_geojson JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  v_geom GEOMETRY;
  v_is_simple BOOLEAN;
  v_is_valid BOOLEAN;
BEGIN
  -- Convert GeoJSON to PostGIS geometry
  BEGIN
    v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326);
  EXCEPTION WHEN OTHERS THEN
    -- Invalid GeoJSON format
    RETURN FALSE;
  END;

  -- Check if geometry is a polygon
  IF ST_GeometryType(v_geom) != 'ST_Polygon' THEN
    RETURN FALSE;
  END IF;

  -- Check if polygon is simple (no self-intersections)
  v_is_simple := ST_IsSimple(v_geom);
  
  -- Also check if polygon is valid (additional validation)
  v_is_valid := ST_IsValid(v_geom);

  -- Return true only if both checks pass
  RETURN v_is_simple AND v_is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION validate_polygon_simple(JSONB) TO authenticated;

-- Add comment
COMMENT ON FUNCTION validate_polygon_simple(JSONB) IS 'Validates that a GeoJSON polygon is simple (non-self-intersecting) and valid using PostGIS';
