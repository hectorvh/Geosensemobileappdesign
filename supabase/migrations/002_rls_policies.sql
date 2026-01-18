-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- DEVICES POLICIES
-- ============================================================================
-- Users can view their own devices
CREATE POLICY "Users can view own devices"
  ON public.devices FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own devices
CREATE POLICY "Users can insert own devices"
  ON public.devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own devices
CREATE POLICY "Users can update own devices"
  ON public.devices FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own devices
CREATE POLICY "Users can delete own devices"
  ON public.devices FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- LIVE_LOCATIONS POLICIES
-- ============================================================================
-- Users can view their own live locations
CREATE POLICY "Users can view own live locations"
  ON public.live_locations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own live locations
CREATE POLICY "Users can insert own live locations"
  ON public.live_locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own live locations
CREATE POLICY "Users can update own live locations"
  ON public.live_locations FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- GEOFENCES POLICIES
-- ============================================================================
-- Users can view their own geofences
CREATE POLICY "Users can view own geofences"
  ON public.geofences FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own geofences
CREATE POLICY "Users can insert own geofences"
  ON public.geofences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own geofences
CREATE POLICY "Users can update own geofences"
  ON public.geofences FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own geofences
CREATE POLICY "Users can delete own geofences"
  ON public.geofences FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- ALERTS POLICIES
-- ============================================================================
-- Users can view alerts for their own devices
CREATE POLICY "Users can view own device alerts"
  ON public.alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = alerts.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- Users can insert alerts for their own devices
CREATE POLICY "Users can insert own device alerts"
  ON public.alerts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = alerts.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- Users can update alerts for their own devices
CREATE POLICY "Users can update own device alerts"
  ON public.alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = alerts.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- Users can delete alerts for their own devices
CREATE POLICY "Users can delete own device alerts"
  ON public.alerts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = alerts.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- ============================================================================
-- SETTINGS POLICIES
-- ============================================================================
-- Users can view their own settings
CREATE POLICY "Users can view own settings"
  ON public.settings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own settings"
  ON public.settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update own settings"
  ON public.settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own settings
CREATE POLICY "Users can delete own settings"
  ON public.settings FOR DELETE
  USING (auth.uid() = user_id);
