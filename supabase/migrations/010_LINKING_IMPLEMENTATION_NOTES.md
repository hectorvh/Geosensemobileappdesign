# Device Linking Implementation Notes

## Overview

This migration implements a many-to-many relationship between users (profiles) and trackers (from live_locations) using the `devices` table as the association table.

## Key Assumptions

### 1. live_locations Table Structure
- **Assumption**: `live_locations` stores one row per tracker_id (PRIMARY KEY on tracker_id)
- **Evidence**: The schema shows `CONSTRAINT live_locations_pkey PRIMARY KEY (tracker_id)`
- **Implication**: Each tracker_id appears only once in live_locations, representing the "latest" location
- **Note**: This is a "latest location" table, not a historical log

### 2. trackers Table (from migration 004)
- **Status**: KEPT - Used by speed aggregation system (speed_samples_2s, speed_samples_1m, hourly_speed_stats)
- **Not Used For**: Device linking (linking uses live_locations.tracker_id directly)
- **Reason**: The speed aggregation system requires UUID-based trackers, while device linking uses TEXT tracker_id from live_locations

### 3. Many-to-Many Relationship
- **One user** can link **multiple trackers** (one-to-many from user perspective)
- **One tracker** can be linked by **multiple users** (one-to-many from tracker perspective)
- **Implementation**: Composite unique constraint on (user_id, tracker_id) in devices table
- **Result**: True many-to-many relationship

## Schema Changes

### devices Table Updates
1. **Added Columns**:
   - `age` (INTEGER, nullable) - Animal age in years
   - `weight` (NUMERIC, nullable) - Animal weight in kg
   - `batch_id` (TEXT, nullable) - Batch identifier
   - `last_update` (TIMESTAMPTZ, nullable) - Last update from live_locations

2. **Removed Constraint**:
   - Dropped UNIQUE constraint on `tracker_id` (allows many-to-many)

3. **Added Constraints**:
   - Composite UNIQUE on (user_id, tracker_id) - Prevents duplicate links
   - `name` set to NOT NULL (required field)

4. **Indexes**:
   - Composite unique index on (user_id, tracker_id)
   - Index on tracker_id for reverse lookups

### Security (RLS)

1. **devices Table**:
   - Users can only insert/update/delete their own device links
   - Policies check `auth.uid() = user_id`

2. **live_locations Table**:
   - Existing RLS policies remain
   - Added secure function `check_tracker_exists()` for existence checks
   - Function uses SECURITY DEFINER to allow checking without exposing location data

## Frontend Implementation

### LinkDevices.tsx Flow

1. **Form Submission**:
   - Validates tracker_id and name are present
   - Calls `check_tracker_exists()` RPC function
   - If tracker exists → upserts device record
   - If tracker doesn't exist → shows error toast, keeps form editable

2. **Upsert Logic**:
   - Uses Supabase `.upsert()` with `onConflict: 'user_id,tracker_id'`
   - Handles duplicate link attempts gracefully
   - Sets `last_update` from live_locations.updated_at

3. **User Experience**:
   - Loading states during submission
   - Success/error toasts using `sonner`
   - Form remains editable on error
   - Real-time device list updates via Supabase subscriptions

## Migration Order

Run migrations in this order:
1. `001_initial_schema.sql` - Core tables
2. `002_rls_policies.sql` - Initial RLS
3. `010_update_devices_for_linking.sql` - Device linking updates

**Note**: Migration 004 (trackers table) is separate and used only by speed aggregation.

## Testing Checklist

- [ ] Link a device with valid tracker_id → Should succeed
- [ ] Link a device with invalid tracker_id → Should show error
- [ ] Link same tracker_id twice by same user → Should show duplicate error
- [ ] Link same tracker_id by different users → Should succeed (many-to-many)
- [ ] Edit device metadata → Should update successfully
- [ ] Delete device link → Should remove successfully
- [ ] Verify RLS: User A cannot see/edit User B's devices

## Future Considerations

1. **Historical Tracking**: If live_locations becomes historical, consider:
   - Adding a separate `tracker_registry` table
   - Or using the `trackers` table from migration 004 for linking

2. **Performance**: If many users link the same tracker:
   - Consider denormalizing tracker metadata
   - Add indexes on frequently queried fields

3. **Data Migration**: If existing devices need migration:
   - Ensure all devices have valid tracker_id in live_locations
   - Set last_update from live_locations.updated_at
