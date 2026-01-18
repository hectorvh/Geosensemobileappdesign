const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });


const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://thrmkorvklpvbbctsgti.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabaseKey) {
  console.warn('⚠️ Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY. Geofences will not be saved to Supabase.');
}

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'postgres',
  password: String(process.env.PGPASSWORD ?? ''), // <- fuerza string
  database: process.env.PGDATABASE || 'geosense',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
});

if (!process.env.PGPASSWORD) {
  console.warn('⚠️ Missing PGPASSWORD. Create server/.env with PGPASSWORD=your_db_password');
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: true });
  } catch (err) {
    console.error('DB health check failed:', err);
    res.status(500).json({ ok: false, db: false, error: err.message });
  }
});

app.post('/api/geofences', async (req, res) => {
  try {
    const { name, userId, boundary_inner, boundary_outer, buffer_m } = req.body;
    //if (!boundary_inner || !Array.isArray(boundary_inner) || boundary_inner.length < 3) {
    //  return res.status(400).json({ error: 'boundary_inner must be an array with at least 3 points' });
    //}
    // Accept GeoJSON Polygon OR old [[lat,lng],...] format
    let polygonGeoJSON = null;

    // NEW: GeoJSON Polygon
    if (boundary_inner && boundary_inner.type === 'Polygon' && Array.isArray(boundary_inner.coordinates)) {
      const ring = boundary_inner.coordinates?.[0];
      // GeoJSON ring must be closed -> at least 4 points
      if (!Array.isArray(ring) || ring.length < 4) {
        return res.status(400).json({ error: 'boundary_inner GeoJSON Polygon must have a closed ring (>= 4 points)' });
      }
      polygonGeoJSON = boundary_inner;
    }
    // OLD: [[lat,lng], ...]
    else if (Array.isArray(boundary_inner)) {
      if (boundary_inner.length < 3) {
        return res.status(400).json({ error: 'boundary_inner must have at least 3 points' });
      }
      const ring = boundary_inner.map(([lat, lng]) => [lng, lat]); // -> [lng,lat]
      const first = ring[0], last = ring[ring.length - 1];
      //if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
      polygonGeoJSON = { type: 'Polygon', coordinates: [ring] };
    } else {
      return res.status(400).json({ error: 'boundary_inner must be a GeoJSON Polygon or an array of points' });
    }

    //const text = `INSERT INTO geofences(name, user_id, boundary_inner, boundary_outer, buffer_m) VALUES($1, $2, $3, $4, $5) RETURNING id, name, user_id AS "userId", boundary_inner AS "boundaryInner", boundary_outer AS "boundaryOuter", buffer_m AS "bufferM", created_at AS "createdAt"`;
    //const values = [
    //  name || 'Geofence',
    //  userId || null,
    //  JSON.stringify(boundary_inner),
    //  boundary_outer ? JSON.stringify(boundary_outer) : null,
    //  buffer_m || 0,
    //];

    const geojsonText = JSON.stringify(polygonGeoJSON);

    const text = `
      INSERT INTO geofences (name, user_id, inner_geom, outer_geom, buffer_m)
      VALUES (
        $1,
        $2,
        ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
        CASE
          WHEN $4::int > 0
          THEN ST_Buffer(
                ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography,
                $4
              )::geometry
          ELSE ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)
        END,
        $4
      )
      RETURNING
        id,
        name,
        user_id AS "userId",
        ST_AsGeoJSON(inner_geom)::json AS "boundaryInner",
        ST_AsGeoJSON(outer_geom)::json AS "boundaryOuter",
        buffer_m AS "bufferM",
        created_at AS "createdAt"
    `;

    const values = [name || "Geofence", userId, geojsonText, buffer_m || 0];

    const result = await pool.query(text, values);
    const savedGeofence = result.rows[0];

    // Also save to Supabase
    if (supabase) {
      try {
        const { data: supabaseData, error: supabaseError } = await supabase
          .from('geofences')
          .insert({
            name: savedGeofence.name,
            user_id: savedGeofence.userId,
            boundary_inner: savedGeofence.boundaryInner,
            boundary_outer: savedGeofence.boundaryOuter,
            buffer_m: savedGeofence.bufferM,
          })
          .select()
          .single();

        if (supabaseError) {
          console.error('Error saving to Supabase:', supabaseError);
          // Continue anyway - we still saved to Postgres
        } else {
          console.log('Geofence saved to Supabase:', supabaseData.id);
        }
      } catch (supabaseErr) {
        console.error('Supabase save error:', supabaseErr);
        // Continue anyway - we still saved to Postgres
      }
    }

    res.json(savedGeofence);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/geofences', async (req, res) => {
  try {
    //const result = await pool.query('SELECT id, name, user_id AS "userId", boundary_inner AS "boundaryInner", boundary_outer AS "boundaryOuter", buffer_m AS "bufferM", created_at AS "createdAt" FROM geofences ORDER BY created_at DESC');
    //res.json(result.rows);
    const result = await pool.query(`
      SELECT
        id,
        name,
        user_id AS "userId",
        ST_AsGeoJSON(inner_geom)::json AS "boundaryInner",
        ST_AsGeoJSON(ST_Buffer(inner_geom::geography, buffer_m)::geometry)::json AS "boundaryOuter",
        buffer_m AS "bufferM",
        created_at AS "createdAt"
      FROM geofences
      ORDER BY created_at DESC
    `);
    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Geosense server listening on port ${port}`);
});
