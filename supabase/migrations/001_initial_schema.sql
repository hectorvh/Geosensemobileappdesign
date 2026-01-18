-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
-- Profiles linked to Supabase Auth users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  full_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- ============================================================================
-- DEVICES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  animal_name TEXT,
  animal_outside BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT false,
  speed NUMERIC NOT NULL DEFAULT 0,
  active_time INTEGER NOT NULL DEFAULT 0, -- seconds
  inactive_time INTEGER NOT NULL DEFAULT 0, -- seconds
  total_distance NUMERIC NOT NULL DEFAULT 0, -- km
  battery_level INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for devices
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_tracker_id ON public.devices(tracker_id);
CREATE INDEX IF NOT EXISTS idx_devices_active ON public.devices(active);
CREATE INDEX IF NOT EXISTS idx_devices_animal_outside ON public.devices(animal_outside);

-- ============================================================================
-- LIVE_LOCATIONS TABLE (Updated)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.live_locations (
  tracker_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  geom GEOMETRY(POINT, 4326),
  accuracy_m DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  heading_deg DOUBLE PRECISION,
  altitude_m DOUBLE PRECISION,
  captured_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_high_accuracy BOOLEAN DEFAULT false,
  CONSTRAINT live_locations_pkey PRIMARY KEY (tracker_id)
);

-- Update geom column from lat/lng if not set
CREATE OR REPLACE FUNCTION update_live_locations_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.geom IS NULL AND NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_live_locations_geom_trigger
  BEFORE INSERT OR UPDATE ON public.live_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_live_locations_geom();

-- Indexes for live_locations
CREATE INDEX IF NOT EXISTS idx_live_locations_tracker_id ON public.live_locations(tracker_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_user_id ON public.live_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_updated_at ON public.live_locations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_locations_geom ON public.live_locations USING GIST (geom);

-- ============================================================================
-- GEOFENCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.geofences (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  boundary_inner JSONB NOT NULL, -- GeoJSON Polygon
  boundary_outer JSONB, -- GeoJSON Polygon (buffer zone)
  buffer_m INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for geofences
CREATE INDEX IF NOT EXISTS idx_geofences_user_id ON public.geofences(user_id);
CREATE INDEX IF NOT EXISTS idx_geofences_created_at ON public.geofences(created_at DESC);

-- ============================================================================
-- ALERTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
  type_alert TEXT NOT NULL CHECK (type_alert IN ('Inactivity Detected', 'Out of Range', 'Low Battery')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON public.alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON public.alerts(active);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_device_active ON public.alerts(device_id, active, created_at);

-- ============================================================================
-- SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  inactivity_minutes INTEGER NOT NULL DEFAULT 15,
  low_battery_threshold INTEGER NOT NULL DEFAULT 15,
  enable_out_of_range BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for settings
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON public.settings(user_id);

-- ============================================================================
-- POSITIONS VIEW (for backward compatibility)
-- ============================================================================
CREATE OR REPLACE VIEW public.positions AS
SELECT 
  ll.tracker_id as device_id,
  d.id as device_uuid,
  ll.user_id,
  ll.geom,
  ll.captured_at as recorded_at,
  ll.updated_at as ingested_at
FROM public.live_locations ll
LEFT JOIN public.devices d ON d.tracker_id = ll.tracker_id;

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_geofences_updated_at
  BEFORE UPDATE ON public.geofences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
