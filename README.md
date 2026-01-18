
  # GeoSense Mobile App Design


  ## Setup

  ### 1. Install Dependencies

  Run `npm i` to install the dependencies.

  ### 2. Configure Supabase

  The app connects to Supabase to fetch live location data. You need to set up environment variables:

  1. Create a `.env` file in the `frontend` directory
  2. Add your Supabase credentials:

  ```
  VITE_SUPABASE_URL=https://thrmkorvklpvbbctsgti.supabase.co
  VITE_SUPABASE_ANON_KEY=your_anon_key_here
  ```

  To get your Supabase anon key:
  1. Go to your Supabase project: https://supabase.com/dashboard/project/thrmkorvklpvbbctsgti
  2. Navigate to Settings > API
  3. Copy the "anon public" key and paste it in your `.env` file

  ### 3. Database Schema

  The app expects two tables in Supabase:

  **1. `live_locations` table** - for tracking device locations:

  ```sql
  create table public.live_locations (
    tracker_id text not null,
    lat double precision not null,
    lng double precision not null,
    accuracy_m double precision null,
    speed_mps double precision null,
    heading_deg double precision null,
    altitude_m double precision null,
    captured_at timestamp with time zone not null,
    updated_at timestamp with time zone not null default now(),
    is_high_accuracy boolean null default false,
    constraint live_locations_pkey primary key (tracker_id)
  );

  create index IF not exists idx_live_locations_updated_at on public.live_locations using btree (updated_at desc);
  ```

  **2. `geofences` table** - for storing user-defined geofences:

  Run the SQL from `supabase_geofences_schema.sql` in your Supabase SQL editor, or use this:

  ```sql
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

  CREATE INDEX IF NOT EXISTS idx_geofences_user_id ON public.geofences(user_id);
  CREATE INDEX IF NOT EXISTS idx_geofences_created_at ON public.geofences(created_at DESC);

  ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Allow all operations for geofences" ON public.geofences
    FOR ALL USING (true) WITH CHECK (true);
  ```

  ### 4. Server Configuration (Optional)

  If you're using the Express server to save geofences, add these environment variables to `server/.env`:

  ```
  SUPABASE_URL=https://thrmkorvklpvbbctsgti.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
  ```

  The server will automatically save geofences to both your local PostgreSQL database and Supabase.

  ## Running the code

  Run `npm run dev` to start the development server.

  The app will automatically:
  - Fetch and display live locations from the `live_locations` table
  - Fetch and display geofences from the `geofences` table
  - Update in real-time as new data arrives
  