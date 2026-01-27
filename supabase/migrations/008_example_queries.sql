-- ============================================================================
-- EXAMPLE QUERIES FOR SPEED ANALYTICS
-- ============================================================================

-- ============================================================================
-- Query 1: Current Speed (Latest minute record)
-- ============================================================================
-- Get the most recent speed for a tracker from the 1-minute table
CREATE OR REPLACE FUNCTION get_current_speed(p_tracker_id UUID)
RETURNS TABLE (
  tracker_id UUID,
  minute_ts TIMESTAMPTZ,
  avg_speed_mps DOUBLE PRECISION,
  last_speed_mps DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.tracker_id,
    s.minute_ts,
    s.avg_speed_mps,
    s.last_speed_mps,
    s.last_speed_mps * 3.6 AS speed_kmh
  FROM public.speed_samples_1m s
  WHERE s.tracker_id = p_tracker_id
  ORDER BY s.minute_ts DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Query 2: Last Hour Average Speed (from minute table)
-- ============================================================================
-- Get average speed over the last hour using minute-level data
CREATE OR REPLACE FUNCTION get_last_hour_avg_speed(p_tracker_id UUID)
RETURNS TABLE (
  tracker_id UUID,
  avg_speed_mps DOUBLE PRECISION,
  avg_speed_kmh DOUBLE PRECISION,
  min_speed_mps DOUBLE PRECISION,
  max_speed_mps DOUBLE PRECISION,
  n_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.tracker_id,
    AVG(s.avg_speed_mps) AS avg_speed_mps,
    AVG(s.avg_speed_mps) * 3.6 AS avg_speed_kmh,
    MIN(s.avg_speed_mps) AS min_speed_mps,
    MAX(s.avg_speed_mps) AS max_speed_mps,
    COUNT(*)::INTEGER AS n_minutes
  FROM public.speed_samples_1m s
  WHERE s.tracker_id = p_tracker_id
    AND s.minute_ts >= now() - interval '1 hour'
  GROUP BY s.tracker_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Query 3: Last Week Hourly Stats (from hourly table)
-- ============================================================================
-- Get hourly speed statistics for the last 7 days
CREATE OR REPLACE FUNCTION get_last_week_hourly_stats(p_tracker_id UUID)
RETURNS TABLE (
  tracker_id UUID,
  hour_ts TIMESTAMPTZ,
  avg_speed_mps DOUBLE PRECISION,
  avg_speed_kmh DOUBLE PRECISION,
  stddev_speed_mps DOUBLE PRECISION,
  n_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.tracker_id,
    h.hour_ts,
    h.avg_speed_mps,
    h.avg_speed_mps * 3.6 AS avg_speed_kmh,
    h.stddev_speed_mps,
    h.n_minutes
  FROM public.hourly_speed_stats h
  WHERE h.tracker_id = p_tracker_id
    AND h.hour_ts >= now() - interval '7 days'
  ORDER BY h.hour_ts DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Query 4: Speed Timeline (for charts)
-- ============================================================================
-- Get speed data for a time range (from appropriate table based on range)
CREATE OR REPLACE FUNCTION get_speed_timeline(
  p_tracker_id UUID,
  p_start_ts TIMESTAMPTZ,
  p_end_ts TIMESTAMPTZ
)
RETURNS TABLE (
  ts TIMESTAMPTZ,
  speed_mps DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION,
  source TEXT
) AS $$
BEGIN
  -- If range is < 1 hour, use 1m table
  IF p_end_ts - p_start_ts < interval '1 hour' THEN
    RETURN QUERY
    SELECT 
      s.minute_ts AS ts,
      s.avg_speed_mps AS speed_mps,
      s.avg_speed_mps * 3.6 AS speed_kmh,
      '1m'::TEXT AS source
    FROM public.speed_samples_1m s
    WHERE s.tracker_id = p_tracker_id
      AND s.minute_ts >= p_start_ts
      AND s.minute_ts <= p_end_ts
    ORDER BY s.minute_ts;
  -- If range is >= 1 hour, use hourly table
  ELSE
    RETURN QUERY
    SELECT 
      h.hour_ts AS ts,
      h.avg_speed_mps AS speed_mps,
      h.avg_speed_mps * 3.6 AS speed_kmh,
      'hourly'::TEXT AS source
    FROM public.hourly_speed_stats h
    WHERE h.tracker_id = p_tracker_id
      AND h.hour_ts >= date_trunc('hour', p_start_ts)
      AND h.hour_ts <= date_trunc('hour', p_end_ts)
    ORDER BY h.hour_ts;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Query 5: Recent 2s samples for alerts (last minute only)
-- ============================================================================
-- Get recent high-resolution samples for geofence/alert checks
CREATE OR REPLACE FUNCTION get_recent_2s_samples(
  p_tracker_id UUID,
  p_minutes_back INTEGER DEFAULT 1
)
RETURNS TABLE (
  id BIGINT,
  ts TIMESTAMPTZ,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  geom GEOMETRY
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.ts,
    s.lat,
    s.lon,
    s.speed_mps,
    s.accuracy_m,
    s.geom
  FROM public.speed_samples_2s s
  WHERE s.tracker_id = p_tracker_id
    AND s.ts >= now() - (p_minutes_back || ' minutes')::INTERVAL
  ORDER BY s.ts DESC;
END;
$$ LANGUAGE plpgsql;
