# Complete Database Schema - All Tables

## Summary

**Total Tables: 10**
- 6 Core application tables
- 3 Speed aggregation tables (new)
- 1 Tracker parent table (new)

**Views: 2**
- `positions` (backward compatibility)
- `live_locations_compat` (backward compatibility)

---

## Core Application Tables

### 1. `public.profiles`
**Purpose**: User profiles linked to Supabase Auth
- `id` (UUID, PK, FK → auth.users)
- `created_at` (TIMESTAMPTZ)
- `full_name` (TEXT, optional)
- `updated_at` (TIMESTAMPTZ)
- `tutorial_seen` (BOOLEAN, default: false)

### 2. `public.devices`
**Purpose**: GPS tracking devices/animal collars
- `id` (UUID, PK)
- `tracker_id` (TEXT, UNIQUE) - Legacy identifier
- `user_id` (UUID, FK → auth.users)
- `name`, `animal_name` (TEXT, optional)
- `animal_outside` (BOOLEAN, default: false)
- `active` (BOOLEAN, default: false)
- `speed` (NUMERIC, default: 0) - Legacy field
- `active_time`, `inactive_time` (INTEGER, seconds)
- `total_distance` (NUMERIC, km)
- `battery_level` (INTEGER, optional)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 3. `public.live_locations`
**Purpose**: Latest GPS location per tracker (legacy, one row per tracker)
- `tracker_id` (TEXT, PK)
- `user_id` (UUID, FK → auth.users)
- `lat`, `lng` (DOUBLE PRECISION)
- `geom` (GEOMETRY(POINT, 4326))
- `accuracy_m`, `speed_mps`, `heading_deg`, `altitude_m` (DOUBLE PRECISION, optional)
- `captured_at`, `updated_at` (TIMESTAMPTZ)
- `is_high_accuracy` (BOOLEAN)

**Note**: This table is kept for backward compatibility. New ingestion should use speed aggregation tables.

### 4. `public.geofences`
**Purpose**: User-defined safe zones/polygons
- `id` (BIGSERIAL, PK)
- `name` (TEXT)
- `user_id` (UUID, FK → auth.users)
- `boundary_inner` (JSONB, GeoJSON Polygon)
- `boundary_outer` (JSONB, GeoJSON Polygon, optional)
- `buffer_m` (INTEGER, default: 0)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 5. `public.alerts`
**Purpose**: Alert notifications for devices
- `id` (UUID, PK)
- `device_id` (UUID, FK → devices)
- `type_alert` (TEXT, CHECK: 'Inactivity Detected' | 'Out of Range' | 'Low Battery')
- `active` (BOOLEAN, default: true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 6. `public.settings`
**Purpose**: User alert preferences
- `id` (UUID, PK)
- `user_id` (UUID, FK → auth.users, UNIQUE)
- `inactivity_minutes` (INTEGER, default: 15)
- `low_battery_threshold` (INTEGER, default: 15)
- `enable_out_of_range` (BOOLEAN, default: true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

---

## Speed Aggregation Tables (New)

### 7. `public.trackers`
**Purpose**: Parent table for all GPS tracking data
- `id` (UUID, PK)
- `tracker_id` (TEXT, UNIQUE) - Legacy compatibility
- `user_id` (UUID, FK → auth.users)
- `name` (TEXT, optional)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Relationship**: All speed aggregation tables reference this table.

### 8. `public.speed_samples_2s`
**Purpose**: High-resolution GPS samples (2-second resolution, 1 minute retention)
- `id` (BIGSERIAL, PK)
- `tracker_id` (UUID, FK → trackers)
- `ts` (TIMESTAMPTZ)
- `lat`, `lon` (DOUBLE PRECISION)
- `speed_mps` (DOUBLE PRECISION)
- `accuracy_m` (DOUBLE PRECISION, optional)
- `geom` (GEOMETRY(POINT, 4326)) - Auto-populated
- `created_at` (TIMESTAMPTZ)

**Retention**: 1 minute (automatic cleanup)
**Use Case**: Real-time alerts, geofence checks

### 9. `public.speed_samples_1m`
**Purpose**: 1-minute aggregations (1 hour retention)
- `tracker_id` (UUID, FK → trackers)
- `minute_ts` (TIMESTAMPTZ) - PK component
- `avg_speed_mps` (DOUBLE PRECISION) - **Aggregated from ALL 2s samples**
- `stddev_speed_mps` (DOUBLE PRECISION)
- `n_samples` (INTEGER) - Count of 2s samples
- `last_ts`, `last_speed_mps` (TIMESTAMPTZ, DOUBLE PRECISION)
- `mean_mps`, `m2` (DOUBLE PRECISION) - Welford's algorithm state
- `created_at`, `updated_at` (TIMESTAMPTZ)
- **PRIMARY KEY**: (tracker_id, minute_ts)

**Retention**: 1 hour (automatic cleanup)
**Aggregation Source**: `speed_samples_2s` (ALL samples in minute)

### 10. `public.hourly_speed_stats`
**Purpose**: Hourly aggregations (7 days retention)
- `tracker_id` (UUID, FK → trackers)
- `hour_ts` (TIMESTAMPTZ) - PK component
- `avg_speed_mps` (DOUBLE PRECISION) - **Aggregated from ALL 1m samples**
- `stddev_speed_mps` (DOUBLE PRECISION)
- `n_minutes` (INTEGER) - Count of 1m samples
- `mean_mps`, `m2` (DOUBLE PRECISION) - Welford's algorithm state
- `created_at`, `updated_at` (TIMESTAMPTZ)
- **PRIMARY KEY**: (tracker_id, hour_ts)

**Retention**: 7 days (automatic cleanup)
**Aggregation Source**: `speed_samples_1m` (ALL samples in hour)

---

## Views

### `public.positions`
**Purpose**: Backward compatibility view
- Maps `live_locations` to old positions format
- Joins `live_locations` with `devices`

### `public.live_locations_compat`
**Purpose**: Backward compatibility view
- Maps new `speed_samples_2s` to old `live_locations` format
- Shows only last minute of data

---

## Aggregation Hierarchy

```
speed_samples_2s (source of truth, 1 min retention)
    ↓
    Aggregate ALL 2s samples → avg_speed_mps
    ↓
speed_samples_1m (1 hour retention)
    ↓
    Aggregate ALL 1m samples → avg_speed_mps
    ↓
hourly_speed_stats (7 days retention)
```

**Critical Rules:**
1. `speed_samples_1m.avg_speed_mps` = AVG of ALL `speed_samples_2s` in that minute
2. `hourly_speed_stats.avg_speed_mps` = AVG of ALL `speed_samples_1m` in that hour
3. **NO direct aggregation from 2s → hourly**

---

## Key Functions

### Ingestion
- `ingest_gps_sample()` - Main ingestion (UUID tracker_id)
- `ingest_gps_sample_text()` - Backward compat (TEXT tracker_id)

### Aggregation
- `upsert_minute_speed_from_2s()` - 2s → 1m aggregation
- `upsert_hourly_speed_from_1m()` - 1m → 1h aggregation

### Cleanup
- `cleanup_speed_samples_2s()` - Delete old 2s samples
- `cleanup_speed_samples_1m()` - Delete old 1m samples
- `cleanup_hourly_speed_stats()` - Delete old hourly stats
- `cleanup_all_speed_tables()` - Run all cleanups
- `scheduled_cleanup()` - Scheduled cleanup wrapper

### Queries
- `get_current_speed()` - Latest speed from 1m table
- `get_last_hour_avg_speed()` - Hour average from 1m table
- `get_last_week_hourly_stats()` - Weekly stats from hourly table
- `get_speed_timeline()` - Timeline data (auto-selects table)
- `get_recent_2s_samples()` - Recent samples for alerts

---

## Migration Files

1. `001_initial_schema.sql` - Core tables
2. `002_rls_policies.sql` - RLS for core tables
3. `003_add_tutorial_seen.sql` - Add tutorial_seen to profiles
4. `004_trackers_and_speed_aggregation.sql` - Speed aggregation tables
5. `005_speed_aggregation_functions.sql` - Aggregation functions
6. `006_cleanup_and_retention.sql` - Cleanup functions
7. `007_speed_aggregation_rls.sql` - RLS for speed tables
8. `008_example_queries.sql` - Query helper functions
9. `009_migrate_existing_data.sql` - Migrate existing data

---

## Storage Optimization

| Table | Retention | Estimated Size (per tracker) |
|-------|-----------|------------------------------|
| `speed_samples_2s` | 1 minute | ~30 rows × ~200 bytes = 6 KB |
| `speed_samples_1m` | 1 hour | ~60 rows × ~150 bytes = 9 KB |
| `hourly_speed_stats` | 7 days | ~168 rows × ~150 bytes = 25 KB |

**Total per tracker**: ~40 KB (vs. unlimited growth with raw data)

---

## Next Steps

1. Run migrations 004-009 in order
2. Set up scheduled cleanup (pg_cron or Edge Function)
3. Update application to use `ingest_gps_sample_text()` or `ingest_gps_sample()`
4. Update queries to use new query functions
5. Monitor storage and cleanup effectiveness
