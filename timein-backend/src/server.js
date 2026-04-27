
const app  = require('./app');
const pool = require('./config/db');
const PORT = process.env.PORT || 4000;
pool.query('SELECT 1')
  .then(() => { console.log('✓ Connected to PostgreSQL'); app.listen(PORT, () => console.log('✓ Server on port ' + PORT)); })
  .catch(err => { console.error('✗ DB connection failed:', err.message); process.exit(1); });
