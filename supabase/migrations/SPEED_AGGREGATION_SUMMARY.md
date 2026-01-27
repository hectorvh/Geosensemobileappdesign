# Speed Aggregation System - Implementation Summary

## Overview

This migration implements a hierarchical 3-tier speed aggregation system for GPS tracking data with strict retention policies and aggregation rules.

## Database Schema

### Core Tables

1. **`trackers`** - Parent table for all GPS tracking
   - `id` (UUID, PK)
   - `tracker_id` (TEXT, UNIQUE) - Legacy compatibility
   - `user_id` (UUID, FK to auth.users)
   - `name` (TEXT)

2. **`speed_samples_2s`** - 2-second resolution (1 minute retention)
   - `id` (BIGSERIAL, PK)
   - `tracker_id` (UUID, FK to trackers)
   - `ts` (TIMESTAMPTZ)
   - `lat`, `lon` (DOUBLE PRECISION)
   - `speed_mps` (DOUBLE PRECISION)
   - `accuracy_m` (DOUBLE PRECISION, optional)
   - `geom` (GEOMETRY(POINT, 4326)) - Auto-populated

3. **`speed_samples_1m`** - 1-minute aggregation (1 hour retention)
   - `tracker_id` (UUID, FK to trackers)
   - `minute_ts` (TIMESTAMPTZ) - PK component
   - `avg_speed_mps` - Average of ALL 2s samples in minute
   - `stddev_speed_mps` - Standard deviation
   - `n_samples` - Count of 2s samples
   - `last_ts`, `last_speed_mps` - Latest sample in minute
   - `mean_mps`, `m2` - Welford's algorithm state
   - PRIMARY KEY: (tracker_id, minute_ts)

4. **`hourly_speed_stats`** - 1-hour aggregation (7 days retention)
   - `tracker_id` (UUID, FK to trackers)
   - `hour_ts` (TIMESTAMPTZ) - PK component
   - `avg_speed_mps` - Average of ALL 1m samples in hour
   - `stddev_speed_mps` - Standard deviation
   - `n_minutes` - Count of 1m samples
   - `mean_mps`, `m2` - Welford's algorithm state
   - PRIMARY KEY: (tracker_id, hour_ts)

## Aggregation Hierarchy (CRITICAL)

```
speed_samples_2s (source of truth)
    ↓ (aggregate ALL samples)
speed_samples_1m (avg from 2s)
    ↓ (aggregate ALL samples)
hourly_speed_stats (avg from 1m)
```

**Rules:**
- 2s → 1m: `speed_samples_1m.avg_speed_mps` = AVG of ALL `speed_samples_2s` in that minute
- 1m → 1h: `hourly_speed_stats.avg_speed_mps` = AVG of ALL `speed_samples_1m` in that hour
- **NO DIRECT 2s → 1h aggregation allowed**

## Key Functions

### Ingestion

```sql
-- Main ingestion function (UUID tracker_id)
ingest_gps_sample(
  tracker_id UUID,
  ts TIMESTAMPTZ,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION
)

-- Backward compatibility (TEXT tracker_id)
ingest_gps_sample_text(
  tracker_id TEXT,
  ts TIMESTAMPTZ,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION
)
```

### Aggregation

```sql
-- Update 1-minute aggregation from 2s samples
upsert_minute_speed_from_2s(tracker_id UUID, ts TIMESTAMPTZ, speed_mps DOUBLE PRECISION)

-- Update hourly aggregation from 1m samples
upsert_hourly_speed_from_1m(tracker_id UUID, minute_ts TIMESTAMPTZ)
```

### Cleanup

```sql
-- Individual cleanup functions
cleanup_speed_samples_2s()      -- Returns deleted count
cleanup_speed_samples_1m()      -- Returns deleted count
cleanup_hourly_speed_stats()    -- Returns deleted count

-- Combined cleanup
cleanup_all_speed_tables()      -- Returns table name and deleted count
scheduled_cleanup()             -- Returns JSONB with all results
```

### Query Functions

```sql
-- Current speed (latest minute)
get_current_speed(tracker_id UUID)

-- Last hour average (from 1m table)
get_last_hour_avg_speed(tracker_id UUID)

-- Last week hourly stats (from hourly table)
get_last_week_hourly_stats(tracker_id UUID)

-- Speed timeline (auto-selects table based on range)
get_speed_timeline(tracker_id UUID, start_ts TIMESTAMPTZ, end_ts TIMESTAMPTZ)

-- Recent 2s samples for alerts
get_recent_2s_samples(tracker_id UUID, minutes_back INTEGER)
```

## Data Retention

| Table | Retention | Cleanup Frequency |
|-------|-----------|-------------------|
| `speed_samples_2s` | 1 minute | Every 1 minute |
| `speed_samples_1m` | 1 hour | Every 5 minutes |
| `hourly_speed_stats` | 7 days | Every 1 hour |

## Migration Files

1. **004_trackers_and_speed_aggregation.sql** - Create tables and indexes
2. **005_speed_aggregation_functions.sql** - Aggregation and ingestion functions
3. **006_cleanup_and_retention.sql** - Cleanup functions
4. **007_speed_aggregation_rls.sql** - Row Level Security policies
5. **008_example_queries.sql** - Query helper functions
6. **009_migrate_existing_data.sql** - Migrate existing devices to trackers

## Setup Instructions

1. Run migrations in order (004 → 009)
2. Set up scheduled cleanup (see README_SPEED_AGGREGATION.md)
3. Update application code to use `ingest_gps_sample()` or `ingest_gps_sample_text()`

## Backward Compatibility

- `live_locations_compat` view provides compatibility
- `ingest_gps_sample_text()` accepts TEXT tracker_id
- Existing `devices` and `live_locations` tables remain unchanged

## Performance Considerations

- Indexes on (tracker_id, ts) for fast lookups
- GIST index on geom for spatial queries
- Aggregation functions recalculate from source (ensures accuracy)
- Cleanup runs frequently to minimize storage

## Security

- All tables have RLS enabled
- Users can only access their own trackers' data
- Policies enforce user_id matching through trackers table
