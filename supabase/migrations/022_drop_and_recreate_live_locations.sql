-- 1) Remove from realtime publication if it exists (avoid errors)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.live_locations;
  EXCEPTION WHEN undefined_object THEN
    -- publication or table not present; ignore
    NULL;
  END;
END $$;

-- 2) Drop the table (CASCADE removes dependent FK/triggers/views)
DROP TABLE IF EXISTS public.live_locations CASCADE;

-- 3) Recreate table (original fields + geom Point)
CREATE TABLE public.live_locations (
  tracker_id TEXT PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  geom geometry(Point, 4326),              -- NEW: geometry point (optional but useful)
  accuracy_m DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  heading_deg DOUBLE PRECISION,
  altitude_m DOUBLE PRECISION,
  captured_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_high_accuracy BOOLEAN DEFAULT FALSE
);

-- 4) Keep geom in sync if client only sends lat/lng
-- (This trigger will not block ingestion)
CREATE OR REPLACE FUNCTION public.live_locations_set_geom()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If geom is not provided, build it from lat/lng
  IF NEW.geom IS NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;

  -- Always keep updated_at fresh on writes (if you upsert without setting updated_at)
  IF NEW.updated_at IS NULL THEN
    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_live_locations_set_geom ON public.live_locations;

CREATE TRIGGER trg_live_locations_set_geom
BEFORE INSERT OR UPDATE ON public.live_locations
FOR EACH ROW
EXECUTE FUNCTION public.live_locations_set_geom();

-- 5) Indexes
CREATE INDEX idx_live_locations_updated_at
ON public.live_locations (updated_at DESC);

CREATE INDEX idx_live_locations_geom
ON public.live_locations USING GIST (geom);

-- tracker_id already indexed by PK, but keep explicit if you want:
CREATE INDEX idx_live_locations_tracker_id
ON public.live_locations (tracker_id);

-- 6) Enable RLS
ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

-- 7) Policies
-- Your Edge Function uses SERVICE ROLE, so it bypasses RLS and can insert/update.
-- For the admin viewer / app debugging (development), allow public read:
DROP POLICY IF EXISTS "Allow public read access" ON public.live_locations;

CREATE POLICY "Allow public read access"
ON public.live_locations
FOR SELECT
USING (true);

-- NOTE: Do NOT add public INSERT/UPDATE policies unless you really want clients writing directly.
-- Keep writes through the Edge Function using service role.

-- 8) Re-enable Realtime publication for this table (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_locations;
