
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_projects (
        team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        PRIMARY KEY (team_id, project_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_projects_team    ON team_projects(team_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_projects_project ON team_projects(project_id)`);
    // Migrate existing single project_id from teams into team_projects
    await client.query(`
      INSERT INTO team_projects (team_id, project_id)
      SELECT id, project_id FROM teams WHERE project_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
  } finally {
    client.release();
  }
}

// Run once per cold-start — safe because all statements use IF NOT EXISTS
runMigrations().catch(err => console.error('Migration error:', err.message));

module.exports = app;
