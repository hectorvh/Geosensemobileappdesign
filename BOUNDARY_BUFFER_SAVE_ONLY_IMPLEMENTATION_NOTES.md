# Boundary Buffer Save-Only Implementation Notes

## ✅ Completed Implementation

### Goal
Changed Boundary Buffer behavior so it only saves to Supabase when the user clicks the "Save" button, not immediately on toggle/slider changes.

### Changes Made

#### 1. Removed Immediate DB Updates

**File**: `frontend/src/screens/CustomizeAlerts.tsx`

**Removed**:
- ✅ `handleBufferUpdate` function that immediately saved to DB
- ✅ `isUpdatingBuffer` state (no longer needed)
- ✅ `bufferUpdateTimeoutRef` debounce timer ref (no longer needed)
- ✅ `useCallback` and `useRef` imports (no longer needed)
- ✅ Cleanup `useEffect` for timeout (no longer needed)

**Result**: Toggle and slider changes now only update local state, no DB writes.

#### 2. Updated Local State Management

**Changes**:
- ✅ Toggle change: Only calls `setBufferEnabled(checked)` - local state only
- ✅ Slider change: Only calls `setBufferMeters(newValue)` with clamping - local state only
- ✅ Removed `disabled={isUpdatingBuffer}` from Switch (now uses `disabled={settingsLoading}`)
- ✅ Removed `disabled={isUpdatingBuffer}` from slider (now uses `disabled={settingsLoading}`)
- ✅ Removed "Updating..." loading indicator (no longer needed)

**Code Pattern**:
```typescript
// Toggle - local state only
<Switch
  checked={bufferEnabled}
  onCheckedChange={setBufferEnabled}
  disabled={settingsLoading}
/>

// Slider - local state only
<input
  type="range"
  value={bufferMeters}
  onChange={(e) => {
    const newValue = parseInt(e.target.value);
    setBufferMeters(Math.max(0, Math.min(50, newValue))); // Clamp to 0-50
  }}
  disabled={settingsLoading}
/>
```

#### 3. Updated Save Button Logic

**File**: `frontend/src/screens/CustomizeAlerts.tsx`

**Changes**:
- ✅ `handleSaveSettings` now computes `finalBufferMeters` from local state:
  - If `bufferEnabled` is `false` → `finalBufferMeters = 0`
  - If `bufferEnabled` is `true` → `finalBufferMeters = bufferMeters` (clamped to 0-50)
- ✅ Includes `boundary_buffer_m: finalBufferMeters` in the `updates` object
- ✅ Saves all settings (alerts + boundary buffer) in a single operation

**Code Pattern**:
```typescript
const handleSaveSettings = async () => {
  // Compute final value from local state
  const finalBufferMeters = bufferEnabled 
    ? Math.max(0, Math.min(50, bufferMeters)) 
    : 0;
  
  const updates = {
    enable_out_of_range: outOfRange,
    enable_inactiviy: inactivity,
    enable_low_battery: lowBattery,
    boundary_buffer_m: finalBufferMeters, // Save Boundary Buffer
  };
  
  await updateSettings(updates);
};
```

#### 4. Local State Initialization

**Already Implemented**:
- ✅ Local state is initialized from `settings.boundary_buffer_m` when screen loads
- ✅ `bufferEnabled = (settings.boundary_buffer_m > 0)`
- ✅ `bufferMeters = clamp(settings.boundary_buffer_m, 0, 50)`

**Code**:
```typescript
useEffect(() => {
  if (settings) {
    // Initialize Boundary Buffer local state from DB
    const bufferValue = settings.boundary_buffer_m ?? 0;
    setBufferMeters(Math.max(0, Math.min(50, bufferValue)));
    setBufferEnabled(bufferValue > 0);
  }
}, [settings]);
```

## Files Modified

1. **`frontend/src/screens/CustomizeAlerts.tsx`**
   - Removed `handleBufferUpdate` function
   - Removed `isUpdatingBuffer` state
   - Removed `bufferUpdateTimeoutRef` ref
   - Removed debounce cleanup `useEffect`
   - Removed `useCallback` and `useRef` imports
   - Updated toggle to only update local state
   - Updated slider to only update local state
   - Updated `handleSaveSettings` to include `boundary_buffer_m` in save operation

## Behavior Summary

### Before Save (Local State Only)
1. **Toggle OFF**: Sets `bufferEnabled = false` (local), slider hidden
2. **Toggle ON**: Sets `bufferEnabled = true` (local), slider shown
3. **Slider Change**: Sets `bufferMeters = newValue` (local, clamped 0-50)
4. **No DB writes**: All changes are local state only

### On Save Button Click
1. **Compute final value**: 
   - If `bufferEnabled = false` → `boundary_buffer_m = 0`
   - If `bufferEnabled = true` → `boundary_buffer_m = bufferMeters` (0-50)
2. **Save to DB**: Updates `settings.boundary_buffer_m` along with other settings
3. **Success**: Shows toast and navigates to `/main`
4. **Error**: Shows error toast, stays on screen

### On Back/Navigate Without Save
- Changes are discarded (local state only)
- No DB writes occur
- User can return and see original values from DB

## Value Validation

**Local State**:
- Slider min/max: 0-50 (enforced by HTML input)
- Clamping: `Math.max(0, Math.min(50, value))` on change
- Toggle OFF always results in 0 on save

**Database**:
- CHECK constraint: `boundary_buffer_m >= 0 AND boundary_buffer_m <= 50`
- Default: 0

**Result**: Value is always within 0-50 range, validated at both UI and DB levels.

## Performance

- ✅ **No repeated fetches**: Uses existing `settings` from `useSettings` hook
- ✅ **Single save operation**: All settings (alerts + boundary buffer) saved together
- ✅ **No debouncing needed**: No immediate DB writes, so no debounce required
- ✅ **Real-time subscription**: `useSettings` hook already has real-time subscription for settings changes

## Testing Checklist

- [ ] Toggle OFF: Only updates local state, no DB write
- [ ] Toggle ON: Only updates local state, no DB write
- [ ] Slider change: Only updates local state, no DB write
- [ ] Save button: Updates `boundary_buffer_m` in DB
- [ ] Save with toggle OFF: Sets `boundary_buffer_m = 0` in DB
- [ ] Save with toggle ON: Sets `boundary_buffer_m = slider value` in DB
- [ ] Back button: Discards changes, no DB write
- [ ] On load: UI reflects current `boundary_buffer_m` from DB
- [ ] Value clamping: Slider cannot exceed 0-50 range
- [ ] Settings refresh: After save, other screens see updated value (via real-time subscription)

## Notes

- **No Breaking Changes**: All changes are internal to the component
- **Consistent Pattern**: Boundary Buffer now follows same pattern as other alert toggles (save on Save button)
- **User Experience**: Users can experiment with slider/toggle without committing changes until they click Save
- **Data Integrity**: All validation still enforced (0-50 range, clamping, DB constraint)
