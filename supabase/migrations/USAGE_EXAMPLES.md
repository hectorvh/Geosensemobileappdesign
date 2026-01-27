# Speed Aggregation System - Usage Examples

## Frontend Integration (JavaScript/TypeScript)

### Ingesting GPS Data

```typescript
import { supabase } from './lib/supabase';

// Using TEXT tracker_id (backward compatible)
async function sendGPSLocation(
  trackerId: string,
  lat: number,
  lon: number,
  speedMps: number,
  accuracyM?: number
) {
  const { error } = await supabase.rpc('ingest_gps_sample_text', {
    p_tracker_id: trackerId,
    p_ts: new Date().toISOString(),
    p_lat: lat,
    p_lon: lon,
    p_speed_mps: speedMps,
    p_accuracy_m: accuracyM || null,
  });
  
  if (error) {
    console.error('Failed to ingest GPS sample:', error);
  }
}

// Using UUID tracker_id (recommended)
async function sendGPSLocationUUID(
  trackerUUID: string,
  lat: number,
  lon: number,
  speedMps: number,
  accuracyM?: number
) {
  const { error } = await supabase.rpc('ingest_gps_sample', {
    p_tracker_id: trackerUUID,
    p_ts: new Date().toISOString(),
    p_lat: lat,
    p_lon: lon,
    p_speed_mps: speedMps,
    p_accuracy_m: accuracyM || null,
  });
  
  if (error) {
    console.error('Failed to ingest GPS sample:', error);
  }
}
```

### Querying Speed Data

```typescript
// Get current speed
async function getCurrentSpeed(trackerUUID: string) {
  const { data, error } = await supabase.rpc('get_current_speed', {
    p_tracker_id: trackerUUID,
  });
  
  if (error) throw error;
  return data?.[0];
}

// Get last hour average
async function getLastHourAvg(trackerUUID: string) {
  const { data, error } = await supabase.rpc('get_last_hour_avg_speed', {
    p_tracker_id: trackerUUID,
  });
  
  if (error) throw error;
  return data?.[0];
}

// Get speed timeline for charts
async function getSpeedTimeline(
  trackerUUID: string,
  startTime: Date,
  endTime: Date
) {
  const { data, error } = await supabase.rpc('get_speed_timeline', {
    p_tracker_id: trackerUUID,
    p_start_ts: startTime.toISOString(),
    p_end_ts: endTime.toISOString(),
  });
  
  if (error) throw error;
  return data;
}
```

## Backend Integration (Node.js/Express)

### Example: GPS Ingestion Endpoint

```javascript
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.post('/api/gps/ingest', async (req, res) => {
  const { tracker_id, lat, lon, speed_mps, accuracy_m } = req.body;
  
  try {
    // Throttle to ~2 seconds at backend level
    const { error } = await supabase.rpc('ingest_gps_sample_text', {
      p_tracker_id: tracker_id,
      p_ts: new Date().toISOString(),
      p_lat: lat,
      p_lon: lon,
      p_speed_mps: speed_mps,
      p_accuracy_m: accuracy_m || null,
    });
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

## Direct SQL Examples

### Manual Ingestion

```sql
-- Ingest a GPS sample
SELECT ingest_gps_sample_text(
  'GPS001',
  now(),
  51.969205,
  7.595761,
  2.5,
  10.0
);
```

### Query Examples

```sql
-- Current speed
SELECT * FROM get_current_speed('tracker-uuid-here'::UUID);

-- Last hour average
SELECT * FROM get_last_hour_avg_speed('tracker-uuid-here'::UUID);

-- Last week hourly stats
SELECT * FROM get_last_week_hourly_stats('tracker-uuid-here'::UUID);

-- Speed timeline (last 24 hours)
SELECT * FROM get_speed_timeline(
  'tracker-uuid-here'::UUID,
  now() - interval '24 hours',
  now()
);

-- Recent samples for alerts (last minute)
SELECT * FROM get_recent_2s_samples('tracker-uuid-here'::UUID, 1);
```

### Manual Cleanup

```sql
-- Run all cleanups
SELECT * FROM cleanup_all_speed_tables();

-- Individual cleanups
SELECT cleanup_speed_samples_2s();
SELECT cleanup_speed_samples_1m();
SELECT cleanup_hourly_speed_stats();
```

## Scheduled Cleanup Setup

### Option 1: Supabase pg_cron (if enabled)

Run in Supabase SQL Editor:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup jobs
SELECT cron.schedule(
  'cleanup-speed-samples-2s',
  '*/1 * * * *',  -- Every minute
  'SELECT cleanup_speed_samples_2s()'
);

SELECT cron.schedule(
  'cleanup-speed-samples-1m',
  '*/5 * * * *',  -- Every 5 minutes
  'SELECT cleanup_speed_samples_1m()'
);

SELECT cron.schedule(
  'cleanup-hourly-speed-stats',
  '0 * * * *',    -- Every hour
  'SELECT cleanup_hourly_speed_stats()'
);
```

### Option 2: Supabase Edge Function

Create `supabase/functions/cleanup-speed-data/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabase.rpc('scheduled_cleanup');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

Then schedule via external cron service or GitHub Actions.

## Migration Checklist

- [ ] Run migration 004 (create tables)
- [ ] Run migration 005 (create functions)
- [ ] Run migration 006 (create cleanup functions)
- [ ] Run migration 007 (add RLS policies)
- [ ] Run migration 008 (add query functions)
- [ ] Run migration 009 (migrate existing data)
- [ ] Set up scheduled cleanup (pg_cron or Edge Function)
- [ ] Update application code to use new ingestion functions
- [ ] Test ingestion and query functions
- [ ] Monitor storage usage and cleanup effectiveness
