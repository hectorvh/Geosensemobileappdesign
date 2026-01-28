-- ============================================================================
-- 020 - RELAX GEOFENCES GEOMETRY COLUMN TYPE
-- ============================================================================
-- Fixes error when inserting new geofences:
--   "Geometry type (Polygon) does not match column type (MultiPolygon)"
--
-- Root cause:
-- - Columns boundary_inner / boundary_outer were defined as
--   GEOMETRY(MultiPolygon, 4326).
-- - Supabase/PostgREST sends GeoJSON Polygon for most geofences, which PostGIS
--   casts to geometry(Polygon, 4326). That does not automatically upcast to
--   MultiPolygon on insert, so the type check fails.
--
-- Solution:
-- - Relax column type to GEOMETRY(Geometry, 4326) while keeping CHECK
--   constraints that enforce:
--     * GeometryType IN ('POLYGON', 'MULTIPOLYGON')
--     * ST_SRID = 4326
--   So we still only allow Polygon/MultiPolygon in the correct SRID, but we
--   no longer require the storage subtype to be MultiPolygon.
-- ============================================================================

-- Ensure PostGIS extension is available
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- STEP 1: Alter boundary_inner / boundary_outer types to GEOMETRY(Geometry, 4326)
-- ============================================================================

ALTER TABLE public.geofences
  ALTER COLUMN boundary_inner TYPE GEOMETRY(Geometry, 4326)
  USING ST_SetSRID(boundary_inner, 4326);

ALTER TABLE public.geofences
  ALTER COLUMN boundary_outer TYPE GEOMETRY(Geometry, 4326)
  USING CASE
        WHEN boundary_outer IS NULL THEN NULL
        ELSE ST_SetSRID(boundary_outer, 4326)
       END;

-- boundary_inner is still NOT NULL from previous migration

-- ============================================================================
-- STEP 2: Re-affirm existing CHECK constraints (no change needed)
-- ============================================================================
-- The constraints added in 019_geofences_jsonb_to_geometry.sql already enforce:
--   - ST_IsValid(...)
--   - ST_IsSimple(...)
--   - GeometryType IN ('MULTIPOLYGON','POLYGON')
--   - ST_SRID = 4326
--
-- Those constraints continue to apply and keep data in the desired
-- Polygon/MultiPolygon, SRID 4326 subset, even though the underlying column
-- subtype is now GEOMETRY(Geometry, 4326).
--
-- No changes required here; this block is purely informational.

-- ============================================================================
-- NOTES
-- ============================================================================
-- After this migration:
-- - Inserts of GeoJSON Polygon or MultiPolygon into geofences.boundary_inner /
--   boundary_outer will succeed via Supabase/PostgREST.
-- - Constraints still guarantee we only store valid, simple Polygon/MultiPolygon
--   in SRID 4326.
-- - Existing application code (DrawGeofence, MapTab, update_geofence_buffer)
--   continues to work unchanged.

