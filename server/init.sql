CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS geofences (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  inner_geom GEOMETRY(POLYGON, 4326) NOT NULL,
  outer_geom GEOMETRY(MULTIPOLYGON, 4326),
  buffer_m INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofences_user_id ON geofences(user_id);
CREATE INDEX IF NOT EXISTS idx_geofences_inner_geom ON geofences USING GIST (inner_geom);
CREATE INDEX IF NOT EXISTS idx_geofences_outer_geom ON geofences USING GIST (outer_geom);

CREATE TABLE IF NOT EXISTS devices (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_uid TEXT UNIQUE NOT NULL,  -- e.g., collar IMEI / MAC / UUID
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

CREATE TABLE IF NOT EXISTS positions (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  geom GEOGRAPHY(POINT, 4326) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,             -- device timestamp
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now() -- server timestamp
);

CREATE INDEX IF NOT EXISTS idx_positions_geom ON positions USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_positions_device_time ON positions (device_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_positions_user_time ON positions (user_id, recorded_at);



