
const app  = require('../src/app');
const pool = require('../src/config/db');

async function runMigrations() {
  const client = await pool.connect();
  try {
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key   VARCHAR(100) PRIMARY KEY,
        value TEXT
      )
    `);
  } finally {
    client.release();
  }
}

// Run once per cold-start — safe because all statements use IF NOT EXISTS
runMigrations().catch(err => console.error('Migration error:', err.message));

module.exports = app;
