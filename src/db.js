'use strict';
/**
 * src/db.js
 * Simple pg Pool wrapper expected by route files.
 *
 * Set DATABASE_URL in .env (e.g. postgres://user:pass@host:5432/dbname)
 * Or set PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT individually.
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || undefined,
  user: process.env.PGUSER || undefined,
  password: process.env.PGPASSWORD || undefined,
  database: process.env.PGDATABASE || undefined,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  // optional SSL for production
  ssl: (process.env.PGSSL === 'true') ? { rejectUnauthorized: false } : false,
  // you can tune max/min etc if needed
});

pool.on('error', (err) => {
  console.error('Unexpected idle client error', err);
});

module.exports = { pool };