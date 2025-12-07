// src/db/index.js
// Postgres Pool wrapper
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/fp';

const pool = new Pool({
  connectionString,
  // For production with required SSL, uncomment and configure:
  // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Optional simple health check helper
async function check() {
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT 1');
    return r && r.rows ? true : false;
  } finally {
    client.release();
  }
}

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

module.exports = { pool, check };