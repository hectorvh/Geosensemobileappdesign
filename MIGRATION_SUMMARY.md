# Supabase Migration Summary

This document summarizes the migration from local Express server to Supabase-only architecture.

## Database Schema

All migrations are in `supabase/migrations/`:
- `001_initial_schema.sql` - Creates all tables (profiles, devices, live_locations, geofences, alerts, settings)
- `002_rls_policies.sql` - Row Level Security policies for all tables

## Key Changes

### 1. Authentication
- **Before**: Mock user system in AppContext
- **After**: Supabase Auth (`auth.users` table)
- **Files Updated**:
  - `frontend/src/hooks/useAuth.ts` - New hook for Supabase Auth
  - `frontend/src/screens/Login.tsx` - Uses `signIn()`
  - `frontend/src/screens/SignUp.tsx` - Uses `signUp()`

### 2. Data Hooks
All data now comes from Supabase hooks:
- `useAuth()` - Authentication and user profile
- `useDevices()` - Device management
- `useAlerts()` - Alert management
- `useSettings()` - User settings
- `useLiveLocations()` - Real-time location tracking
- `useGeofences()` - Geofence management

### 3. Tabs Updated

#### HomeTab
- **Active Alerts**: Count of alerts where `active = true`
- **Animals Outside**: Count of devices where `animal_outside = true AND active = true`
- **Animals Inside**: Count of devices where `animal_outside = false AND active = true`

#### MapTab
- **Coloring Rules**:
  - **Green**: `live_location_active = true AND has_active_alert = false`
  - **Red**: `live_location_active = true AND has_active_alert = true`
  - **Grey**: `live_location_active = false`
- **Polygons**: Only shows `geofences.inner_geom` (not `outer_geom`)

#### AlertsTab
- Lists alerts from Supabase where `active = true`
- Shows device information via joins
- Alert types: 'Inactivity Detected', 'Out of Range', 'Low Battery'

#### AnalyticsTab
- **Active Animals**: Count devices where `active = true`
- **Inactive Animals**: Count devices where `active = false`
- **Alerts Today**: Count alerts where `active = true AND created_at is today`
- **Movement Timeline**: Chart showing speed (km/h) by hour of day from `live_locations`

### 4. Screens Updated

#### LinkDevices
- Reads/writes to `public.devices` table
- Links devices to current user via `user_id`

#### CustomizeAlerts
- Reads/writes to `public.settings` table
- Settings: `inactivity_minutes`, `low_battery_threshold`, `enable_out_of_range`

## Setup Instructions

1. **Run Migrations in Supabase**:
   - Go to Supabase SQL Editor
   - Run `supabase/migrations/001_initial_schema.sql`
   - Run `supabase/migrations/002_rls_policies.sql`

2. **Environment Variables**:
   ```
   VITE_SUPABASE_URL=https://thrmkorvklpvbbctsgti.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

3. **Remove Server Dependencies** (optional):
   - The Express server is no longer needed for data storage
   - All data operations use Supabase directly

## Database Tables

### profiles
- Linked to `auth.users(id)`
- Stores user profile information

### devices
- `id` (UUID, PK)
- `tracker_id` (TEXT, UNIQUE)
- `user_id` (UUID, FK to auth.users)
- `animal_name`, `animal_outside`, `active`, `speed`, `active_time`, `inactive_time`, `total_distance`

### live_locations
- `tracker_id` (TEXT, PK)
- `user_id` (UUID, FK to auth.users)
- `lat`, `lng`, `geom` (PostGIS Point)
- `updated_at` - Used to determine if location is active (within 1 minute)

### alerts
- `id` (UUID, PK)
- `device_id` (UUID, FK to devices)
- `type_alert` ('Inactivity Detected' | 'Out of Range' | 'Low Battery')
- `active` (BOOLEAN)

### settings
- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users, UNIQUE)
- `inactivity_minutes`, `low_battery_threshold`, `enable_out_of_range`

### geofences
- `id` (BIGSERIAL, PK)
- `user_id` (UUID, FK to auth.users)
- `boundary_inner` (JSONB - GeoJSON Polygon)
- `boundary_outer` (JSONB - GeoJSON Polygon, optional)

## Security

All tables have Row Level Security (RLS) enabled:
- Users can only access their own data
- Policies filter by `user_id = auth.uid()`
- Alerts are filtered through device ownership

## Next Steps

1. Test authentication flow
2. Verify RLS policies work correctly
3. Test real-time subscriptions
4. Remove Express server code (if not needed for other purposes)
