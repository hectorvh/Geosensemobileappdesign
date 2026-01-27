-- ============================================================================
-- MIGRATION: Populate trackers table from existing devices
-- ============================================================================
-- This migration creates tracker records from existing devices
-- and maintains backward compatibility

-- Insert trackers from existing devices
-- This ensures all existing devices have corresponding tracker records
INSERT INTO public.trackers (tracker_id, user_id, name, created_at, updated_at)
SELECT DISTINCT
  d.tracker_id::TEXT,
  d.user_id,
  COALESCE(d.animal_name, d.name, 'Tracker ' || d.tracker_id),
  d.created_at,
  d.updated_at
FROM public.devices d
WHERE d.tracker_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.trackers t 
    WHERE t.tracker_id = d.tracker_id::TEXT
  )
ON CONFLICT (tracker_id) DO NOTHING;

-- Also create trackers from live_locations if they don't exist
INSERT INTO public.trackers (tracker_id, user_id, name, created_at, updated_at)
SELECT DISTINCT
  ll.tracker_id::TEXT,
  ll.user_id,
  'Tracker ' || ll.tracker_id,
  COALESCE(ll.updated_at, now()),
  COALESCE(ll.updated_at, now())
FROM public.live_locations ll
WHERE ll.tracker_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.trackers t 
    WHERE t.tracker_id = ll.tracker_id::TEXT
  )
ON CONFLICT (tracker_id) DO NOTHING;

-- ============================================================================
-- BACKWARD COMPATIBILITY VIEW
-- ============================================================================
-- Create a view that maps old live_locations to new structure
-- This allows existing code to continue working
CREATE OR REPLACE VIEW public.live_locations_compat AS
SELECT 
  t.tracker_id::TEXT AS tracker_id,
  t.user_id,
  s2s.lat,
  s2s.lon AS lng,
  s2s.geom,
  s2s.accuracy_m,
  s2s.speed_mps,
  NULL::DOUBLE PRECISION AS heading_deg,
  NULL::DOUBLE PRECISION AS altitude_m,
  s2s.ts AS captured_at,
  s2s.ts AS updated_at,
  false AS is_high_accuracy
FROM public.speed_samples_2s s2s
JOIN public.trackers t ON t.id = s2s.tracker_id
WHERE s2s.ts >= now() - interval '1 minute'
ORDER BY s2s.ts DESC;

-- ============================================================================
-- HELPER FUNCTION: Get tracker UUID from tracker_id TEXT
-- ============================================================================
CREATE OR REPLACE FUNCTION get_tracker_uuid(p_tracker_id TEXT)
RETURNS UUID AS $$
DECLARE
  v_tracker_uuid UUID;
BEGIN
  SELECT id INTO v_tracker_uuid
  FROM public.trackers
  WHERE tracker_id = p_tracker_id
  LIMIT 1;
  
  RETURN v_tracker_uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- WRAPPER FUNCTION: Ingest GPS sample using TEXT tracker_id (backward compat)
-- ============================================================================
CREATE OR REPLACE FUNCTION ingest_gps_sample_text(
  p_tracker_id TEXT,
  p_ts TIMESTAMPTZ,
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_speed_mps DOUBLE PRECISION,
  p_accuracy_m DOUBLE PRECISION DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_tracker_uuid UUID;
  v_user_id UUID;
BEGIN
  -- Get or create tracker UUID
  SELECT id INTO v_tracker_uuid
  FROM public.trackers
  WHERE tracker_id = p_tracker_id;
  
  -- If tracker doesn't exist, try to find user_id from devices table
  -- If still not found, use auth.uid() or NULL
  IF v_tracker_uuid IS NULL THEN
    -- Try to get user_id from devices table
    SELECT user_id INTO v_user_id
    FROM public.devices
    WHERE tracker_id = p_tracker_id
    LIMIT 1;
    
    -- Create tracker (user_id may be NULL if not found and no auth context)
    INSERT INTO public.trackers (tracker_id, user_id)
    VALUES (p_tracker_id, COALESCE(v_user_id, auth.uid()))
    RETURNING id INTO v_tracker_uuid;
  END IF;
  
  -- Call the main ingestion function
  PERFORM ingest_gps_sample(
    v_tracker_uuid,
    p_ts,
    p_lat,
    p_lon,
    p_speed_mps,
    p_accuracy_m
  );
END;
$$ LANGUAGE plpgsql;
