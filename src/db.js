const { Pool } = require('pg');
require('dotenv').config();

// Pool sẽ đọc PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT từ .env
const pool = new Pool();

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};