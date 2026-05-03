
const app  = require('./app');
const pool = require('./config/db');
const PORT = process.env.PORT || 4000;

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Teams feature
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        manager_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teams_manager  ON teams(manager_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teams_project  ON teams(project_id)`);

    // Notifications table (if not yet created)
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message    TEXT NOT NULL,
        link       VARCHAR(300),
        is_read    BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id)`);

    // Settings table (if not yet created)
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key   VARCHAR(100) PRIMARY KEY,
        value TEXT
      )
    `);

    console.log('✓ Migrations applied');
  } finally {
    client.release();
  }
}

pool.query('SELECT 1')
  .then(async () => {
    console.log('✓ Connected to PostgreSQL');
    await runMigrations();
    app.listen(PORT, () => console.log('✓ Server on port ' + PORT));
  })
  .catch(err => { console.error('✗ DB connection failed:', err.message); process.exit(1); });
