
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

  The app expects a table named `live_locations` with the following schema:

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

  ## Running the code

  Run `npm run dev` to start the development server.

  The app will automatically fetch and display live locations from your Supabase database on the map.
  