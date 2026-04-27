
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'employee'
                CHECK (role IN ('employee','manager','admin')),
  team          VARCHAR(100),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id                  SERIAL PRIMARY KEY,
  project_name        VARCHAR(150) NOT NULL,
  description         TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','archived','completed')),
  manager_id          INTEGER REFERENCES users(id),
  clickup_space_id    VARCHAR(100),
  git_repository_name VARCHAR(150),
  git_repository_url  VARCHAR(300),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id               SERIAL PRIMARY KEY,
  task_name        VARCHAR(200) NOT NULL,
  description      TEXT,
  project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_user_id INTEGER REFERENCES users(id),
  status           VARCHAR(30) NOT NULL DEFAULT 'todo'
                   CHECK (status IN ('todo','in_progress','review','done','cancelled')),
  priority         VARCHAR(20) NOT NULL DEFAULT 'medium'
                   CHECK (priority IN ('low','medium','high','urgent')),
  clickup_task_id  VARCHAR(100),
  estimated_hours  DECIMAL(6,2),
  due_date         DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_entries (
  id                      SERIAL PRIMARY KEY,
  user_id                 INTEGER NOT NULL REFERENCES users(id),
  project_id              INTEGER NOT NULL REFERENCES projects(id),
  task_id                 INTEGER REFERENCES tasks(id),
  date                    DATE NOT NULL,
  start_time              TIME,
  end_time                TIME,
  duration_minutes        INTEGER NOT NULL CHECK (duration_minutes > 0),
  work_type               VARCHAR(30) DEFAULT 'development'
                          CHECK (work_type IN ('development','design','review','devops','meeting','qa','other')),
  description             TEXT,
  source                  VARCHAR(20) NOT NULL DEFAULT 'manual'
                          CHECK (source IN ('manual','timer','git','clickup','suggested')),
  status                  VARCHAR(20) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','submitted','approved','rejected')),
  related_commit_ids      TEXT[],
  related_clickup_task_id VARCHAR(100),
  approved_by             INTEGER REFERENCES users(id),
  approved_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION check_time_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM time_entries
      WHERE user_id = NEW.user_id AND date = NEW.date
        AND id != COALESCE(NEW.id, -1)
        AND start_time IS NOT NULL AND end_time IS NOT NULL
        AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
    ) THEN
      RAISE EXCEPTION 'Time overlap detected';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS time_entry_overlap_check ON time_entries;
CREATE TRIGGER time_entry_overlap_check
BEFORE INSERT OR UPDATE ON time_entries
FOR EACH ROW EXECUTE FUNCTION check_time_overlap();

CREATE TABLE IF NOT EXISTS git_commits (
  id                   SERIAL PRIMARY KEY,
  repository           VARCHAR(200) NOT NULL,
  branch               VARCHAR(150),
  commit_hash          VARCHAR(40) NOT NULL,
  commit_message       TEXT,
  commit_author_email  VARCHAR(150),
  commit_date          TIMESTAMPTZ,
  linked_user_id       INTEGER REFERENCES users(id),
  linked_task_id       INTEGER REFERENCES tasks(id),
  linked_time_entry_id INTEGER REFERENCES time_entries(id),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clickup_task_links (
  id               SERIAL PRIMARY KEY,
  clickup_task_id  VARCHAR(100) NOT NULL UNIQUE,
  task_name        VARCHAR(200),
  project_id       INTEGER REFERENCES projects(id),
  assigned_user_id INTEGER REFERENCES users(id),
  status           VARCHAR(50),
  estimated_time   INTEGER,
  due_date         DATE,
  last_sync_date   TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_te_user    ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_te_project ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_te_date    ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_te_status  ON time_entries(status);
