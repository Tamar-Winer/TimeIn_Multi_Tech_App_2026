
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});
pool.on('error', (err) => console.error('DB error', err));
module.exports = pool;
