
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
pool.on('error', (err) => console.error('DB error', err));
module.exports = pool;
