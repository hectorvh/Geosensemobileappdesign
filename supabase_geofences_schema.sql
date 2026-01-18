-- Supabase geofences table schema
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard/project/thrmkorvklpvbbctsgti/sql/new

CREATE TABLE IF NOT EXISTS public.geofences (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  boundary_inner JSONB NOT NULL, -- GeoJSON Polygon
  boundary_outer JSONB, -- GeoJSON Polygon (buffer zone)
  buffer_m INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_geofences_user_id ON public.geofences(user_id);
CREATE INDEX IF NOT EXISTS idx_geofences_created_at ON public.geofences(created_at DESC);

-- Enable Row Level Security (optional, adjust policies as needed)
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all operations for geofences" ON public.geofences
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_geofences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_geofences_updated_at
  BEFORE UPDATE ON public.geofences
  FOR EACH ROW
  EXECUTE FUNCTION update_geofences_updated_at();
