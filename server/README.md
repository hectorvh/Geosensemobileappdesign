# Geosense Server

Quick server for storing geofences in Postgres.

Environment variables (or defaults):

- `PGHOST` (default `localhost`)
- `PGUSER` (default `postgres`)
- `PGPASSWORD` (default ``)
- `PGDATABASE` (default `geosense`)
- `PGPORT` (default `5432`)
- `PORT` (server port, default `4000`)

Setup:

1. Install dependencies

```bash
cd server
npm install
```

2. Create database and run init SQL (example using psql):

```bash
createdb -h localhost -U postgres geosense
psql -h localhost -U postgres -d geosense -f server/init.sql
```

3. Start server

```bash
npm run start
```

The server exposes:

- `POST /api/geofences` — body `{ name, userId, coordinates }` -> saved geofence
- `GET /api/geofences` — list geofences
