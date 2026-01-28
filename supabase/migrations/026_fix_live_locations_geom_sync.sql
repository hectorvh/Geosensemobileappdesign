-- ============================================================================
-- 026 - FIX live_locations.geom SYNC FROM lat/lng
-- ============================================================================
-- Problem: The trigger function live_locations_set_geom() only sets geom when
--          it's NULL, so geom doesn't update when lat/lng change.
-- Solution: Always sync geom from lat/lng on both INSERT and UPDATE to keep
--           them synchronized.
-- ============================================================================

-- Update the trigger function to always sync geom from lat/lng
CREATE OR REPLACE FUNCTION public.live_locations_set_geom()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Always sync geom from lat/lng to keep them synchronized
  -- This ensures geom reflects the current GPS coordinates
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;

  -- Always keep updated_at fresh on writes (if you upsert without setting updated_at)
  IF NEW.updated_at IS NULL THEN
    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END $$;

-- The trigger already exists, so we don't need to recreate it
-- But we'll ensure it's properly attached
DROP TRIGGER IF EXISTS trg_live_locations_set_geom ON public.live_locations;

CREATE TRIGGER trg_live_locations_set_geom
BEFORE INSERT OR UPDATE ON public.live_locations
FOR EACH ROW
EXECUTE FUNCTION public.live_locations_set_geom();

-- ============================================================================
-- Backfill: Update existing rows where geom doesn't match lat/lng
-- ============================================================================
-- This ensures all existing rows have geom synced from their current lat/lng
UPDATE public.live_locations
SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE lat IS NOT NULL 
  AND lng IS NOT NULL
  AND (
    geom IS NULL 
    OR ST_X(geom) != lng 
    OR ST_Y(geom) != lat
  );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- After this migration:
-- - Every INSERT/UPDATE will sync geom from lat/lng
-- - Existing rows have been backfilled to sync geom
-- - geom will always reflect the current GPS coordinates
-- ============================================================================
