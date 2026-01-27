# Speed Aggregation System

This migration implements a hierarchical speed aggregation system for GPS tracking data.

## Architecture

### Three-Tier Aggregation Hierarchy

1. **speed_samples_2s** (2-second resolution, 1 minute retention)
   - Source of truth for real-time alerts
   - Used for geofence checks
   - Automatically aggregated into 1-minute buckets

2. **speed_samples_1m** (1-minute resolution, 1 hour retention)
   - Aggregated ONLY from `speed_samples_2s`
   - Stores: avg_speed_mps, stddev_speed_mps, n_samples
   - Automatically aggregated into hourly buckets

3. **hourly_speed_stats** (1-hour resolution, 7 days retention)
   - Aggregated ONLY from `speed_samples_1m`
   - Stores: avg_speed_mps, stddev_speed_mps, n_minutes
   - Used for historical analytics

## Usage

### Ingesting GPS Data

```sql
-- Using UUID tracker_id (recommended)
SELECT ingest_gps_sample(
  'tracker-uuid-here'::UUID,
  now(),
  51.969205,  -- lat
  7.595761,   -- lon
  2.5,        -- speed_mps
  10.0        -- accuracy_m (optional)
);

-- Using TEXT tracker_id (backward compatibility)
SELECT ingest_gps_sample_text(
  'GPS001',
  now(),
  51.969205,
  7.595761,
  2.5,
  10.0
);
```

### Querying Speed Data

```sql
-- Current speed (latest minute)
SELECT * FROM get_current_speed('tracker-uuid'::UUID);

-- Last hour average
SELECT * FROM get_last_hour_avg_speed('tracker-uuid'::UUID);

-- Last week hourly stats
SELECT * FROM get_last_week_hourly_stats('tracker-uuid'::UUID);

-- Speed timeline for charts
SELECT * FROM get_speed_timeline(
  'tracker-uuid'::UUID,
  now() - interval '24 hours',
  now()
);

-- Recent samples for alerts
SELECT * FROM get_recent_2s_samples('tracker-uuid'::UUID, 1);
```

### Cleanup

```sql
-- Manual cleanup (run periodically)
SELECT cleanup_all_speed_tables();

-- Or individual cleanups
SELECT cleanup_speed_samples_2s();
SELECT cleanup_speed_samples_1m();
SELECT cleanup_hourly_speed_stats();
```

## Scheduled Cleanup

### Option 1: Supabase pg_cron (if enabled)

```sql
-- Run every minute
SELECT cron.schedule(
  'cleanup-speed-samples-2s',
  '*/1 * * * *',
  'SELECT cleanup_speed_samples_2s()'
);

-- Run every 5 minutes
SELECT cron.schedule(
  'cleanup-speed-samples-1m',
  '*/5 * * * *',
  'SELECT cleanup_speed_samples_1m()'
);

-- Run every hour
SELECT cron.schedule(
  'cleanup-hourly-speed-stats',
  '0 * * * *',
  'SELECT cleanup_hourly_speed_stats()'
);
```

### Option 2: Supabase Edge Function + External Cron

Create an Edge Function that calls `scheduled_cleanup()` and schedule it via:
- GitHub Actions
- External cron service
- Supabase scheduled functions (if available)

## Data Retention

- **speed_samples_2s**: 1 minute (for real-time alerts)
- **speed_samples_1m**: 1 hour (for recent analytics)
- **hourly_speed_stats**: 7 days (for historical analytics)

## Aggregation Rules (CRITICAL)

1. **2s → 1m**: `speed_samples_1m.avg_speed_mps` MUST be computed from ALL `speed_samples_2s` records in that minute
2. **1m → 1h**: `hourly_speed_stats.avg_speed_mps` MUST be computed from ALL `speed_samples_1m` records in that hour
3. **NO DIRECT 2s → 1h**: Never aggregate directly from 2s to hourly

## Migration Order

1. `004_trackers_and_speed_aggregation.sql` - Create tables
2. `005_speed_aggregation_functions.sql` - Create aggregation functions
3. `006_cleanup_and_retention.sql` - Create cleanup functions
4. `007_speed_aggregation_rls.sql` - Add RLS policies
5. `008_example_queries.sql` - Example query functions
6. `009_migrate_existing_data.sql` - Migrate existing data

## Backward Compatibility

- `live_locations_compat` view provides compatibility with existing code
- `ingest_gps_sample_text()` function accepts TEXT tracker_id
- Existing `devices` table remains unchanged
