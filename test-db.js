require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const r = await client.query('SELECT now() as now');
    console.log('Connected — DB time:', r.rows[0].now);
  } catch (err) {
    console.error('Connect error:', err.message);
    console.error(err);
  } finally {
    await client.end();
  }
})();