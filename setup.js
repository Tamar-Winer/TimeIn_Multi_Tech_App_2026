const fs   = require('fs');
const path = require('path');

const mkd = (p) => fs.mkdirSync(p, { recursive: true });
const w   = (p, c) => { mkd(path.dirname(p)); fs.writeFileSync(p, c, 'utf8'); };

// ─── BACKEND ────────────────────────────────────────────────

w('timein-backend/package.json', JSON.stringify({
  name: "timein-backend", version: "1.0.0", main: "src/server.js",
  scripts: { start: "node src/server.js", dev: "nodemon src/server.js" },
  dependencies: {
    express:"^4.18.2", pg:"^8.11.3", bcryptjs:"^2.4.3",
    jsonwebtoken:"^9.0.2", cors:"^2.8.5", dotenv:"^16.3.1",
    "express-validator":"^7.0.1", morgan:"^1.10.0"
  },
  devDependencies: { nodemon:"^3.0.2" }
}, null, 2));

w('timein-backend/.env', `PORT=4000
DATABASE_URL=postgresql://postgres:Winer4852@localhost:5432/timein
JWT_SECRET=timein_super_secret_jwt_key_2025
JWT_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:3000`);

w('timein-backend/src/db/schema.sql', `
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
`);

w('timein-backend/src/config/db.js', `
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
pool.on('error', (err) => console.error('DB error', err));
module.exports = pool;
`);

w('timein-backend/src/middleware/auth.js', `
const jwt  = require('jsonwebtoken');
const pool = require('../config/db');
const authenticate = async (req, res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const d = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id,full_name,email,role,team FROM users WHERE id=$1 AND is_active=TRUE', [d.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0]; next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
};
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};
module.exports = { authenticate, requireRole };
`);

w('timein-backend/src/middleware/errorHandler.js', `
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
};
module.exports = errorHandler;
`);

w('timein-backend/src/routes/auth.js', `
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.post('/register', async (req, res, next) => {
  const { fullName, email, password, role = 'employee', team } = req.body;
  if (!fullName || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (full_name,email,password_hash,role,team) VALUES ($1,$2,$3,$4,$5) RETURNING id,full_name,email,role,team',
      [fullName, email, hash, role, team]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1 AND is_active=TRUE', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: rows[0].id, role: rows[0].role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    const { password_hash, ...user } = rows[0];
    res.json({ token, user });
  } catch (err) { next(err); }
});

router.get('/me', authenticate, (req, res) => res.json(req.user));
module.exports = router;
`);

w('timein-backend/src/routes/projects.js', `
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT p.*,u.full_name AS manager_name FROM projects p LEFT JOIN users u ON u.id=p.manager_id ORDER BY p.project_name'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
  const { projectName, description, managerId, gitRepositoryName, gitRepositoryUrl, clickupSpaceId } = req.body;
  if (!projectName) return res.status(400).json({ error: 'projectName required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO projects (project_name,description,manager_id,git_repository_name,git_repository_url,clickup_space_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [projectName, description, managerId, gitRepositoryName, gitRepositoryUrl, clickupSpaceId]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('admin','manager'), async (req, res, next) => {
  const { projectName, description, status, managerId } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE projects SET project_name=COALESCE($1,project_name),description=COALESCE($2,description),status=COALESCE($3,status),manager_id=COALESCE($4,manager_id),updated_at=NOW() WHERE id=$5 RETURNING *',
      [projectName, description, status, managerId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
`);

w('timein-backend/src/routes/tasks.js', `
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  const { projectId, assignedUserId, status } = req.query;
  const conds = ['1=1'], params = [];
  if (projectId)      { params.push(projectId);      conds.push('t.project_id=$' + params.length); }
  if (assignedUserId) { params.push(assignedUserId);  conds.push('t.assigned_user_id=$' + params.length); }
  if (status)         { params.push(status);          conds.push('t.status=$' + params.length); }
  try {
    const { rows } = await pool.query(
      'SELECT t.*,p.project_name,u.full_name AS assigned_user_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN users u ON u.id=t.assigned_user_id WHERE ' + conds.join(' AND ') + ' ORDER BY t.created_at DESC',
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('admin','manager'), async (req, res, next) => {
  const { taskName, description, projectId, assignedUserId, priority, clickupTaskId, estimatedHours, dueDate } = req.body;
  if (!taskName || !projectId) return res.status(400).json({ error: 'taskName and projectId required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO tasks (task_name,description,project_id,assigned_user_id,priority,clickup_task_id,estimated_hours,due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [taskName, description, projectId, assignedUserId, priority||'medium', clickupTaskId, estimatedHours, dueDate]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('admin','manager'), async (req, res, next) => {
  const { taskName, status, assignedUserId, priority, estimatedHours } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE tasks SET task_name=COALESCE($1,task_name),status=COALESCE($2,status),assigned_user_id=COALESCE($3,assigned_user_id),priority=COALESCE($4,priority),estimated_hours=COALESCE($5,estimated_hours),updated_at=NOW() WHERE id=$6 RETURNING *',
      [taskName, status, assignedUserId, priority, estimatedHours, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
`);

w('timein-backend/src/routes/timeEntries.js', `
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  const { userId, projectId, taskId, status, dateFrom, dateTo } = req.query;
  const conds = [], params = [];
  if (req.user.role === 'employee') { params.push(req.user.id); conds.push('te.user_id=$' + params.length); }
  else if (userId) { params.push(userId); conds.push('te.user_id=$' + params.length); }
  if (projectId) { params.push(projectId); conds.push('te.project_id=$' + params.length); }
  if (taskId)    { params.push(taskId);    conds.push('te.task_id=$' + params.length); }
  if (status)    { params.push(status);    conds.push('te.status=$' + params.length); }
  if (dateFrom)  { params.push(dateFrom);  conds.push('te.date>=$' + params.length); }
  if (dateTo)    { params.push(dateTo);    conds.push('te.date<=$' + params.length); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  try {
    const { rows } = await pool.query(
      'SELECT te.*,u.full_name AS user_name,p.project_name,t.task_name FROM time_entries te LEFT JOIN users u ON u.id=te.user_id LEFT JOIN projects p ON p.id=te.project_id LEFT JOIN tasks t ON t.id=te.task_id ' + where + ' ORDER BY te.date DESC,te.created_at DESC',
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  const { projectId, taskId, date, startTime, endTime, durationMinutes, workType, description, source, relatedCommitIds, relatedClickupTaskId } = req.body;
  if (!projectId || !date) return res.status(400).json({ error: 'projectId and date required' });
  let dur = durationMinutes;
  if (!dur && startTime && endTime) {
    const [sh,sm] = startTime.split(':').map(Number);
    const [eh,em] = endTime.split(':').map(Number);
    dur = (eh*60+em) - (sh*60+sm);
  }
  if (!dur || dur <= 0) return res.status(400).json({ error: 'Duration must be positive' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO time_entries (user_id,project_id,task_id,date,start_time,end_time,duration_minutes,work_type,description,source,related_commit_ids,related_clickup_task_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
      [req.user.id, projectId, taskId||null, date, startTime||null, endTime||null, dur, workType||'development', description, source||'manual', relatedCommitIds||[], relatedClickupTaskId||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.message.includes('overlap')) return res.status(409).json({ error: 'Time overlap detected' });
    next(err);
  }
});

router.patch('/:id/submit', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE time_entries SET status='submitted',updated_at=NOW() WHERE id=$1 AND user_id=$2 AND status='draft' RETURNING *",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id/approve', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE time_entries SET status='approved',approved_by=$1,approved_at=NOW(),updated_at=NOW() WHERE id=$2 AND status='submitted' RETURNING *",
      [req.user.id, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not submitted' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id/reject', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE time_entries SET status='rejected',rejection_reason=$1,updated_at=NOW() WHERE id=$2 AND status='submitted' RETURNING *",
      [req.body.reason||null, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not submitted' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, async (req, res, next) => {
  const { projectId, taskId, date, startTime, endTime, durationMinutes, workType, description, relatedCommitIds } = req.body;
  let dur = durationMinutes;
  if (!dur && startTime && endTime) {
    const [sh,sm] = startTime.split(':').map(Number);
    const [eh,em] = endTime.split(':').map(Number);
    dur = (eh*60+em) - (sh*60+sm);
  }
  try {
    const { rows } = await pool.query(
      'UPDATE time_entries SET project_id=COALESCE($1,project_id),task_id=COALESCE($2,task_id),date=COALESCE($3,date),start_time=COALESCE($4,start_time),end_time=COALESCE($5,end_time),duration_minutes=COALESCE($6,duration_minutes),work_type=COALESCE($7,work_type),description=COALESCE($8,description),related_commit_ids=COALESCE($9,related_commit_ids),updated_at=NOW() WHERE id=$10 RETURNING *',
      [projectId, taskId, date, startTime, endTime, dur, workType, description, relatedCommitIds, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "DELETE FROM time_entries WHERE id=$1 AND user_id=$2 AND status='draft' RETURNING id",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not deletable' });
    res.json({ deleted: rows[0].id });
  } catch (err) { next(err); }
});

module.exports = router;
`);

w('timein-backend/src/routes/reports.js', `
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT SUM(CASE WHEN date=CURRENT_DATE THEN duration_minutes ELSE 0 END) AS today_minutes, SUM(CASE WHEN date>=date_trunc('week',NOW()) THEN duration_minutes ELSE 0 END) AS week_minutes, SUM(CASE WHEN date>=date_trunc('month',NOW()) THEN duration_minutes ELSE 0 END) AS month_minutes, COUNT(CASE WHEN status='draft' THEN 1 END) AS draft_count FROM time_entries WHERE user_id=$1",
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/by-user', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT u.id,u.full_name,u.team,COUNT(te.id)::int AS entry_count,COALESCE(SUM(te.duration_minutes),0)::int AS total_minutes,ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,COUNT(DISTINCT te.project_id)::int AS project_count FROM users u LEFT JOIN time_entries te ON te.user_id=u.id WHERE u.is_active=TRUE GROUP BY u.id,u.full_name,u.team ORDER BY total_minutes DESC"
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/by-project', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT p.id,p.project_name,COUNT(te.id)::int AS entry_count,COALESCE(SUM(te.duration_minutes),0)::int AS total_minutes,ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,COUNT(DISTINCT te.user_id)::int AS user_count FROM projects p LEFT JOIN time_entries te ON te.project_id=p.id GROUP BY p.id,p.project_name ORDER BY total_minutes DESC"
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/by-task', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT t.id,t.task_name,t.estimated_hours,p.project_name,COUNT(te.id)::int AS entry_count,ROUND(COALESCE(SUM(te.duration_minutes),0)/60.0,2) AS total_hours,MAX(te.date) AS last_activity FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN time_entries te ON te.task_id=t.id GROUP BY t.id,t.task_name,t.estimated_hours,p.project_name ORDER BY total_hours DESC NULLS LAST"
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/anomalies', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const [long, missing] = await Promise.all([
      pool.query("SELECT te.*,u.full_name,p.project_name FROM time_entries te JOIN users u ON u.id=te.user_id JOIN projects p ON p.id=te.project_id WHERE te.duration_minutes>600 ORDER BY te.duration_minutes DESC LIMIT 20"),
      pool.query("SELECT u.id,u.full_name,u.team,MAX(te.date) AS last_entry_date FROM users u LEFT JOIN time_entries te ON te.user_id=u.id WHERE u.is_active=TRUE AND u.role='employee' GROUP BY u.id,u.full_name,u.team HAVING MAX(te.date)<NOW()-INTERVAL '7 days' OR MAX(te.date) IS NULL")
    ]);
    res.json({ longEntries: long.rows, missingActivity: missing.rows });
  } catch (err) { next(err); }
});

module.exports = router;
`);

w('timein-backend/src/routes/users.js', `
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, requireRole('manager','admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id,full_name,email,role,team,is_active FROM users ORDER BY full_name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  const { fullName, role, team, isActive } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE users SET full_name=COALESCE($1,full_name),role=COALESCE($2,role),team=COALESCE($3,team),is_active=COALESCE($4,is_active),updated_at=NOW() WHERE id=$5 RETURNING id,full_name,email,role,team,is_active',
      [fullName, role, team, isActive, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
`);

w('timein-backend/src/routes/integrations.js', `
const router = require('express').Router();
const pool   = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.get('/commits', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT gc.*,u.full_name FROM git_commits gc LEFT JOIN users u ON u.id=gc.linked_user_id ORDER BY gc.commit_date DESC LIMIT 100');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/commits', authenticate, async (req, res, next) => {
  const { repository, branch, commitHash, commitMessage, commitDate, linkedTaskId, linkedTimeEntryId } = req.body;
  if (!commitHash || !repository) return res.status(400).json({ error: 'commitHash and repository required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO git_commits (repository,branch,commit_hash,commit_message,commit_author_email,commit_date,linked_user_id,linked_task_id,linked_time_entry_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [repository, branch, commitHash, commitMessage, req.user.email, commitDate||new Date(), req.user.id, linkedTaskId||null, linkedTimeEntryId||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/status', authenticate, async (req, res, next) => {
  try {
    const [c, cu] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM git_commits'),
      pool.query('SELECT COUNT(*) FROM clickup_task_links')
    ]);
    res.json({ git: { status: 'connected', count: +c.rows[0].count }, clickup: { status: 'connected', count: +cu.rows[0].count } });
  } catch (err) { next(err); }
});

module.exports = router;
`);

w('timein-backend/src/app.js', `
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/projects',     require('./routes/projects'));
app.use('/api/tasks',        require('./routes/tasks'));
app.use('/api/time-entries', require('./routes/timeEntries'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/integrations', require('./routes/integrations'));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.use(require('./middleware/errorHandler'));
module.exports = app;
`);

w('timein-backend/src/server.js', `
const app  = require('./app');
const pool = require('./config/db');
const PORT = process.env.PORT || 4000;
pool.query('SELECT 1')
  .then(() => { console.log('✓ Connected to PostgreSQL'); app.listen(PORT, () => console.log('✓ Server on port ' + PORT)); })
  .catch(err => { console.error('✗ DB connection failed:', err.message); process.exit(1); });
`);

console.log('✓ Backend files created');

// ─── FRONTEND ───────────────────────────────────────────────

w('timein-frontend/package.json', JSON.stringify({
  name: "timein-frontend", version: "1.0.0",
  dependencies: {
    react: "^18.2.0", "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0", "react-scripts": "5.0.1",
    axios: "^1.6.5", recharts: "^2.10.0"
  },
  scripts: { start: "react-scripts start", build: "react-scripts build" },
  browserslist: { production: [">0.2%","not dead"], development: ["last 1 chrome version"] }
}, null, 2));

w('timein-frontend/.env', 'REACT_APP_API_URL=http://localhost:4000/api');

w('timein-frontend/public/index.html', `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>TimeIn</title></head>
<body><div id="root"></div></body>
</html>`);

w('timein-frontend/src/index.js', `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
`);

w('timein-frontend/src/api/client.js', `
import axios from 'axios';
const client = axios.create({ baseURL: process.env.REACT_APP_API_URL || '/api' });
client.interceptors.request.use(cfg => {
  const t = localStorage.getItem('timein_token');
  if (t) cfg.headers.Authorization = 'Bearer ' + t;
  return cfg;
});
client.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) { localStorage.removeItem('timein_token'); window.location.href = '/login'; }
    return Promise.reject(new Error(err.response?.data?.error || 'Server error'));
  }
);
export default client;
`);

w('timein-frontend/src/api/auth.js', `
import client from './client';
export const authApi = {
  login:    (email, password) => client.post('/auth/login', { email, password }),
  register: (data)            => client.post('/auth/register', data),
  me:       ()                => client.get('/auth/me'),
};
`);

w('timein-frontend/src/api/projects.js', `
import client from './client';
export const projectsApi = {
  getAll: ()        => client.get('/projects'),
  create: (data)    => client.post('/projects', data),
  update: (id,data) => client.patch('/projects/' + id, data),
};
`);

w('timein-frontend/src/api/tasks.js', `
import client from './client';
export const tasksApi = {
  getAll: (params={}) => client.get('/tasks', { params }),
  create: (data)      => client.post('/tasks', data),
  update: (id,data)   => client.patch('/tasks/' + id, data),
};
`);

w('timein-frontend/src/api/timeEntries.js', `
import client from './client';
export const timeEntriesApi = {
  getAll:  (params={}) => client.get('/time-entries', { params }),
  create:  (data)      => client.post('/time-entries', data),
  update:  (id,data)   => client.patch('/time-entries/' + id, data),
  submit:  (id)        => client.patch('/time-entries/' + id + '/submit'),
  approve: (id)        => client.patch('/time-entries/' + id + '/approve'),
  reject:  (id,reason) => client.patch('/time-entries/' + id + '/reject', { reason }),
  delete:  (id)        => client.delete('/time-entries/' + id),
};
`);

w('timein-frontend/src/api/reports.js', `
import client from './client';
export const reportsApi = {
  summary:   ()          => client.get('/reports/summary'),
  byUser:    (params={}) => client.get('/reports/by-user',    { params }),
  byProject: (params={}) => client.get('/reports/by-project', { params }),
  byTask:    (params={}) => client.get('/reports/by-task',    { params }),
  anomalies: ()          => client.get('/reports/anomalies'),
};
`);

w('timein-frontend/src/api/integrations.js', `
import client from './client';
export const integrationsApi = {
  getCommits: (params={}) => client.get('/integrations/commits', { params }),
  saveCommit: (data)      => client.post('/integrations/commits', data),
  getStatus:  ()          => client.get('/integrations/status'),
};
`);

console.log('✓ API layer created');

w('timein-frontend/src/context/AuthContext.jsx', `
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('timein_token');
    if (!token) { setLoading(false); return; }
    authApi.me().then(setUser).catch(() => localStorage.removeItem('timein_token')).finally(() => setLoading(false));
  }, []);
  const login  = useCallback(async (email, password) => {
    const { token, user } = await authApi.login(email, password);
    localStorage.setItem('timein_token', token);
    setUser(user); return user;
  }, []);
  const logout = useCallback(() => { localStorage.removeItem('timein_token'); setUser(null); }, []);
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
`);

w('timein-frontend/src/context/ToastContext.jsx', `
import { createContext, useContext, useState, useCallback } from 'react';
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((msg, type='success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{ position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',zIndex:9999,display:'flex',flexDirection:'column',gap:8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background:t.type==='error'?'#ef4444':t.type==='warning'?'#f59e0b':'#10b981',color:'#fff',padding:'10px 20px',borderRadius:8,fontSize:13,fontWeight:500 }}>{t.msg}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
`);

console.log('✓ Context created');

w('timein-frontend/src/hooks/useTimeEntries.js', `
import { useState, useEffect, useCallback } from 'react';
import { timeEntriesApi } from '../api/timeEntries';
import { useToast } from '../context/ToastContext';
export function useTimeEntries(filters={}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const key = JSON.stringify(filters);
  const fetch = useCallback(async () => {
    setLoading(true);
    try { const d = await timeEntriesApi.getAll(filters); setEntries(d); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  // eslint-disable-next-line
  }, [key]);
  useEffect(() => { fetch(); }, [fetch]);
  const create  = async (data)      => { const e = await timeEntriesApi.create(data);         setEntries(p => [e,...p]);                    addToast('נשמר כטיוטה');           return e; };
  const update  = async (id, data)  => { const e = await timeEntriesApi.update(id, data);     setEntries(p => p.map(x => x.id===id?e:x));  addToast('עודכן בהצלחה');          return e; };
  const submit  = async (id)        => { const e = await timeEntriesApi.submit(id);            setEntries(p => p.map(x => x.id===id?e:x));  addToast('הוגש לאישור');                     };
  const approve = async (id)        => { const e = await timeEntriesApi.approve(id);           setEntries(p => p.map(x => x.id===id?e:x));  addToast('אושר');                            };
  const reject  = async (id,reason) => { const e = await timeEntriesApi.reject(id, reason);   setEntries(p => p.map(x => x.id===id?e:x));  addToast('הוחזר לבדיקה','warning');          };
  const remove  = async (id)        => { await timeEntriesApi.delete(id);                      setEntries(p => p.filter(x => x.id!==id));   addToast('נמחק');                            };
  return { entries, loading, refetch: fetch, create, update, submit, approve, reject, remove };
}
`);

w('timein-frontend/src/hooks/useProjects.js', `
import { useState, useEffect } from 'react';
import { projectsApi } from '../api/projects';
export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(false);
  useEffect(() => {
    setLoading(true);
    projectsApi.getAll().then(setProjects).finally(() => setLoading(false));
  }, []);
  const create = async (data)    => { const p = await projectsApi.create(data);    setProjects(prev => [...prev, p]);                   return p; };
  const update = async (id,data) => { const p = await projectsApi.update(id,data); setProjects(prev => prev.map(x => x.id===id?p:x));  return p; };
  return { projects, loading, create, update };
}
`);

w('timein-frontend/src/hooks/useTasks.js', `
import { useState, useEffect, useCallback } from 'react';
import { tasksApi } from '../api/tasks';
export function useTasks(filters={}) {
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(filters);
  const fetch = useCallback(() => {
    setLoading(true);
    tasksApi.getAll(filters).then(setTasks).finally(() => setLoading(false));
  // eslint-disable-next-line
  }, [key]);
  useEffect(() => { fetch(); }, [fetch]);
  const create = async (data)    => { const t = await tasksApi.create(data);    setTasks(p => [t,...p]);                  return t; };
  const update = async (id,data) => { const t = await tasksApi.update(id,data); setTasks(p => p.map(x => x.id===id?t:x)); return t; };
  return { tasks, loading, refetch: fetch, create, update };
}
`);

w('timein-frontend/src/hooks/useReports.js', `
import { useState, useCallback } from 'react';
import { reportsApi } from '../api/reports';
export function useReports() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const fetch = useCallback(async (type, params={}) => {
    setLoading(true); setError(null);
    try { const r = await reportsApi[type](params); setData(r); return r; }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  return { data, loading, error, fetch };
}
`);

console.log('✓ Hooks created');

w('timein-frontend/src/components/common/Card.jsx', `
export default function Card({ children, style={} }) {
  return <div style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px 20px',...style }}>{children}</div>;
}
`);

w('timein-frontend/src/components/common/Spinner.jsx', `
export default function Spinner({ fullPage }) {
  const w = fullPage
    ? { position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,0.8)',zIndex:999 }
    : { display:'flex',justifyContent:'center',padding:32 };
  return (
    <div style={w}>
      <div style={{ width:28,height:28,border:'3px solid #e2e8f0',borderTop:'3px solid #6366f1',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
`);

w('timein-frontend/src/components/common/Badge.jsx', `
const M = { draft:['טיוטה','#f1f5f9','#64748b'], submitted:['הוגש','#dbeafe','#1d4ed8'], approved:['אושר','#d1fae5','#065f46'], rejected:['נדחה','#fee2e2','#991b1b'] };
export default function Badge({ status }) {
  const [l,bg,c] = M[status] || ['?','#f1f5f9','#64748b'];
  return <span style={{ fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:20,background:bg,color:c }}>{l}</span>;
}
`);

w('timein-frontend/src/components/common/Avatar.jsx', `
export default function Avatar({ name, size=32 }) {
  const ini = name?.split(' ').map(w => w[0]).join('').slice(0,2) || '??';
  return <div style={{ width:size,height:size,borderRadius:'50%',background:'#e0e7ff',color:'#4f46e5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.35,fontWeight:500,flexShrink:0 }}>{ini}</div>;
}
`);

w('timein-frontend/src/components/layout/Sidebar.jsx', `
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
const NAV = [
  { to:'/',             label:'דאשבורד',     icon:'⊞', roles:['employee','manager','admin'] },
  { to:'/report',       label:'דיווח שעות',  icon:'+', roles:['employee','manager','admin'] },
  { to:'/my-entries',   label:'הדיווחים שלי',icon:'☰', roles:['employee','manager','admin'] },
  { to:'/management',   label:'ניהול',        icon:'◈', roles:['manager','admin'] },
  { to:'/integrations', label:'אינטגרציות',   icon:'⇄', roles:['employee','manager','admin'] },
];
export default function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <div dir="rtl" style={{ width:200,background:'#fff',borderLeft:'1px solid #e2e8f0',display:'flex',flexDirection:'column',flexShrink:0 }}>
      <div style={{ padding:'20px 16px',borderBottom:'1px solid #f1f5f9' }}>
        <div style={{ fontSize:20,fontWeight:700,color:'#6366f1' }}>TimeIn</div>
        <div style={{ fontSize:10,color:'#94a3b8',marginTop:2 }}>ניהול שעות עבודה</div>
      </div>
      <nav style={{ padding:8,flex:1 }}>
        {NAV.filter(n => n.roles.includes(user?.role)).map(n => (
          <NavLink key={n.to} to={n.to} end={n.to==='/'} style={({ isActive }) => ({ display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:8,marginBottom:2,textDecoration:'none',background:isActive?'#e0e7ff':'transparent',color:isActive?'#4f46e5':'#64748b',fontSize:13,fontWeight:isActive?500:400 })}>
            <span>{n.icon}</span>{n.label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding:12,borderTop:'1px solid #f1f5f9' }}>
        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
          <Avatar name={user?.full_name} size={28} />
          <div><div style={{ fontSize:12,fontWeight:500,color:'#334155' }}>{user?.full_name}</div><div style={{ fontSize:10,color:'#94a3b8' }}>{user?.role}</div></div>
        </div>
        <button onClick={logout} style={{ width:'100%',padding:7,borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',fontSize:12,cursor:'pointer' }}>יציאה</button>
      </div>
    </div>
  );
}
`);

console.log('✓ Components created');

w('timein-frontend/src/pages/LoginPage.jsx', `
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }   = useAuth();
  const { addToast } = useToast();
  const navigate    = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { addToast('נא למלא אימייל וסיסמה', 'error'); return; }
    setLoading(true);
    try { await login(email, password); navigate('/'); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  };
  return (
    <div dir="rtl" style={{ minHeight:'100vh',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif' }}>
      <div style={{ background:'#fff',borderRadius:16,padding:'40px 36px',width:340,boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign:'center',marginBottom:32 }}>
          <h1 style={{ fontSize:32,fontWeight:700,color:'#6366f1',margin:0 }}>TimeIn</h1>
          <p style={{ color:'#94a3b8',fontSize:13,margin:'4px 0 0' }}>מערכת ניהול שעות עבודה</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <div><label style={{ fontSize:12,color:'#64748b',fontWeight:500 }}>אימייל</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus style={{ width:'100%',marginTop:4,padding:'9px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:14,boxSizing:'border-box' }} /></div>
          <div><label style={{ fontSize:12,color:'#64748b',fontWeight:500 }}>סיסמה</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{ width:'100%',marginTop:4,padding:'9px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:14,boxSizing:'border-box' }} /></div>
          <button type="submit" disabled={loading} style={{ marginTop:8,padding:10,borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:14,fontWeight:500,cursor:'pointer',opacity:loading?0.7:1 }}>{loading?'מתחבר...':'כניסה'}</button>
        </form>
      </div>
    </div>
  );
}
`);

w('timein-frontend/src/pages/DashboardPage.jsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { reportsApi } from '../api/reports';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
const fmt = m => m ? Math.floor(m/60) + ':' + String(m%60).padStart(2,'0') : '0:00';
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { entries, loading } = useTimeEntries();
  const [summary, setSummary] = useState(null);
  useEffect(() => { reportsApi.summary().then(setSummary).catch(()=>{}); }, []);
  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20,fontWeight:600,margin:0,color:'#1e293b' }}>שלום, {user?.full_name?.split(' ')[0]}</h2>
        <p style={{ color:'#94a3b8',fontSize:13,marginTop:4 }}>{new Date().toLocaleDateString('he-IL',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
      </div>
      <div style={{ display:'flex',gap:12,marginBottom:20 }}>
        {[['היום',summary?.today_minutes,'#6366f1'],['השבוע',summary?.week_minutes,'#3b82f6'],['החודש',summary?.month_minutes,'#10b981'],['טיוטות',summary?.draft_count,'#f59e0b']].map(([l,v,c]) => (
          <Card key={l} style={{ flex:1 }}>
            <div style={{ fontSize:10,color:'#94a3b8',textTransform:'uppercase' }}>{l}</div>
            <div style={{ fontSize:24,fontWeight:600,color:c,margin:'4px 0' }}>{v!=null?(l==='טיוטות'?v:fmt(+v)):'—'}</div>
          </Card>
        ))}
      </div>
      <Card>
        <div style={{ fontSize:13,fontWeight:500,color:'#64748b',marginBottom:12 }}>דיווחים אחרונים</div>
        {loading && <Spinner />}
        {entries.slice(0,5).map(e => (
          <div key={e.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}>
            <span style={{ color:'#94a3b8',minWidth:80 }}>{e.date}</span>
            <span style={{ flex:1,color:'#334155',fontWeight:500 }}>{e.project_name}</span>
            <span style={{ color:'#64748b' }}>{e.description}</span>
            <span style={{ fontWeight:600,color:'#6366f1' }}>{fmt(e.duration_minutes)}</span>
            <Badge status={e.status} />
          </div>
        ))}
        {!loading && !entries.length && <p style={{ color:'#94a3b8',textAlign:'center',padding:20 }}>אין דיווחים עדיין</p>}
        <button onClick={() => navigate('/report')} style={{ marginTop:12,width:'100%',padding:8,borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer' }}>+ דיווח חדש</button>
      </Card>
    </div>
  );
}
`);

w('timein-frontend/src/pages/ReportPage.jsx', `
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useTasks }    from '../hooks/useTasks';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useToast }    from '../context/ToastContext';
import Card from '../components/common/Card';
const today = new Date().toISOString().slice(0,10);
export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { projects } = useProjects();
  const { entries, create, update } = useTimeEntries();
  const [form, setForm] = useState({ projectId:'',taskId:'',date:today,startTime:'',endTime:'',durationMinutes:'',workType:'development',description:'',commitHash:'',clickUpTaskId:'' });
  const [saving, setSaving] = useState(false);
  const { tasks } = useTasks({ projectId: form.projectId || undefined });
  useEffect(() => {
    if (!id) return;
    const e = entries.find(x => x.id === +id);
    if (!e) return;
    setForm({ projectId:String(e.project_id),taskId:String(e.task_id||''),date:e.date,startTime:e.start_time?.slice(0,5)||'',endTime:e.end_time?.slice(0,5)||'',durationMinutes:String(e.duration_minutes),workType:e.work_type||'development',description:e.description||'',commitHash:e.related_commit_ids?.[0]||'',clickUpTaskId:e.related_clickup_task_id||'' });
  }, [id, entries]);
  const set = f => e => setForm(p => ({...p,[f]:e.target.value}));
  const inp = { border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 10px',fontSize:13,width:'100%',boxSizing:'border-box',background:'#fff' };
  const lbl = { fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 };
  const handleSave = async () => {
    if (!form.projectId || !form.date) { addToast('חובה לבחור פרויקט ותאריך','error'); return; }
    setSaving(true);
    try {
      const payload = { projectId:+form.projectId,taskId:form.taskId?+form.taskId:null,date:form.date,startTime:form.startTime||null,endTime:form.endTime||null,durationMinutes:form.durationMinutes?+form.durationMinutes:null,workType:form.workType,description:form.description,relatedCommitIds:form.commitHash?[form.commitHash]:[],relatedClickupTaskId:form.clickUpTaskId||null };
      if (id) await update(+id, payload); else await create(payload);
      navigate('/my-entries');
    } catch(err) { addToast(err.message,'error'); } finally { setSaving(false); }
  };
  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <h2 style={{ fontSize:18,fontWeight:600,marginBottom:20,color:'#1e293b' }}>{id?'עריכת דיווח':'דיווח שעות'}</h2>
      <Card style={{ maxWidth:560 }}>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <div><label style={lbl}>פרויקט *</label><select value={form.projectId} onChange={e=>setForm(p=>({...p,projectId:e.target.value,taskId:''}))} style={inp}><option value="">בחר פרויקט</option>{projects.map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}</select></div>
          <div><label style={lbl}>משימה</label><select value={form.taskId} onChange={set('taskId')} style={inp}><option value="">בחר משימה</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.task_name}</option>)}</select></div>
          <div><label style={lbl}>תאריך *</label><input type="date" value={form.date} onChange={set('date')} style={inp}/></div>
          <div style={{ display:'flex',gap:10 }}>
            <div style={{ flex:1 }}><label style={lbl}>שעת התחלה</label><input type="time" value={form.startTime} onChange={set('startTime')} style={inp}/></div>
            <div style={{ flex:1 }}><label style={lbl}>שעת סיום</label><input type="time" value={form.endTime} onChange={set('endTime')} style={inp}/></div>
          </div>
          <div><label style={lbl}>או משך (דקות)</label><input type="number" min="1" value={form.durationMinutes} onChange={set('durationMinutes')} placeholder="90" style={inp}/></div>
          <div><label style={lbl}>סוג עבודה</label><select value={form.workType} onChange={set('workType')} style={inp}>{[['development','פיתוח'],['design','עיצוב'],['review','ריביו'],['devops','DevOps'],['meeting','פגישה'],['qa','QA'],['other','אחר']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
          <div><label style={lbl}>תיאור</label><textarea value={form.description} onChange={set('description')} rows={3} placeholder="מה עשית?" style={{...inp,resize:'vertical',fontFamily:'inherit'}}/></div>
          <div style={{ display:'flex',gap:10 }}>
            <div style={{ flex:1 }}><label style={lbl}>Git Commit Hash</label><input value={form.commitHash} onChange={set('commitHash')} placeholder="abc123" style={inp}/></div>
            <div style={{ flex:1 }}><label style={lbl}>ClickUp Task ID</label><input value={form.clickUpTaskId} onChange={set('clickUpTaskId')} placeholder="CU-T001" style={inp}/></div>
          </div>
          <div style={{ display:'flex',gap:10 }}>
            <button onClick={handleSave} disabled={saving} style={{ flex:1,padding:10,borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:14,fontWeight:500,cursor:'pointer',opacity:saving?0.7:1 }}>{saving?'שומר...':id?'עדכן':'שמור כטיוטה'}</button>
            <button onClick={() => navigate('/my-entries')} style={{ padding:'10px 18px',borderRadius:8,background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',fontSize:14,cursor:'pointer' }}>בטל</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
`);

w('timein-frontend/src/pages/MyEntriesPage.jsx', `
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useProjects }    from '../hooks/useProjects';
import { useToast }       from '../context/ToastContext';
import Card    from '../components/common/Card';
import Badge   from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
const fmt = m => Math.floor(m/60) + ':' + String(m%60).padStart(2,'0');
export default function MyEntriesPage() {
  const navigate   = useNavigate();
  const { addToast } = useToast();
  const { projects } = useProjects();
  const [f, setF] = useState({ projectId:'', status:'', date:'' });
  const { entries, loading, submit, remove } = useTimeEntries(Object.fromEntries(Object.entries(f).filter(([,v])=>v)));
  const sel = { border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 10px',fontSize:12,background:'#fff' };
  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
        <h2 style={{ fontSize:18,fontWeight:600,margin:0,color:'#1e293b' }}>הדיווחים שלי</h2>
        <button onClick={() => navigate('/report')} style={{ padding:'7px 16px',borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer' }}>+ דיווח חדש</button>
      </div>
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'flex',gap:10,flexWrap:'wrap' }}>
          <select value={f.projectId} onChange={e=>setF(p=>({...p,projectId:e.target.value}))} style={sel}><option value="">כל הפרויקטים</option>{projects.map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}</select>
          <select value={f.status} onChange={e=>setF(p=>({...p,status:e.target.value}))} style={sel}><option value="">כל הסטטוסים</option><option value="draft">טיוטה</option><option value="submitted">הוגש</option><option value="approved">אושר</option><option value="rejected">נדחה</option></select>
          <input type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))} style={sel}/>
          <button onClick={() => setF({projectId:'',status:'',date:''})} style={{ padding:'7px 12px',borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',fontSize:12,cursor:'pointer' }}>נקה</button>
        </div>
      </Card>
      <Card>
        {loading && <Spinner />}
        {!loading && !entries.length && <p style={{ textAlign:'center',color:'#94a3b8',padding:40 }}>אין דיווחים</p>}
        {entries.map(e => (
          <div key={e.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'11px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}>
            <span style={{ color:'#94a3b8',minWidth:80 }}>{e.date}</span>
            <div style={{ flex:1 }}><div style={{ fontWeight:500,color:'#1e293b' }}>{e.project_name}</div><div style={{ color:'#64748b' }}>{e.description}</div></div>
            <span style={{ fontWeight:600,color:'#6366f1',minWidth:48 }}>{fmt(e.duration_minutes)}</span>
            <Badge status={e.status}/>
            <div style={{ display:'flex',gap:5 }}>
              {e.status==='draft' && <>
                <button onClick={() => submit(e.id).catch(err=>addToast(err.message,'error'))} style={{ padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',fontSize:11,cursor:'pointer' }}>הגש</button>
                <button onClick={() => navigate('/report/'+e.id)} style={{ padding:'4px 8px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',fontSize:11,cursor:'pointer' }}>✏</button>
                <button onClick={() => { if(window.confirm('למחוק?')) remove(e.id); }} style={{ padding:'4px 8px',borderRadius:6,border:'none',background:'#fee2e2',color:'#dc2626',fontSize:11,cursor:'pointer' }}>✕</button>
              </>}
              {e.status==='rejected' && <button onClick={() => navigate('/report/'+e.id)} style={{ padding:'4px 10px',borderRadius:6,border:'1px solid #fca5a5',color:'#dc2626',background:'#fff',fontSize:11,cursor:'pointer' }}>תקן</button>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
`);

w('timein-frontend/src/pages/ManagementPage.jsx', `
import { useState, useEffect } from 'react';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useReports }     from '../hooks/useReports';
import { useToast }       from '../context/ToastContext';
import Card    from '../components/common/Card';
import Badge   from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
const fmt = m => m ? Math.floor(m/60) + ':' + String(m%60).padStart(2,'0') : '—';
export default function ManagementPage() {
  const { addToast } = useToast();
  const { data, loading:rLoading, fetch:fetchReport } = useReports();
  const [rType, setRType] = useState('byUser');
  const [f, setF] = useState({ status:'', date:'' });
  const { entries, loading, approve, reject } = useTimeEntries(Object.fromEntries(Object.entries(f).filter(([,v])=>v)));
  useEffect(() => { fetchReport(rType); }, [rType]);
  const handleReject = async (id) => {
    const reason = window.prompt('סיבת הדחייה:');
    try { await reject(id, reason); } catch(err) { addToast(err.message,'error'); }
  };
  const sel = { border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 10px',fontSize:12,background:'#fff' };
  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <h2 style={{ fontSize:18,fontWeight:600,marginBottom:20,color:'#1e293b' }}>ניהול</h2>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:'flex',gap:8,marginBottom:14 }}>
          {[['byUser','לפי עובד'],['byProject','לפי פרויקט'],['byTask','לפי משימה'],['anomalies','חריגות']].map(([k,l]) => (
            <button key={k} onClick={() => setRType(k)} style={{ padding:'6px 14px',borderRadius:8,border:rType===k?'none':'1px solid #e2e8f0',background:rType===k?'#6366f1':'#fff',color:rType===k?'#fff':'#64748b',fontSize:12,cursor:'pointer',fontWeight:rType===k?500:400 }}>{l}</button>
          ))}
        </div>
        {rLoading && <Spinner />}
        {data && rType==='byUser' && (
          <table style={{ width:'100%',fontSize:12,borderCollapse:'collapse' }}>
            <thead><tr style={{ color:'#94a3b8' }}>{['עובד','צוות','שעות','דיווחים','פרויקטים'].map(h=><th key={h} style={{ textAlign:'right',padding:'6px 0',fontWeight:400 }}>{h}</th>)}</tr></thead>
            <tbody>{data.map(r=><tr key={r.user_id} style={{ borderTop:'1px solid #f1f5f9' }}><td style={{ padding:'8px 0',fontWeight:500 }}>{r.full_name}</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.team}</td><td style={{ padding:'8px 0',color:'#6366f1',fontWeight:600 }}>{r.total_hours}ש'</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.entry_count}</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.project_count}</td></tr>)}</tbody>
          </table>
        )}
        {data && rType==='byProject' && (
          <table style={{ width:'100%',fontSize:12,borderCollapse:'collapse' }}>
            <thead><tr style={{ color:'#94a3b8' }}>{['פרויקט','שעות','עובדים','דיווחים'].map(h=><th key={h} style={{ textAlign:'right',padding:'6px 0',fontWeight:400 }}>{h}</th>)}</tr></thead>
            <tbody>{data.map(r=><tr key={r.project_id} style={{ borderTop:'1px solid #f1f5f9' }}><td style={{ padding:'8px 0',fontWeight:500 }}>{r.project_name}</td><td style={{ padding:'8px 0',color:'#6366f1',fontWeight:600 }}>{r.total_hours}ש'</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.user_count}</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.entry_count}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
      <Card>
        <div style={{ fontSize:13,fontWeight:500,color:'#64748b',marginBottom:12 }}>אישור דיווחים</div>
        <div style={{ display:'flex',gap:10,marginBottom:12 }}>
          <select value={f.status} onChange={e=>setF(p=>({...p,status:e.target.value}))} style={sel}><option value="">כל הסטטוסים</option><option value="submitted">ממתינים</option><option value="approved">אושרו</option><option value="rejected">נדחו</option></select>
          <input type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))} style={sel}/>
        </div>
        {loading && <Spinner />}
        {entries.map(e => (
          <div key={e.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}>
            <span style={{ color:'#94a3b8',minWidth:80 }}>{e.date}</span>
            <div style={{ flex:1 }}><div style={{ fontWeight:500 }}>{e.user_name}</div><div style={{ color:'#64748b' }}>{e.project_name}</div></div>
            <span style={{ fontWeight:600,color:'#6366f1' }}>{fmt(e.duration_minutes)}</span>
            <Badge status={e.status}/>
            {e.status==='submitted' && (
              <div style={{ display:'flex',gap:5 }}>
                <button onClick={() => approve(e.id).catch(err=>addToast(err.message,'error'))} style={{ padding:'4px 10px',borderRadius:6,background:'#d1fae5',color:'#065f46',border:'none',fontSize:11,cursor:'pointer',fontWeight:500 }}>אשר</button>
                <button onClick={() => handleReject(e.id)} style={{ padding:'4px 10px',borderRadius:6,background:'#fee2e2',color:'#991b1b',border:'none',fontSize:11,cursor:'pointer',fontWeight:500 }}>דחה</button>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
`);

w('timein-frontend/src/pages/IntegrationsPage.jsx', `
import { useEffect, useState } from 'react';
import { integrationsApi } from '../api/integrations';
import Card from '../components/common/Card';
export default function IntegrationsPage() {
  const [status,  setStatus]  = useState(null);
  const [commits, setCommits] = useState([]);
  useEffect(() => {
    integrationsApi.getStatus().then(setStatus).catch(()=>{});
    integrationsApi.getCommits().then(setCommits).catch(()=>{});
  }, []);
  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <h2 style={{ fontSize:18,fontWeight:600,marginBottom:20,color:'#1e293b' }}>אינטגרציות</h2>
      <div style={{ display:'flex',gap:16,flexWrap:'wrap',marginBottom:16 }}>
        <Card style={{ flex:1,minWidth:240 }}>
          <div style={{ fontWeight:500,marginBottom:8 }}>Git</div>
          <div style={{ fontSize:12,color:'#64748b' }}>סטטוס: {status?.git?.status||'בודק...'}</div>
          <div style={{ fontSize:12,color:'#64748b' }}>commits שמורים: {status?.git?.count||0}</div>
        </Card>
        <Card style={{ flex:1,minWidth:240 }}>
          <div style={{ fontWeight:500,marginBottom:8 }}>ClickUp</div>
          <div style={{ fontSize:12,color:'#64748b' }}>סטטוס: {status?.clickup?.status||'בודק...'}</div>
          <div style={{ fontSize:12,color:'#64748b' }}>משימות: {status?.clickup?.count||0}</div>
        </Card>
      </div>
      <Card>
        <div style={{ fontSize:13,fontWeight:500,color:'#64748b',marginBottom:12 }}>commits אחרונים</div>
        {!commits.length && <p style={{ color:'#94a3b8',fontSize:12,textAlign:'center',padding:20 }}>אין commits עדיין</p>}
        {commits.map(c => (
          <div key={c.id} style={{ display:'flex',gap:10,padding:'8px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}>
            <code style={{ background:'#f1f5f9',padding:'2px 8px',borderRadius:4 }}>{c.commit_hash?.slice(0,7)}</code>
            <span style={{ flex:1,color:'#334155' }}>{c.commit_message}</span>
            <span style={{ color:'#94a3b8' }}>{c.full_name}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
`);

w('timein-frontend/src/App.jsx', `
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider }         from './context/ToastContext';
import Sidebar           from './components/layout/Sidebar';
import Spinner           from './components/common/Spinner';
import LoginPage         from './pages/LoginPage';
import DashboardPage     from './pages/DashboardPage';
import ReportPage        from './pages/ReportPage';
import MyEntriesPage     from './pages/MyEntriesPage';
import ManagementPage    from './pages/ManagementPage';
import IntegrationsPage  from './pages/IntegrationsPage';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner fullPage />;
  if (!user)   return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppLayout() {
  return (
    <div dir="rtl" style={{ display:'flex',height:'100vh',background:'#f8fafc',fontFamily:'system-ui,sans-serif' }}>
      <Sidebar />
      <main style={{ flex:1,overflow:'auto',padding:24 }}>
        <Routes>
          <Route path="/"             element={<DashboardPage />} />
          <Route path="/report"       element={<ReportPage />} />
          <Route path="/report/:id"   element={<ReportPage />} />
          <Route path="/my-entries"   element={<MyEntriesPage />} />
          <Route path="/management"   element={<ProtectedRoute roles={['manager','admin']}><ManagementPage /></ProtectedRoute>} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*"     element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
`);

console.log('✓ All pages created');
console.log('');
console.log('✅ כל הקבצים נוצרו בהצלחה!');
console.log('');
console.log('עכשיו הרץ:');
console.log('  cd timein-backend && npm install');
console.log('  cd ../timein-frontend && npm install');