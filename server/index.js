const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });


const app = express();
app.use(cors());
app.use(express.json());

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
    if (!boundary_inner || !Array.isArray(boundary_inner) || boundary_inner.length < 3) {
      return res.status(400).json({ error: 'boundary_inner must be an array with at least 3 points' });
    }

    const text = `INSERT INTO geofences(name, user_id, boundary_inner, boundary_outer, buffer_m) VALUES($1, $2, $3, $4, $5) RETURNING id, name, user_id AS "userId", boundary_inner AS "boundaryInner", boundary_outer AS "boundaryOuter", buffer_m AS "bufferM", created_at AS "createdAt"`;
    const values = [
      name || 'Geofence',
      userId || null,
      JSON.stringify(boundary_inner),
      boundary_outer ? JSON.stringify(boundary_outer) : null,
      buffer_m || 0,
    ];
    const result = await pool.query(text, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/geofences', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, user_id AS "userId", boundary_inner AS "boundaryInner", boundary_outer AS "boundaryOuter", buffer_m AS "bufferM", created_at AS "createdAt" FROM geofences ORDER BY created_at DESC');
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
