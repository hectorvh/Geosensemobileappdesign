# Boundary Buffer Implementation Summary

## ✅ Completed Features

### 1. Database Function (PostGIS Safe Buffering)

**Migration File**: `supabase/migrations/014_geofence_buffer_update_function.sql`

**Function**: `update_geofence_buffer(p_geofence_id, p_buffer_m, p_user_id)`

**Features:**
- ✅ Safely converts JSONB GeoJSON to PostGIS geometry
- ✅ Uses `ST_Buffer` with geography cast to ensure meters are used correctly (not degrees)
- ✅ If `buffer_m > 0`: Computes `boundary_outer` using `ST_Buffer(geometry::geography, buffer_m)::geometry`
- ✅ If `buffer_m = 0`: Sets `boundary_outer = boundary_inner` (exact copy)
- ✅ Validates buffer range (0-50 meters)
- ✅ Enforces RLS: Verifies geofence belongs to user
- ✅ Returns updated `buffer_m` and `boundary_outer` for UI refresh

**Security:**
- ✅ Uses `SECURITY DEFINER` to allow function execution
- ✅ Explicitly checks `user_id` ownership before update
- ✅ RLS policies on `geofences` table also enforce security

### 2. CustomizeAlerts Screen Updates

**File**: `frontend/src/screens/CustomizeAlerts.tsx`

**New Features:**

#### A) Geofence Selector
- ✅ Dropdown to select which geofence to configure (if user has multiple)
- ✅ Automatically selects first geofence if only one exists
- ✅ Updates buffer state when geofence selection changes

#### B) Boundary Buffer Box
- ✅ New configuration box matching existing alert boxes styling
- ✅ Toggle switch to enable/disable buffer
- ✅ Slider (0-50 meters) shown when toggle is ON
- ✅ Real-time value display: "X m"
- ✅ Immediate update on toggle change or slider release
- ✅ Loading state during update ("Updating...")
- ✅ Success/error toast notifications

#### C) Migration to Supabase
- ✅ Replaced `useApp()` context with `useSettings()` hook
- ✅ Replaced `useApp()` with `useAuth()` and `useGeofences()`
- ✅ Settings now persist to Supabase `settings` table
- ✅ Buffer updates use RPC function for server-side computation

**UI Behavior:**
- Toggle ON: Shows slider, calls RPC with slider value
- Toggle OFF: Hides slider, calls RPC with `buffer_m = 0`
- Slider: Updates on mouse/touch release (debounced)
- Initial state: Reflects current DB state (`buffer_m > 0` = toggle ON)

### 3. AlertsTab Updates

**File**: `frontend/src/components/tabs/AlertsTab.tsx`

**New Feature:**
- ✅ "Set Alerts" box card (matches "Manage Devices" box style from HomeTab)
- ✅ Clickable box with Bell icon and ChevronRight arrow
- ✅ Navigates to `/customize-alerts` screen
- ✅ Positioned at top of alerts list

## Technical Details

### PostGIS Buffering Approach

**Problem**: GeoJSON stored in JSONB, geometries in EPSG:4326 (degrees), but buffer needs meters.

**Solution**: 
```sql
-- Convert JSONB GeoJSON to geometry
v_geom_inner := ST_SetSRID(ST_GeomFromGeoJSON(v_boundary_inner::text), 4326);

-- Buffer using geography cast (ensures meters, not degrees)
v_geom_outer := ST_Buffer(v_geom_inner::geography, p_buffer_m)::geometry;

-- Convert back to GeoJSON JSONB
v_boundary_outer := ST_AsGeoJSON(v_geom_outer)::jsonb;
```

**Why this works:**
- `ST_Buffer` on `geography` type uses meters (not degrees)
- Casting `geometry::geography` preserves the geometry but enables meter-based operations
- Result is cast back to `geometry` for storage

### RPC Function Return Format

The function returns a table:
```sql
RETURNS TABLE (
  id BIGINT,
  buffer_m INTEGER,
  boundary_outer JSONB
)
```

Frontend receives an array:
```typescript
const { data, error } = await supabase.rpc('update_geofence_buffer', {...});
// data is an array: [{ id, buffer_m, boundary_outer }]
```

### State Management

**Buffer State:**
- `selectedGeofenceId`: Currently selected geofence
- `bufferEnabled`: Toggle state (derived from `buffer_m > 0`)
- `bufferMeters`: Slider value (0-50)
- `isUpdatingBuffer`: Loading state during RPC call

**State Sync:**
- On geofence load: Sets `bufferEnabled` and `bufferMeters` from DB
- On toggle change: Immediately calls RPC
- On slider release: Calls RPC with new value
- After RPC success: Updates local state

## Files Modified

1. **`supabase/migrations/014_geofence_buffer_update_function.sql`** (NEW)
   - Creates `update_geofence_buffer` RPC function
   - Handles PostGIS geometry conversion and buffering

2. **`frontend/src/screens/CustomizeAlerts.tsx`**
   - Migrated from `useApp()` to Supabase hooks
   - Added geofence selector
   - Added Boundary Buffer box with toggle + slider
   - Integrated RPC function calls

3. **`frontend/src/components/tabs/AlertsTab.tsx`**
   - Added "Set Alerts" box card
   - Added navigation to customize-alerts

## Migration Instructions

1. **Run SQL Migration**:
   ```sql
   -- Execute in Supabase SQL Editor
   -- File: supabase/migrations/014_geofence_buffer_update_function.sql
   ```

2. **Verify Function**:
   ```sql
   -- Test the function (replace with actual IDs)
   SELECT * FROM update_geofence_buffer(
     p_geofence_id := 1,
     p_buffer_m := 10,
     p_user_id := '<your-user-id>'
   );
   ```

3. **Test UI**:
   - Navigate to AlertsTab → Click "Set Alerts"
   - Select a geofence (if multiple)
   - Toggle Boundary Buffer ON/OFF
   - Adjust slider (0-50 meters)
   - Verify `boundary_outer` updates in database

## Testing Checklist

- [ ] Toggle ON: Slider appears, buffer updates
- [ ] Toggle OFF: Slider hides, buffer_m = 0, boundary_outer = boundary_inner
- [ ] Slider: Value updates correctly (0-50)
- [ ] Multiple geofences: Selector appears, switching works
- [ ] Single geofence: No selector, uses first geofence
- [ ] No geofences: Shows message to create one first
- [ ] Loading state: Shows "Updating..." during RPC call
- [ ] Success toast: Appears after successful update
- [ ] Error handling: Shows error toast on failure
- [ ] RLS security: User can only update own geofences
- [ ] PostGIS accuracy: Buffer distance is in meters (not degrees)

## Notes

- **Backward Compatible**: Existing geofence creation/edit flows unchanged
- **Server-Side Computation**: Buffer calculation happens in PostGIS (more accurate than client-side)
- **Real-Time Updates**: Buffer updates immediately (no "Save" button needed for buffer)
- **Settings Persistence**: Alert toggles still require "Save" button
- **Geofence Selection**: If user has multiple geofences, they can select which one to configure
- **Default Behavior**: First geofence is selected by default
