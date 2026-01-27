-- ============================================================================
-- CLEANUP FUNCTIONS FOR DATA RETENTION
-- ============================================================================

-- Cleanup function for speed_samples_2s (1 minute retention)
CREATE OR REPLACE FUNCTION cleanup_speed_samples_2s()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.speed_samples_2s
  WHERE ts < now() - interval '1 minute';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for speed_samples_1m (1 hour retention)
CREATE OR REPLACE FUNCTION cleanup_speed_samples_1m()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.speed_samples_1m
  WHERE minute_ts < now() - interval '1 hour';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for hourly_speed_stats (7 days retention)
CREATE OR REPLACE FUNCTION cleanup_hourly_speed_stats()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.hourly_speed_stats
  WHERE hour_ts < now() - interval '7 days';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Combined cleanup function (run all cleanups)
CREATE OR REPLACE FUNCTION cleanup_all_speed_tables()
RETURNS TABLE (
  table_name TEXT,
  deleted_count INTEGER
) AS $$
DECLARE
  v_2s_count INTEGER;
  v_1m_count INTEGER;
  v_hourly_count INTEGER;
BEGIN
  -- Cleanup 2s samples
  SELECT cleanup_speed_samples_2s() INTO v_2s_count;
  
  -- Cleanup 1m samples
  SELECT cleanup_speed_samples_1m() INTO v_1m_count;
  
  -- Cleanup hourly stats
  SELECT cleanup_hourly_speed_stats() INTO v_hourly_count;
  
  -- Return results
  RETURN QUERY SELECT 'speed_samples_2s'::TEXT, v_2s_count;
  RETURN QUERY SELECT 'speed_samples_1m'::TEXT, v_1m_count;
  RETURN QUERY SELECT 'hourly_speed_stats'::TEXT, v_hourly_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTOMATED CLEANUP (using pg_cron if available, or manual scheduling)
-- ============================================================================
-- Note: Supabase uses pg_cron extension for scheduled jobs
-- To enable: Run in Supabase SQL Editor:
--   SELECT cron.schedule('cleanup-speed-samples-2s', '*/1 * * * *', 'SELECT cleanup_speed_samples_2s()');
--   SELECT cron.schedule('cleanup-speed-samples-1m', '*/5 * * * *', 'SELECT cleanup_speed_samples_1m()');
--   SELECT cron.schedule('cleanup-hourly-speed-stats', '0 * * * *', 'SELECT cleanup_hourly_speed_stats()');

-- Alternative: Create a function that can be called by Supabase Edge Functions
-- or external cron jobs
CREATE OR REPLACE FUNCTION scheduled_cleanup()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'speed_samples_2s', cleanup_speed_samples_2s(),
    'speed_samples_1m', cleanup_speed_samples_1m(),
    'hourly_speed_stats', cleanup_hourly_speed_stats(),
    'timestamp', now()
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
