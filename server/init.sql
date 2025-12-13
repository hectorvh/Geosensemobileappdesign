-- Run this to create the geofences table
CREATE TABLE IF NOT EXISTS geofences (
  id SERIAL PRIMARY KEY,
  name TEXT,
  user_id TEXT,
  boundary_inner JSONB NOT NULL,
  boundary_outer JSONB,
  buffer_m INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geofences_user_id_idx ON geofences(user_id);