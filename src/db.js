'use strict';
/**
 * src/db.js
 * Simple pg Pool wrapper.
 * Reads DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT from .env
 */
require('dotenv').config();
const { Pool } = require('pg');

// Pool sẽ tự động đọc env vars
const pool = new Pool();

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};