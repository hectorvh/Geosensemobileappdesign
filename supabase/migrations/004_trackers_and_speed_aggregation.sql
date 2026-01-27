-- ============================================================================
-- TRACKERS TABLE
-- ============================================================================
-- Parent table for all GPS tracking data
CREATE TABLE IF NOT EXISTS public.trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id TEXT UNIQUE NOT NULL, -- Legacy compatibility with devices.tracker_id
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for trackers
CREATE INDEX IF NOT EXISTS idx_trackers_tracker_id ON public.trackers(tracker_id);
CREATE INDEX IF NOT EXISTS idx_trackers_user_id ON public.trackers(user_id);

-- ============================================================================
-- SPEED SAMPLES 2S TABLE (High-resolution, 1 minute retention)
-- ============================================================================
-- Purpose: Real-time alerts and geofence checks
CREATE TABLE IF NOT EXISTS public.speed_samples_2s (
  id BIGSERIAL PRIMARY KEY,
  tracker_id UUID NOT NULL REFERENCES public.trackers(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION NOT NULL,
  geom GEOMETRY(POINT, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for speed_samples_2s
CREATE INDEX IF NOT EXISTS idx_speed_samples_2s_tracker_ts ON public.speed_samples_2s(tracker_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_speed_samples_2s_ts ON public.speed_samples_2s(ts DESC);
CREATE INDEX IF NOT EXISTS idx_speed_samples_2s_geom ON public.speed_samples_2s USING GIST (geom);

-- Auto-populate geom from lat/lon
CREATE OR REPLACE FUNCTION update_speed_samples_2s_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.geom IS NULL AND NEW.lat IS NOT NULL AND NEW.lon IS NOT NULL THEN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_speed_samples_2s_geom_trigger
  BEFORE INSERT OR UPDATE ON public.speed_samples_2s
  FOR EACH ROW
  EXECUTE FUNCTION update_speed_samples_2s_geom();

-- ============================================================================
-- SPEED SAMPLES 1M TABLE (1 minute aggregation, 1 hour retention)
-- ============================================================================
-- Purpose: Minute-level aggregations from 2s samples
CREATE TABLE IF NOT EXISTS public.speed_samples_1m (
  tracker_id UUID NOT NULL REFERENCES public.trackers(id) ON DELETE CASCADE,
  minute_ts TIMESTAMPTZ NOT NULL,
  avg_speed_mps DOUBLE PRECISION NOT NULL,
  stddev_speed_mps DOUBLE PRECISION,
  n_samples INTEGER NOT NULL DEFAULT 0,
  last_ts TIMESTAMPTZ NOT NULL,
  last_speed_mps DOUBLE PRECISION NOT NULL,
  -- Welford's algorithm state (for incremental updates)
  mean_mps DOUBLE PRECISION NOT NULL,
  m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT speed_samples_1m_pkey PRIMARY KEY (tracker_id, minute_ts)
);

-- Indexes for speed_samples_1m
CREATE INDEX IF NOT EXISTS idx_speed_samples_1m_tracker_minute ON public.speed_samples_1m(tracker_id, minute_ts DESC);
CREATE INDEX IF NOT EXISTS idx_speed_samples_1m_minute_ts ON public.speed_samples_1m(minute_ts DESC);

-- ============================================================================
-- HOURLY SPEED STATS TABLE (1 hour aggregation, 7 days retention)
-- ============================================================================
-- Purpose: Hourly aggregations from 1m samples
CREATE TABLE IF NOT EXISTS public.hourly_speed_stats (
  tracker_id UUID NOT NULL REFERENCES public.trackers(id) ON DELETE CASCADE,
  hour_ts TIMESTAMPTZ NOT NULL,
  avg_speed_mps DOUBLE PRECISION NOT NULL,
  stddev_speed_mps DOUBLE PRECISION,
  n_minutes INTEGER NOT NULL DEFAULT 0,
  -- Welford's algorithm state (for incremental updates)
  mean_mps DOUBLE PRECISION NOT NULL,
  m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hourly_speed_stats_pkey PRIMARY KEY (tracker_id, hour_ts)
);

-- Indexes for hourly_speed_stats
CREATE INDEX IF NOT EXISTS idx_hourly_speed_stats_tracker_hour ON public.hourly_speed_stats(tracker_id, hour_ts DESC);
CREATE INDEX IF NOT EXISTS idx_hourly_speed_stats_hour_ts ON public.hourly_speed_stats(hour_ts DESC);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================
CREATE TRIGGER update_speed_samples_1m_updated_at
  BEFORE UPDATE ON public.speed_samples_1m
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hourly_speed_stats_updated_at
  BEFORE UPDATE ON public.hourly_speed_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trackers_updated_at
  BEFORE UPDATE ON public.trackers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
