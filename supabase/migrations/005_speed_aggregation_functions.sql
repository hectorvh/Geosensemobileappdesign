-- ============================================================================
-- AGGREGATION FUNCTIONS USING WELFORD'S ALGORITHM
-- ============================================================================

-- Function to update 1-minute aggregation from 2-second samples
-- This function aggregates ALL 2s samples for a given minute
-- CRITICAL: Must recalculate from ALL 2s samples, not incrementally
CREATE OR REPLACE FUNCTION upsert_minute_speed_from_2s(
  p_tracker_id UUID,
  p_ts TIMESTAMPTZ,
  p_speed_mps DOUBLE PRECISION
)
RETURNS VOID AS $$
DECLARE
  v_minute_ts TIMESTAMPTZ;
  v_new_mean DOUBLE PRECISION;
  v_new_stddev DOUBLE PRECISION;
  v_new_n INTEGER;
  v_last_ts TIMESTAMPTZ;
  v_last_speed DOUBLE PRECISION;
  v_m2 DOUBLE PRECISION;
BEGIN
  -- Calculate minute bucket
  v_minute_ts := date_trunc('minute', p_ts);
  
  -- Recalculate from ALL 2s samples in this minute (source of truth)
  SELECT 
    COUNT(*)::INTEGER,
    AVG(speed_mps),
    STDDEV_POP(speed_mps),
    MAX(ts),
    (SELECT speed_mps FROM public.speed_samples_2s 
     WHERE tracker_id = p_tracker_id 
     AND date_trunc('minute', ts) = v_minute_ts 
     ORDER BY ts DESC LIMIT 1)
  INTO 
    v_new_n,
    v_new_mean,
    v_new_stddev,
    v_last_ts,
    v_last_speed
  FROM public.speed_samples_2s
  WHERE tracker_id = p_tracker_id
    AND date_trunc('minute', ts) = v_minute_ts;
  
  -- Calculate m2 for Welford's algorithm state
  -- m2 = sum((x - mean)^2) = n * variance = n * stddev^2
  v_m2 := COALESCE(v_new_n * POWER(COALESCE(v_new_stddev, 0), 2), 0);
  
  -- Upsert the minute record
  INSERT INTO public.speed_samples_1m (
    tracker_id,
    minute_ts,
    avg_speed_mps,
    stddev_speed_mps,
    n_samples,
    last_ts,
    last_speed_mps,
    mean_mps,
    m2
  ) VALUES (
    p_tracker_id,
    v_minute_ts,
    COALESCE(v_new_mean, p_speed_mps),
    COALESCE(v_new_stddev, 0),
    COALESCE(v_new_n, 1),
    COALESCE(v_last_ts, p_ts),
    COALESCE(v_last_speed, p_speed_mps),
    COALESCE(v_new_mean, p_speed_mps),
    v_m2
  )
  ON CONFLICT (tracker_id, minute_ts) DO UPDATE SET
    avg_speed_mps = EXCLUDED.avg_speed_mps,
    stddev_speed_mps = EXCLUDED.stddev_speed_mps,
    n_samples = EXCLUDED.n_samples,
    last_ts = EXCLUDED.last_ts,
    last_speed_mps = EXCLUDED.last_speed_mps,
    mean_mps = EXCLUDED.mean_mps,
    m2 = EXCLUDED.m2,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to update hourly aggregation from 1-minute samples
-- This function aggregates ALL 1m samples for a given hour
-- CRITICAL: Must aggregate ONLY from speed_samples_1m, NOT from speed_samples_2s
CREATE OR REPLACE FUNCTION upsert_hourly_speed_from_1m(
  p_tracker_id UUID,
  p_minute_ts TIMESTAMPTZ
)
RETURNS VOID AS $$
DECLARE
  v_hour_ts TIMESTAMPTZ;
  v_avg_speed DOUBLE PRECISION;
  v_stddev_speed DOUBLE PRECISION;
  v_n_minutes INTEGER;
  v_mean DOUBLE PRECISION;
  v_m2 DOUBLE PRECISION;
BEGIN
  -- Calculate hour bucket
  v_hour_ts := date_trunc('hour', p_minute_ts);
  
  -- Recalculate from ALL 1m records in this hour (source: speed_samples_1m only)
  SELECT 
    COUNT(*)::INTEGER,
    AVG(avg_speed_mps),
    STDDEV_POP(avg_speed_mps)
  INTO 
    v_n_minutes,
    v_avg_speed,
    v_stddev_speed
  FROM public.speed_samples_1m
  WHERE tracker_id = p_tracker_id
    AND date_trunc('hour', minute_ts) = v_hour_ts;
  
  -- Calculate mean and m2 for Welford's algorithm state
  v_mean := COALESCE(v_avg_speed, 0);
  v_m2 := COALESCE(v_n_minutes * POWER(COALESCE(v_stddev_speed, 0), 2), 0);
  
  -- Upsert the hourly record
  INSERT INTO public.hourly_speed_stats (
    tracker_id,
    hour_ts,
    avg_speed_mps,
    stddev_speed_mps,
    n_minutes,
    mean_mps,
    m2
  ) VALUES (
    p_tracker_id,
    v_hour_ts,
    COALESCE(v_avg_speed, 0),
    COALESCE(v_stddev_speed, 0),
    COALESCE(v_n_minutes, 0),
    v_mean,
    v_m2
  )
  ON CONFLICT (tracker_id, hour_ts) DO UPDATE SET
    avg_speed_mps = EXCLUDED.avg_speed_mps,
    stddev_speed_mps = EXCLUDED.stddev_speed_mps,
    n_minutes = EXCLUDED.n_minutes,
    mean_mps = EXCLUDED.mean_mps,
    m2 = EXCLUDED.m2,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MAIN INGESTION FUNCTION
-- ============================================================================
-- This function handles the complete ingestion pipeline:
-- 1. Insert into speed_samples_2s
-- 2. Update speed_samples_1m (aggregate from 2s)
-- 3. Update hourly_speed_stats (aggregate from 1m)
CREATE OR REPLACE FUNCTION ingest_gps_sample(
  p_tracker_id UUID,
  p_ts TIMESTAMPTZ,
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_speed_mps DOUBLE PRECISION,
  p_accuracy_m DOUBLE PRECISION DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- STEP 1: Insert into speed_samples_2s
  INSERT INTO public.speed_samples_2s (
    tracker_id,
    ts,
    lat,
    lon,
    speed_mps,
    accuracy_m
  ) VALUES (
    p_tracker_id,
    p_ts,
    p_lat,
    p_lon,
    p_speed_mps,
    p_accuracy_m
  );
  
  -- STEP 2: Update 1-minute aggregation (from 2s samples)
  PERFORM upsert_minute_speed_from_2s(p_tracker_id, p_ts, p_speed_mps);
  
  -- STEP 3: Update hourly aggregation (from 1m samples)
  PERFORM upsert_hourly_speed_from_1m(p_tracker_id, p_ts);
END;
$$ LANGUAGE plpgsql;
