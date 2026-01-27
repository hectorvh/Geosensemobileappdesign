-- ============================================================================
-- ROW LEVEL SECURITY FOR SPEED AGGREGATION TABLES
-- ============================================================================

-- Enable RLS on all speed tables
ALTER TABLE public.trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speed_samples_2s ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speed_samples_1m ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_speed_stats ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TRACKERS POLICIES
-- ============================================================================
-- Users can view their own trackers
CREATE POLICY "Users can view own trackers"
  ON public.trackers FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own trackers
CREATE POLICY "Users can insert own trackers"
  ON public.trackers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own trackers
CREATE POLICY "Users can update own trackers"
  ON public.trackers FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own trackers
CREATE POLICY "Users can delete own trackers"
  ON public.trackers FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SPEED_SAMPLES_2S POLICIES
-- ============================================================================
-- Users can view 2s samples for their own trackers
CREATE POLICY "Users can view own 2s samples"
  ON public.speed_samples_2s FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trackers
      WHERE trackers.id = speed_samples_2s.tracker_id
      AND trackers.user_id = auth.uid()
    )
  );

-- Users can insert 2s samples for their own trackers
CREATE POLICY "Users can insert own 2s samples"
  ON public.speed_samples_2s FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trackers
      WHERE trackers.id = speed_samples_2s.tracker_id
      AND trackers.user_id = auth.uid()
    )
  );

-- ============================================================================
-- SPEED_SAMPLES_1M POLICIES
-- ============================================================================
-- Users can view 1m samples for their own trackers
CREATE POLICY "Users can view own 1m samples"
  ON public.speed_samples_1m FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trackers
      WHERE trackers.id = speed_samples_1m.tracker_id
      AND trackers.user_id = auth.uid()
    )
  );

-- Users can update 1m samples for their own trackers (via aggregation functions)
CREATE POLICY "Users can update own 1m samples"
  ON public.speed_samples_1m FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trackers
      WHERE trackers.id = speed_samples_1m.tracker_id
      AND trackers.user_id = auth.uid()
    )
  );

-- Users can insert 1m samples for their own trackers (via aggregation functions)
CREATE POLICY "Users can insert own 1m samples"
  ON public.speed_samples_1m FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trackers
      WHERE trackers.id = speed_samples_1m.tracker_id
      AND trackers.user_id = auth.uid()
    )
  );

-- ============================================================================
-- HOURLY_SPEED_STATS POLICIES
-- ============================================================================
-- Users can view hourly stats for their own trackers
CREATE POLICY "Users can view own hourly stats"
  ON public.hourly_speed_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trackers
      WHERE trackers.id = hourly_speed_stats.tracker_id
      AND trackers.user_id = auth.uid()
    )
  );

-- Users can update hourly stats for their own trackers (via aggregation functions)
CREATE POLICY "Users can update own hourly stats"
  ON public.hourly_speed_stats FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trackers
      WHERE trackers.id = hourly_speed_stats.tracker_id
      AND trackers.user_id = auth.uid()
    )
  );

-- Users can insert hourly stats for their own trackers (via aggregation functions)
CREATE POLICY "Users can insert own hourly stats"
  ON public.hourly_speed_stats FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trackers
      WHERE trackers.id = hourly_speed_stats.tracker_id
      AND trackers.user_id = auth.uid()
    )
  );
