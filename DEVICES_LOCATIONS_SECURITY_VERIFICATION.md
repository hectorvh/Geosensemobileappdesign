# Devices and Locations Security Verification Checklist

## Overview
This document verifies that devices and live_locations are properly protected so users can only access their own linked devices and corresponding locations.

## Security Layers Implemented

### 1. Database Layer (RLS - Source of Truth) ✅

**Migration**: `supabase/migrations/013_devices_locations_security_hardening.sql`

#### devices Table Policies:
- ✅ SELECT: `auth.uid() = user_id` - Users can only read their own device links
- ✅ INSERT: `WITH CHECK (auth.uid() = user_id)` - Users can only insert with their own user_id
- ✅ UPDATE: `USING` and `WITH CHECK` both enforce ownership
- ✅ DELETE: `auth.uid() = user_id` - Users can only delete their own device links

#### live_locations Table Policies:
- ✅ SELECT: `EXISTS (SELECT 1 FROM devices WHERE devices.user_id = auth.uid() AND devices.tracker_id = live_locations.tracker_id)` - Users can only read locations for trackers they've linked
- ✅ INSERT: Only allowed if user has linked the tracker (or use service role for ingest)
- ✅ UPDATE: Only allowed if user has linked the tracker
- ✅ DELETE: No policy (users cannot delete locations - only ingest service)

**Constraints:**
- ✅ `devices.user_id` is NOT NULL
- ✅ Composite index on `(user_id, tracker_id)` for efficient lookups
- ✅ Composite index on `(user_id, id)` for devices

**Secure View:**
- ✅ `user_live_locations` view joins devices + live_locations, automatically filtered by RLS

### 2. Client Layer (Defense in Depth) ✅

#### useDevices Hook:
- ✅ Requires `userId` parameter - returns empty array if not provided
- ✅ Explicitly filters by `user_id` in all queries: `.eq('user_id', userId)`
- ✅ Realtime subscription filtered by `user_id`: `filter: user_id=eq.${userId}`

#### useLiveLocations Hook:
- ✅ Requires `userId` parameter - returns empty array if not provided
- ✅ Uses secure `user_live_locations` view (automatically filtered by RLS)
- ✅ Falls back to direct `live_locations` query (RLS enforces security)
- ✅ Realtime subscription respects RLS (only receives authorized events)

#### MapTab:
- ✅ Only displays devices from `useDevices(user?.id)`
- ✅ Only displays locations from `useLiveLocations(user?.id, 5000)`
- ✅ Markers only show locations for user's linked trackers

#### LinkDevices:
- ✅ Only displays devices from `useDevices(user?.id)`
- ✅ Update operations: Pre-verification + explicit filter + result check
- ✅ Delete operations: Pre-verification + explicit filter + result check
- ✅ Error messages: User-friendly permission errors

#### HomeTab, AnalyticsTab, AlertsTab:
- ✅ All use `useDevices(user?.id)` - only user's devices
- ✅ AnalyticsTab uses `useLiveLocations(user?.id, 5000)` - only user's locations

### 3. Update/Delete Safety ✅

**Update Operations (LinkDevices):**
- ✅ Pre-verification: Checks device exists and belongs to user
- ✅ Explicit filter: `.eq('user_id', user.id)` in update query
- ✅ Result verification: Checks if update succeeded (0 rows = denied)
- ✅ Error messages: "You don't have permission to edit this device"

**Delete Operations (LinkDevices):**
- ✅ Pre-verification: Checks device exists and belongs to user
- ✅ Explicit filter: `.eq('user_id', user.id)` in delete query
- ✅ Result verification: Checks if delete succeeded (0 rows = denied)
- ✅ Only deletes association row, not the tracker itself
- ✅ Error messages: "You don't have permission to remove this device"

## Testing Verification Plan

### Test 1: Device Isolation
**Steps:**
1. User A links tracker T1 to their account (creates device record)
2. User B logs in
3. User B views LinkDevices screen
4. User B views MapTab
5. User B views HomeTab/AnalyticsTab

**Expected Result:**
- User B should NOT see User A's device in LinkDevices
- User B should NOT see User A's device in any tab
- User B's device list should be empty (if they have none)

**Verification:**
```sql
-- As User B (auth.uid() = User B's UUID)
SELECT * FROM devices WHERE tracker_id = 'T1';
-- Should return 0 rows (RLS blocks it)
```

### Test 2: Location Isolation
**Steps:**
1. User A links tracker T1
2. Tracker T1 has location data in live_locations
3. User B logs in (has NOT linked T1)
4. User B views MapTab

**Expected Result:**
- User B should NOT see location for tracker T1
- User B should NOT see any markers for T1
- MapTab should show no locations (if User B has no linked trackers)

**Verification:**
```sql
-- As User B
SELECT * FROM live_locations WHERE tracker_id = 'T1';
-- Should return 0 rows (RLS blocks it - no device link exists)

-- As User B
SELECT * FROM user_live_locations;
-- Should only return locations for User B's linked trackers
```

### Test 3: Update Protection
**Steps:**
1. User A links tracker T1 (device ID: 100)
2. User B attempts to update it via LinkDevices

**Expected Result:**
- User B cannot see device 100 in UI
- If User B somehow gets the ID, update should fail
- Error message: "You don't have permission to edit this device"

**Verification:**
```sql
-- As User B
UPDATE devices SET name = 'Hacked' WHERE id = '100';
-- Should affect 0 rows (RLS blocks it)
```

### Test 4: Delete Protection
**Steps:**
1. User A links tracker T1 (device ID: 100)
2. User B attempts to delete it

**Expected Result:**
- User B cannot see device 100 in UI
- If User B somehow gets the ID, delete should fail
- Error message: "You don't have permission to remove this device"

**Verification:**
```sql
-- As User B
DELETE FROM devices WHERE id = '100';
-- Should affect 0 rows (RLS blocks it)
```

### Test 5: Location Access via Devices Link
**Steps:**
1. User A links tracker T1
2. User B links tracker T1 (same tracker, different user)
3. Tracker T1 has location in live_locations
4. Both users view MapTab

**Expected Result:**
- User A can see location for T1 (they have device link)
- User B can see location for T1 (they also have device link)
- Both see the same location data (many-to-many relationship works)

**Verification:**
```sql
-- As User A
SELECT * FROM live_locations WHERE tracker_id = 'T1';
-- Should return 1 row (User A has device link)

-- As User B
SELECT * FROM live_locations WHERE tracker_id = 'T1';
-- Should return 1 row (User B has device link)
```

### Test 6: Realtime Subscription Isolation
**Steps:**
1. User A links tracker T1
2. User B is logged in (no linked trackers)
3. Location for T1 is updated

**Expected Result:**
- User A's subscription should receive the update
- User B's subscription should NOT receive the update
- User B's UI should not update

**Verification:**
- Check subscription filters: `filter: user_id=eq.${userId}` for devices
- RLS on live_locations automatically filters realtime events

### Test 7: Unlink Device (Delete Association)
**Steps:**
1. User A links tracker T1
2. User A deletes/unlinks the device
3. User A views MapTab

**Expected Result:**
- Device record is deleted from devices table
- Location for T1 should no longer be visible to User A
- Other users who have linked T1 should still see the location

**Verification:**
```sql
-- After User A unlinks T1
-- As User A
SELECT * FROM live_locations WHERE tracker_id = 'T1';
-- Should return 0 rows (no device link exists anymore)
```

## Code Review Checklist

### Database
- [x] RLS enabled on devices table
- [x] RLS enabled on live_locations table
- [x] devices SELECT policy: `auth.uid() = user_id`
- [x] devices INSERT policy: `WITH CHECK (auth.uid() = user_id)`
- [x] devices UPDATE policy: `USING` and `WITH CHECK` both enforce ownership
- [x] devices DELETE policy: `auth.uid() = user_id`
- [x] live_locations SELECT policy: EXISTS subquery checking devices table
- [x] live_locations INSERT policy: Only if user has linked tracker
- [x] live_locations UPDATE policy: Only if user has linked tracker
- [x] live_locations DELETE: No policy (users cannot delete)
- [x] `devices.user_id` is NOT NULL
- [x] Composite indexes on devices: `(user_id, tracker_id)`, `(user_id, id)`
- [x] Secure view `user_live_locations` created

### Client Code
- [x] `useDevices` requires userId parameter
- [x] `useLiveLocations` requires userId parameter
- [x] All device queries filter by `user_id`
- [x] All location queries use secure view or rely on RLS
- [x] MapTab only displays user's devices and locations
- [x] LinkDevices only displays user's devices
- [x] Update operations verify ownership
- [x] Delete operations verify ownership
- [x] Error messages for permission failures
- [x] Realtime subscriptions filtered by user_id

## Security Guarantees

1. **Database Level (RLS)**: Even if client code is compromised, RLS prevents unauthorized access
2. **Client Level (Defense in Depth)**: Client code explicitly filters to prevent accidental exposure
3. **Operation Level**: Update/delete operations verify ownership before execution
4. **Realtime Level**: Subscriptions are filtered and RLS enforces at database level
5. **Location Access**: Users can only see locations for trackers they've explicitly linked

## Migration Order

Run migrations in this order:
1. `001_initial_schema.sql` - Creates devices and live_locations tables
2. `002_rls_policies.sql` - Initial RLS policies (will be replaced)
3. `010_update_devices_for_linking.sql` - Device linking updates
4. `013_devices_locations_security_hardening.sql` - **NEW** - Security hardening

## Notes

- The existing RLS policies in `002_rls_policies.sql` are replaced by stronger policies in `013_devices_locations_security_hardening.sql`
- The migration safely handles any existing NULL user_id values (deletes them)
- Location ingest should use service role to bypass RLS (or use the INSERT policy if user has linked tracker)
- The `check_tracker_exists` function uses SECURITY DEFINER to allow existence checks before linking
- All client code changes are backward compatible and add security without breaking existing features
