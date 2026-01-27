# Geofences Security Verification Checklist

## Overview
This document verifies that geofences are properly protected so users can only access their own polygons.

## Security Layers Implemented

### 1. Database Layer (RLS - Source of Truth) ✅

**Migration**: `supabase/migrations/012_geofences_security_hardening.sql`

**Policies Implemented:**
- ✅ SELECT: `auth.uid() = user_id` - Users can only read their own geofences
- ✅ INSERT: `auth.uid() = user_id` (WITH CHECK) - Users can only insert with their own user_id
- ✅ UPDATE: `auth.uid() = user_id` (USING + WITH CHECK) - Users can only update their own geofences
- ✅ DELETE: `auth.uid() = user_id` - Users can only delete their own geofences

**Constraints:**
- ✅ `user_id` is NOT NULL
- ✅ `user_id` has FK to `auth.users(id)`
- ✅ Composite index on `(user_id, id)` for efficient lookups

**RLS Status:**
- ✅ RLS is enabled on `geofences` table

### 2. Client Layer (Defense in Depth) ✅

**useGeofences Hook:**
- ✅ Requires `userId` parameter - returns empty array if not provided
- ✅ Explicitly filters by `user_id` in all queries: `.eq('user_id', userId)`
- ✅ Realtime subscription filtered by `user_id`: `filter: user_id=eq.${userId}`

**MapTab:**
- ✅ Only displays geofences from `useGeofences(user?.id)`
- ✅ Polygon click handler verifies ownership before selection
- ✅ Only allows selecting geofences from user-filtered list

**DrawGeofence (Create Mode):**
- ✅ Only loads geofences from `useGeofences(user?.id)`
- ✅ Displays only user's existing geofences
- ✅ New geofences inserted with explicit `user_id: user.id`

**DrawGeofence (Edit Mode):**
- ✅ URL param validation: Verifies ownership when loading from URL
- ✅ Selection validation: Only allows selecting from user-filtered list
- ✅ Update verification: Verifies ownership before update, checks result count
- ✅ Delete verification: Verifies ownership before delete, checks result count
- ✅ Error handling: Shows "You don't have permission" message on failures

### 3. Update/Delete Safety ✅

**Update Operations:**
- ✅ Pre-verification: Checks geofence exists and belongs to user
- ✅ Explicit filter: `.eq('user_id', user.id)` in update query
- ✅ Result verification: Checks if update succeeded (0 rows = denied)
- ✅ Error messages: User-friendly permission error messages

**Delete Operations:**
- ✅ Pre-verification: Checks geofence exists and belongs to user
- ✅ Explicit filter: `.eq('user_id', user.id)` in delete query
- ✅ Result verification: Checks if delete succeeded (0 rows = denied)
- ✅ Error messages: User-friendly permission error messages

## Testing Verification Plan

### Test 1: User Isolation (SELECT)
**Steps:**
1. User A creates a geofence (ID: 100)
2. User B logs in
3. User B views MapTab
4. User B views DrawGeofence

**Expected Result:**
- User B should NOT see User A's geofence in MapTab
- User B should NOT see User A's geofence in DrawGeofence
- User B's geofences list should be empty (if they have none)

**Verification:**
```sql
-- As User B (auth.uid() = User B's UUID)
SELECT * FROM geofences WHERE id = 100;
-- Should return 0 rows (RLS blocks it)
```

### Test 2: Update Protection
**Steps:**
1. User A creates geofence (ID: 100)
2. User B attempts to update it via DrawGeofence edit mode
3. User B attempts direct update query

**Expected Result:**
- User B cannot access geofence 100 in edit mode
- If User B somehow gets the ID, update should fail
- Error message: "You don't have permission to edit this zone"

**Verification:**
```sql
-- As User B
UPDATE geofences SET name = 'Hacked' WHERE id = 100;
-- Should affect 0 rows (RLS blocks it)
```

### Test 3: Delete Protection
**Steps:**
1. User A creates geofence (ID: 100)
2. User B attempts to delete it

**Expected Result:**
- User B cannot see geofence 100 in UI
- If User B somehow gets the ID, delete should fail
- Error message: "You don't have permission to delete this zone"

**Verification:**
```sql
-- As User B
DELETE FROM geofences WHERE id = 100;
-- Should affect 0 rows (RLS blocks it)
```

### Test 4: URL Parameter Protection
**Steps:**
1. User A creates geofence (ID: 100)
2. User B manually navigates to `/draw-geofence?mode=edit&id=100`

**Expected Result:**
- DrawGeofence should detect geofence doesn't belong to User B
- Should switch to create mode
- Should show error: "You don't have permission to edit this zone"
- Should clear the invalid ID from URL

### Test 5: Realtime Subscription Isolation
**Steps:**
1. User A creates geofence
2. User B is logged in with realtime subscription active

**Expected Result:**
- User B's subscription should NOT receive events for User A's geofence
- User B's UI should not update when User A creates/updates geofences

**Verification:**
- Check subscription filter: `filter: user_id=eq.${userId}`
- RLS also enforces this at database level

### Test 6: Insert Protection
**Steps:**
1. User B attempts to insert geofence with `user_id` set to User A's UUID

**Expected Result:**
- Insert should fail (RLS WITH CHECK prevents it)
- Error: Permission denied

**Verification:**
```sql
-- As User B, trying to insert with User A's UUID
INSERT INTO geofences (name, user_id, boundary_inner) 
VALUES ('Hacked', '<User A UUID>', '...');
-- Should fail (RLS WITH CHECK blocks it)
```

## Code Review Checklist

### Database
- [x] RLS enabled on geofences table
- [x] SELECT policy: `auth.uid() = user_id`
- [x] INSERT policy: `WITH CHECK (auth.uid() = user_id)`
- [x] UPDATE policy: `USING` and `WITH CHECK` both enforce ownership
- [x] DELETE policy: `auth.uid() = user_id`
- [x] `user_id` is NOT NULL
- [x] Index on `(user_id, id)` for efficient lookups

### Client Code
- [x] `useGeofences` requires userId parameter
- [x] All queries filter by `user_id`
- [x] Realtime subscription filtered by `user_id`
- [x] MapTab only displays user's geofences
- [x] DrawGeofence only loads user's geofences
- [x] Update operations verify ownership
- [x] Delete operations verify ownership
- [x] URL param validation verifies ownership
- [x] Error messages for permission failures

## Security Guarantees

1. **Database Level (RLS)**: Even if client code is compromised, RLS prevents unauthorized access
2. **Client Level (Defense in Depth)**: Client code explicitly filters to prevent accidental exposure
3. **Operation Level**: Update/delete operations verify ownership before execution
4. **Realtime Level**: Subscriptions are filtered to only receive user's own changes

## Migration Order

Run migrations in this order:
1. `001_initial_schema.sql` - Creates geofences table
2. `002_rls_policies.sql` - Initial RLS policies (may be replaced)
3. `012_geofences_security_hardening.sql` - **NEW** - Strengthens security

## Notes

- The existing RLS policies in `002_rls_policies.sql` are replaced by stronger policies in `012_geofences_security_hardening.sql`
- The migration safely handles any existing NULL user_id values (deletes them)
- All client code changes are backward compatible and add security without breaking existing features
