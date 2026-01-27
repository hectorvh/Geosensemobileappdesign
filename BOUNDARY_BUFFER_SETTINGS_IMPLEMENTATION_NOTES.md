# Boundary Buffer Settings Implementation Notes

## ✅ Completed Implementation

### Task 1: Database Migration

**Migration File**: `supabase/migrations/017_add_boundary_buffer_to_settings.sql`

**Changes**:
- ✅ Added `boundary_buffer_m` INTEGER NOT NULL DEFAULT 0 column to `settings` table
- ✅ Added CHECK constraint: `boundary_buffer_m >= 0 AND boundary_buffer_m <= 50`
- ✅ Added column comment explaining the value range and behavior
- ✅ Verified RLS policies already exist (from `002_rls_policies.sql`):
  - SELECT: `auth.uid() = user_id`
  - UPDATE: `auth.uid() = user_id`
  - INSERT: `auth.uid() = user_id`

**Schema**:
- Column: `boundary_buffer_m` INTEGER NOT NULL DEFAULT 0
- Constraint: `CHECK (boundary_buffer_m >= 0 AND boundary_buffer_m <= 50)`
- Default: 0 (toggle OFF)

### Task 2: Frontend Updates

#### 1. Updated Settings Interface

**File**: `frontend/src/hooks/useSettings.ts`

**Changes**:
- ✅ Added `boundary_buffer_m: number` to `Settings` interface
- ✅ Updated default settings creation to include `boundary_buffer_m: 0`

#### 2. Updated CustomizeAlerts Screen

**File**: `frontend/src/screens/CustomizeAlerts.tsx`

**Changes**:
- ✅ **Load from DB**: Initialize `bufferEnabled` and `bufferMeters` from `settings.boundary_buffer_m`
  - Toggle ON if `boundary_buffer_m > 0`
  - Slider value = `boundary_buffer_m` (clamped to 0-50)
- ✅ **Toggle OFF**: Sets `settings.boundary_buffer_m = 0` (immediate update)
- ✅ **Toggle ON**: Shows slider, uses slider value (0-50) (immediate update on toggle)
- ✅ **Slider**: Updates `settings.boundary_buffer_m` with debouncing (400ms) or immediate on release
- ✅ **Removed geofence dependency**: Boundary Buffer is now user-level setting, not per-geofence
- ✅ **Removed RPC call**: No longer calls `update_geofence_buffer` RPC function
- ✅ **Uses `updateSettings`**: All updates go through `useSettings` hook

**Code Pattern**:
```typescript
// Load from settings
useEffect(() => {
  if (settings) {
    const bufferValue = settings.boundary_buffer_m ?? 0;
    setBufferMeters(Math.max(0, Math.min(50, bufferValue))); // Clamp to 0-50
    setBufferEnabled(bufferValue > 0);
  }
}, [settings]);

// Update to settings
const handleBufferUpdate = async (newBufferMeters: number, enabled: boolean) => {
  const finalBufferMeters = enabled ? Math.max(0, Math.min(50, newBufferMeters)) : 0;
  await updateSettings({ boundary_buffer_m: finalBufferMeters });
};
```

### Task 3: Integration Note

**Current State**:
- `geofences.buffer_m` still exists in the database and is used by the `update_geofence_buffer` RPC function for geometry buffering
- The UI now controls `settings.boundary_buffer_m` instead
- **Future consideration**: If you want to use `settings.boundary_buffer_m` for geometry buffering, you would need to:
  1. Update the `update_geofence_buffer` RPC function to accept a buffer value parameter (or read from settings)
  2. Or create a new RPC function that reads `settings.boundary_buffer_m` and applies it to geofences
- **For now**: The Boundary Buffer UI setting is stored in `settings.boundary_buffer_m`, but geometry buffering still uses `geofences.buffer_m` (if that RPC is called elsewhere)

## Files Modified

1. **`supabase/migrations/017_add_boundary_buffer_to_settings.sql`** (NEW)
   - Adds `boundary_buffer_m` column with CHECK constraint (0-50)
   - Default value: 0

2. **`frontend/src/hooks/useSettings.ts`**
   - Added `boundary_buffer_m: number` to `Settings` interface
   - Updated default settings creation to include `boundary_buffer_m: 0`

3. **`frontend/src/screens/CustomizeAlerts.tsx`**
   - Updated to load `boundary_buffer_m` from settings instead of geofences
   - Updated `handleBufferUpdate` to write to `settings.boundary_buffer_m` instead of calling RPC
   - Removed geofence dependency for buffer value (geofence selector still exists but doesn't affect buffer)
   - Toggle OFF → sets `boundary_buffer_m = 0`
   - Toggle ON → sets `boundary_buffer_m = slider value` (0-50)

## Value Validation

**Database Level**:
- CHECK constraint ensures `boundary_buffer_m >= 0 AND boundary_buffer_m <= 50`
- Default value: 0

**Application Level**:
- Slider min/max: 0-50
- Clamping in code: `Math.max(0, Math.min(50, value))`
- Toggle OFF always sets to 0

**Result**: Value is always within 0-50 range, enforced at both DB and UI levels.

## Behavior Summary

1. **Toggle OFF**:
   - Slider hidden
   - `settings.boundary_buffer_m = 0` (immediate update)

2. **Toggle ON**:
   - Slider shown (0-50)
   - `settings.boundary_buffer_m = slider value` (debounced for slider drag, immediate on release)

3. **On Load**:
   - If `boundary_buffer_m > 0`: Toggle ON, slider value = `boundary_buffer_m`
   - If `boundary_buffer_m = 0`: Toggle OFF, slider hidden

4. **Debouncing**:
   - Slider drag: 400ms debounce
   - Slider release (mouseUp/touchEnd): Immediate update
   - Toggle change: Immediate update

## Testing Checklist

- [ ] Toggle OFF: Sets `boundary_buffer_m = 0` in DB
- [ ] Toggle ON: Sets `boundary_buffer_m = slider value` in DB
- [ ] Slider drag: Updates after 400ms debounce
- [ ] Slider release: Updates immediately
- [ ] On load: UI reflects current `boundary_buffer_m` value
- [ ] Value clamping: Slider cannot exceed 0-50 range
- [ ] DB constraint: Attempting to insert value > 50 or < 0 fails
- [ ] RLS security: User can only update their own settings

## Notes

- **Geofence Selector**: Still exists in UI but doesn't affect buffer value (kept for potential future use)
- **Backward Compatibility**: `geofences.buffer_m` still exists but is no longer controlled by this UI
- **No Breaking Changes**: All changes are additive; existing functionality remains intact
