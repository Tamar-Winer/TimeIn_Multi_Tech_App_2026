@echo off
chcp 65001 >nul
echo ========================================
echo   TimeIn - יוצר את כל הפרויקט...
echo ========================================

:: ── תיקיות ──────────────────────────────────────────────────
mkdir timein-backend\src\config
mkdir timein-backend\src\middleware
mkdir timein-backend\src\routes
mkdir timein-backend\src\db
mkdir timein-frontend\src\api
mkdir timein-frontend\src\context
mkdir timein-frontend\src\hooks
mkdir timein-frontend\src\components\layout
mkdir timein-frontend\src\components\common
mkdir timein-frontend\src\components\timer
mkdir timein-frontend\src\pages
mkdir timein-frontend\src\utils

echo [1/20] תיקיות נוצרו

:: ════════════════════════════════════════════════════════════
:: BACKEND FILES
:: ════════════════════════════════════════════════════════════

:: ── package.json ────────────────────────────────────────────
(
echo {
echo   "name": "timein-backend",
echo   "version": "1.0.0",
echo   "main": "src/server.js",
echo   "scripts": {
echo     "start": "node src/server.js",
echo     "dev": "nodemon src/server.js"
echo   },
echo   "dependencies": {
echo     "express": "^4.18.2",
echo     "pg": "^8.11.3",
echo     "bcryptjs": "^2.4.3",
echo     "jsonwebtoken": "^9.0.2",
echo     "cors": "^2.8.5",
echo     "dotenv": "^16.3.1",
echo     "express-validator": "^7.0.1",
echo     "morgan": "^1.10.0"
echo   },
echo   "devDependencies": {
echo     "nodemon": "^3.0.2"
echo   }
echo }
) > timein-backend\package.json

:: ── .env ────────────────────────────────────────────────────
(
echo PORT=4000
echo DATABASE_URL=postgresql://postgres:Winer4852@localhost:5432/timein
echo JWT_SECRET=timein_super_secret_jwt_key_2025
echo JWT_EXPIRES_IN=7d
echo NODE_ENV=development
echo FRONTEND_URL=http://localhost:3000
) > timein-backend\.env

echo [2/20] package.json + .env נוצרו

:: ── src/db/schema.sql ───────────────────────────────────────
(
echo CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
echo.
echo CREATE TABLE users ^(
echo   id            SERIAL PRIMARY KEY,
echo   full_name     VARCHAR^(100^) NOT NULL,
echo   email         VARCHAR^(150^) UNIQUE NOT NULL,
echo   password_hash VARCHAR^(255^) NOT NULL,
echo   role          VARCHAR^(20^) NOT NULL DEFAULT 'employee'
echo                 CHECK ^(role IN ^('employee','manager','admin'^)^),
echo   team          VARCHAR^(100^),
echo   is_active     BOOLEAN NOT NULL DEFAULT TRUE,
echo   created_at    TIMESTAMPTZ DEFAULT NOW^(^),
echo   updated_at    TIMESTAMPTZ DEFAULT NOW^(^)
echo ^);
echo.
echo CREATE TABLE projects ^(
echo   id                  SERIAL PRIMARY KEY,
echo   project_name        VARCHAR^(150^) NOT NULL,
echo   description         TEXT,
echo   status              VARCHAR^(20^) NOT NULL DEFAULT 'active'
echo                       CHECK ^(status IN ^('active','archived','completed'^)^),
echo   manager_id          INTEGER REFERENCES users^(id^),
echo   clickup_space_id    VARCHAR^(100^),
echo   git_repository_name VARCHAR^(150^),
echo   git_repository_url  VARCHAR^(300^),
echo   created_at          TIMESTAMPTZ DEFAULT NOW^(^),
echo   updated_at          TIMESTAMPTZ DEFAULT NOW^(^)
echo ^);
echo.
echo CREATE TABLE project_members ^(
echo   project_id INTEGER REFERENCES projects^(id^) ON DELETE CASCADE,
echo   user_id    INTEGER REFERENCES users^(id^) ON DELETE CASCADE,
echo   PRIMARY KEY ^(project_id, user_id^)
echo ^);
echo.
echo CREATE TABLE tasks ^(
echo   id               SERIAL PRIMARY KEY,
echo   task_name        VARCHAR^(200^) NOT NULL,
echo   description      TEXT,
echo   project_id       INTEGER NOT NULL REFERENCES projects^(id^) ON DELETE CASCADE,
echo   assigned_user_id INTEGER REFERENCES users^(id^),
echo   status           VARCHAR^(30^) NOT NULL DEFAULT 'todo'
echo                    CHECK ^(status IN ^('todo','in_progress','review','done','cancelled'^)^),
echo   priority         VARCHAR^(20^) NOT NULL DEFAULT 'medium'
echo                    CHECK ^(priority IN ^('low','medium','high','urgent'^)^),
echo   clickup_task_id  VARCHAR^(100^),
echo   estimated_hours  DECIMAL^(6,2^),
echo   due_date         DATE,
echo   created_at       TIMESTAMPTZ DEFAULT NOW^(^),
echo   updated_at       TIMESTAMPTZ DEFAULT NOW^(^)
echo ^);
echo.
echo CREATE TABLE time_entries ^(
echo   id                      SERIAL PRIMARY KEY,
echo   user_id                 INTEGER NOT NULL REFERENCES users^(id^),
echo   project_id              INTEGER NOT NULL REFERENCES projects^(id^),
echo   task_id                 INTEGER REFERENCES tasks^(id^),
echo   date                    DATE NOT NULL,
echo   start_time              TIME,
echo   end_time                TIME,
echo   duration_minutes        INTEGER NOT NULL CHECK ^(duration_minutes ^> 0^),
echo   work_type               VARCHAR^(30^) DEFAULT 'development'
echo                           CHECK ^(work_type IN ^('development','design','review','devops','meeting','qa','other'^)^),
echo   description             TEXT,
echo   source                  VARCHAR^(20^) NOT NULL DEFAULT 'manual'
echo                           CHECK ^(source IN ^('manual','timer','git','clickup','suggested'^)^),
echo   status                  VARCHAR^(20^) NOT NULL DEFAULT 'draft'
echo                           CHECK ^(status IN ^('draft','submitted','approved','rejected'^)^),
echo   related_commit_ids      TEXT[],
echo   related_clickup_task_id VARCHAR^(100^),
echo   approved_by             INTEGER REFERENCES users^(id^),
echo   approved_at             TIMESTAMPTZ,
echo   rejection_reason        TEXT,
echo   created_at              TIMESTAMPTZ DEFAULT NOW^(^),
echo   updated_at              TIMESTAMPTZ DEFAULT NOW^(^)
echo ^);
echo.
echo CREATE OR REPLACE FUNCTION check_time_overlap^(^)
echo RETURNS TRIGGER AS $$
echo BEGIN
echo   IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
echo     IF EXISTS ^(
echo       SELECT 1 FROM time_entries
echo       WHERE user_id = NEW.user_id AND date = NEW.date
echo         AND id != COALESCE^(NEW.id, -1^)
echo         AND start_time IS NOT NULL AND end_time IS NOT NULL
echo         AND ^(NEW.start_time, NEW.end_time^) OVERLAPS ^(start_time, end_time^)
echo     ^) THEN
echo       RAISE EXCEPTION 'Time overlap detected';
echo     END IF;
echo   END IF;
echo   RETURN NEW;
echo END;
echo $$ LANGUAGE plpgsql;
echo.
echo CREATE TRIGGER time_entry_overlap_check
echo BEFORE INSERT OR UPDATE ON time_entries
echo FOR EACH ROW EXECUTE FUNCTION check_time_overlap^(^);
echo.
echo CREATE TABLE git_commits ^(
echo   id                   SERIAL PRIMARY KEY,
echo   repository           VARCHAR^(200^) NOT NULL,
echo   branch               VARCHAR^(150^),
echo   commit_hash          VARCHAR^(40^) NOT NULL,
echo   commit_message       TEXT,
echo   commit_author_email  VARCHAR^(150^),
echo   commit_date          TIMESTAMPTZ,
echo   linked_user_id       INTEGER REFERENCES users^(id^),
echo   linked_task_id       INTEGER REFERENCES tasks^(id^),
echo   linked_time_entry_id INTEGER REFERENCES time_entries^(id^),
echo   created_at           TIMESTAMPTZ DEFAULT NOW^(^)
echo ^);
echo.
echo CREATE TABLE clickup_task_links ^(
echo   id               SERIAL PRIMARY KEY,
echo   clickup_task_id  VARCHAR^(100^) NOT NULL UNIQUE,
echo   task_name        VARCHAR^(200^),
echo   project_id       INTEGER REFERENCES projects^(id^),
echo   assigned_user_id INTEGER REFERENCES users^(id^),
echo   status           VARCHAR^(50^),
echo   estimated_time   INTEGER,
echo   due_date         DATE,
echo   last_sync_date   TIMESTAMPTZ DEFAULT NOW^(^),
echo   created_at       TIMESTAMPTZ DEFAULT NOW^(^)
echo ^);
echo.
echo CREATE INDEX idx_te_user    ON time_entries^(user_id^);
echo CREATE INDEX idx_te_project ON time_entries^(project_id^);
echo CREATE INDEX idx_te_task    ON time_entries^(task_id^);
echo CREATE INDEX idx_te_date    ON time_entries^(date^);
echo CREATE INDEX idx_te_status  ON time_entries^(status^);
echo CREATE INDEX idx_t_project  ON tasks^(project_id^);
echo CREATE INDEX idx_t_user     ON tasks^(assigned_user_id^);
) > timein-backend\src\db\schema.sql

echo [3/20] schema.sql נוצר

:: ── src/config/db.js ────────────────────────────────────────
(
echo const { Pool } = require('pg'^);
echo require('dotenv'^).config^(^);
echo const pool = new Pool^({ connectionString: process.env.DATABASE_URL, ssl: false }^);
echo pool.on^('error', ^(err^) =^> { console.error^('DB error', err^); }^);
echo module.exports = pool;
) > timein-backend\src\config\db.js

:: ── src/middleware/auth.js ───────────────────────────────────
(
echo const jwt  = require('jsonwebtoken'^);
echo const pool = require('../config/db'^);
echo const authenticate = async ^(req, res, next^) =^> {
echo   const h = req.headers.authorization;
echo   if ^(!h?.startsWith^('Bearer '^)^) return res.status^(401^).json^({ error: 'No token' }^);
echo   try {
echo     const d = jwt.verify^(h.split^(' '^)[1], process.env.JWT_SECRET^);
echo     const { rows } = await pool.query^('SELECT id,full_name,email,role,team FROM users WHERE id=$1 AND is_active=TRUE', [d.userId]^);
echo     if ^(!rows.length^) return res.status^(401^).json^({ error: 'User not found' }^);
echo     req.user = rows[0]; next^(^);
echo   } catch { return res.status^(401^).json^({ error: 'Invalid token' }^); }
echo };
echo const requireRole = ^(...roles^) =^> ^(req, res, next^) =^> {
echo   if ^(!roles.includes^(req.user.role^)^) return res.status^(403^).json^({ error: 'Forbidden' }^);
echo   next^(^);
echo };
echo module.exports = { authenticate, requireRole };
) > timein-backend\src\middleware\auth.js

:: ── src/middleware/errorHandler.js ──────────────────────────
(
echo const errorHandler = ^(err, req, res, next^) =^> {
echo   console.error^(err.stack^);
echo   res.status^(err.status ^|^| 500^).json^({ error: err.message ^|^| 'Server error' }^);
echo };
echo module.exports = errorHandler;
) > timein-backend\src\middleware\errorHandler.js

echo [4/20] middleware נוצר

:: ── src/routes/auth.js ──────────────────────────────────────
(
echo const router  = require^('express'^).Router^(^);
echo const bcrypt  = require^('bcryptjs'^);
echo const jwt     = require^('jsonwebtoken'^);
echo const pool    = require^('../config/db'^);
echo const { authenticate } = require^('../middleware/auth'^);
echo.
echo router.post^('/register', async ^(req, res, next^) =^> {
echo   const { fullName, email, password, role='employee', team } = req.body;
echo   if ^(!fullName ^|^| !email ^|^| !password^) return res.status^(400^).json^({ error: 'Missing fields' }^);
echo   try {
echo     const hash = await bcrypt.hash^(password, 10^);
echo     const { rows } = await pool.query^(
echo       'INSERT INTO users ^(full_name,email,password_hash,role,team^) VALUES ^($1,$2,$3,$4,$5^) RETURNING id,full_name,email,role,team',
echo       [fullName, email, hash, role, team]
echo     ^);
echo     res.status^(201^).json^(rows[0]^);
echo   } catch ^(err^) {
echo     if ^(err.code==='23505'^) return res.status^(409^).json^({ error: 'Email exists' }^);
echo     next^(err^);
echo   }
echo }^);
echo.
echo router.post^('/login', async ^(req, res, next^) =^> {
echo   const { email, password } = req.body;
echo   if ^(!email ^|^| !password^) return res.status^(400^).json^({ error: 'Missing fields' }^);
echo   try {
echo     const { rows } = await pool.query^('SELECT * FROM users WHERE email=$1 AND is_active=TRUE', [email]^);
echo     if ^(!rows.length^) return res.status^(401^).json^({ error: 'Invalid credentials' }^);
echo     const match = await bcrypt.compare^(password, rows[0].password_hash^);
echo     if ^(!match^) return res.status^(401^).json^({ error: 'Invalid credentials' }^);
echo     const token = jwt.sign^({ userId: rows[0].id, role: rows[0].role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN }^);
echo     const { password_hash, ...user } = rows[0];
echo     res.json^({ token, user }^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.get^('/me', authenticate, ^(req, res^) =^> res.json^(req.user^)^);
echo module.exports = router;
) > timein-backend\src\routes\auth.js

:: ── src/routes/projects.js ──────────────────────────────────
(
echo const router = require^('express'^).Router^(^);
echo const pool   = require^('../config/db'^);
echo const { authenticate, requireRole } = require^('../middleware/auth'^);
echo.
echo router.get^('/', authenticate, async ^(req, res, next^) =^> {
echo   try {
echo     const { rows } = await pool.query^('SELECT p.*,u.full_name AS manager_name FROM projects p LEFT JOIN users u ON u.id=p.manager_id ORDER BY p.project_name'^);
echo     res.json^(rows^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.post^('/', authenticate, requireRole^('admin'^), async ^(req, res, next^) =^> {
echo   const { projectName, description, managerId, gitRepositoryName, gitRepositoryUrl, clickupSpaceId } = req.body;
echo   if ^(!projectName^) return res.status^(400^).json^({ error: 'projectName required' }^);
echo   try {
echo     const { rows } = await pool.query^(
echo       'INSERT INTO projects ^(project_name,description,manager_id,git_repository_name,git_repository_url,clickup_space_id^) VALUES ^($1,$2,$3,$4,$5,$6^) RETURNING *',
echo       [projectName,description,managerId,gitRepositoryName,gitRepositoryUrl,clickupSpaceId]
echo     ^);
echo     res.status^(201^).json^(rows[0]^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.patch^('/:id', authenticate, requireRole^('admin','manager'^), async ^(req, res, next^) =^> {
echo   const { projectName, description, status, managerId } = req.body;
echo   try {
echo     const { rows } = await pool.query^(
echo       'UPDATE projects SET project_name=COALESCE^($1,project_name^),description=COALESCE^($2,description^),status=COALESCE^($3,status^),manager_id=COALESCE^($4,manager_id^),updated_at=NOW^(^) WHERE id=$5 RETURNING *',
echo       [projectName,description,status,managerId,req.params.id]
echo     ^);
echo     if ^(!rows.length^) return res.status^(404^).json^({ error: 'Not found' }^);
echo     res.json^(rows[0]^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo module.exports = router;
) > timein-backend\src\routes\projects.js

:: ── src/routes/tasks.js ─────────────────────────────────────
(
echo const router = require^('express'^).Router^(^);
echo const pool   = require^('../config/db'^);
echo const { authenticate, requireRole } = require^('../middleware/auth'^);
echo.
echo router.get^('/', authenticate, async ^(req, res, next^) =^> {
echo   const { projectId, assignedUserId, status } = req.query;
echo   const conds = ['1=1'], params = [];
echo   if ^(projectId^)      { params.push^(projectId^);      conds.push^(`t.project_id=$${params.length}`^); }
echo   if ^(assignedUserId^) { params.push^(assignedUserId^); conds.push^(`t.assigned_user_id=$${params.length}`^); }
echo   if ^(status^)         { params.push^(status^);         conds.push^(`t.status=$${params.length}`^); }
echo   try {
echo     const { rows } = await pool.query^(
echo       `SELECT t.*,p.project_name,u.full_name AS assigned_user_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN users u ON u.id=t.assigned_user_id WHERE ${conds.join^(' AND '^)} ORDER BY t.created_at DESC`,
echo       params
echo     ^);
echo     res.json^(rows^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.post^('/', authenticate, requireRole^('admin','manager'^), async ^(req, res, next^) =^> {
echo   const { taskName,description,projectId,assignedUserId,priority,clickupTaskId,estimatedHours,dueDate } = req.body;
echo   if ^(!taskName ^|^| !projectId^) return res.status^(400^).json^({ error: 'taskName and projectId required' }^);
echo   try {
echo     const { rows } = await pool.query^(
echo       'INSERT INTO tasks ^(task_name,description,project_id,assigned_user_id,priority,clickup_task_id,estimated_hours,due_date^) VALUES ^($1,$2,$3,$4,$5,$6,$7,$8^) RETURNING *',
echo       [taskName,description,projectId,assignedUserId,priority^|^|'medium',clickupTaskId,estimatedHours,dueDate]
echo     ^);
echo     res.status^(201^).json^(rows[0]^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.patch^('/:id', authenticate, requireRole^('admin','manager'^), async ^(req, res, next^) =^> {
echo   const { taskName,status,assignedUserId,priority,estimatedHours } = req.body;
echo   try {
echo     const { rows } = await pool.query^(
echo       'UPDATE tasks SET task_name=COALESCE^($1,task_name^),status=COALESCE^($2,status^),assigned_user_id=COALESCE^($3,assigned_user_id^),priority=COALESCE^($4,priority^),estimated_hours=COALESCE^($5,estimated_hours^),updated_at=NOW^(^) WHERE id=$6 RETURNING *',
echo       [taskName,status,assignedUserId,priority,estimatedHours,req.params.id]
echo     ^);
echo     if ^(!rows.length^) return res.status^(404^).json^({ error: 'Not found' }^);
echo     res.json^(rows[0]^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo module.exports = router;
) > timein-backend\src\routes\tasks.js

echo [5/20] routes נוצרו

:: ── src/routes/timeEntries.js ───────────────────────────────
(
echo const router = require^('express'^).Router^(^);
echo const pool   = require^('../config/db'^);
echo const { authenticate, requireRole } = require^('../middleware/auth'^);
echo.
echo router.get^('/', authenticate, async ^(req, res, next^) =^> {
echo   const { userId,projectId,taskId,status,dateFrom,dateTo } = req.query;
echo   const conds = [], params = [];
echo   if ^(req.user.role==='employee'^) { params.push^(req.user.id^); conds.push^(`te.user_id=$${params.length}`^); }
echo   else if ^(userId^) { params.push^(userId^); conds.push^(`te.user_id=$${params.length}`^); }
echo   if ^(projectId^) { params.push^(projectId^); conds.push^(`te.project_id=$${params.length}`^); }
echo   if ^(taskId^)    { params.push^(taskId^);    conds.push^(`te.task_id=$${params.length}`^); }
echo   if ^(status^)    { params.push^(status^);    conds.push^(`te.status=$${params.length}`^); }
echo   if ^(dateFrom^)  { params.push^(dateFrom^);  conds.push^(`te.date>=$${params.length}`^); }
echo   if ^(dateTo^)    { params.push^(dateTo^);    conds.push^(`te.date<=$${params.length}`^); }
echo   const where = conds.length ? `WHERE ${conds.join^(' AND '^)}` : '';
echo   try {
echo     const { rows } = await pool.query^(
echo       `SELECT te.*,u.full_name AS user_name,p.project_name,t.task_name FROM time_entries te LEFT JOIN users u ON u.id=te.user_id LEFT JOIN projects p ON p.id=te.project_id LEFT JOIN tasks t ON t.id=te.task_id ${where} ORDER BY te.date DESC,te.created_at DESC`,
echo       params
echo     ^);
echo     res.json^(rows^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.post^('/', authenticate, async ^(req, res, next^) =^> {
echo   const { projectId,taskId,date,startTime,endTime,durationMinutes,workType,description,source,relatedCommitIds,relatedClickupTaskId } = req.body;
echo   if ^(!projectId ^|^| !date^) return res.status^(400^).json^({ error: 'projectId and date required' }^);
echo   let dur = durationMinutes;
echo   if ^(!dur ^&^& startTime ^&^& endTime^) {
echo     const [sh,sm]=startTime.split^(':'^).map^(Number^), [eh,em]=endTime.split^(':'^).map^(Number^);
echo     dur = ^(eh*60+em^)-^(sh*60+sm^);
echo   }
echo   if ^(!dur ^|^| dur^<=0^) return res.status^(400^).json^({ error: 'Duration must be positive' }^);
echo   try {
echo     const { rows } = await pool.query^(
echo       'INSERT INTO time_entries ^(user_id,project_id,task_id,date,start_time,end_time,duration_minutes,work_type,description,source,related_commit_ids,related_clickup_task_id^) VALUES ^($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12^) RETURNING *',
echo       [req.user.id,projectId,taskId^|^|null,date,startTime^|^|null,endTime^|^|null,dur,workType^|^|'development',description,source^|^|'manual',relatedCommitIds^|^|[],relatedClickupTaskId^|^|null]
echo     ^);
echo     res.status^(201^).json^(rows[0]^);
echo   } catch ^(err^) {
echo     if ^(err.message.includes^('overlap'^)^) return res.status^(409^).json^({ error: 'Time overlap detected' }^);
echo     next^(err^);
echo   }
echo }^);
echo.
echo router.patch^('/:id', authenticate, async ^(req, res, next^) =^> {
echo   const { projectId,taskId,date,startTime,endTime,durationMinutes,workType,description,relatedCommitIds } = req.body;
echo   let dur = durationMinutes;
echo   if ^(!dur ^&^& startTime ^&^& endTime^) {
echo     const [sh,sm]=startTime.split^(':'^).map^(Number^), [eh,em]=endTime.split^(':'^).map^(Number^);
echo     dur = ^(eh*60+em^)-^(sh*60+sm^);
echo   }
echo   try {
echo     const { rows } = await pool.query^(
echo       'UPDATE time_entries SET project_id=COALESCE^($1,project_id^),task_id=COALESCE^($2,task_id^),date=COALESCE^($3,date^),start_time=COALESCE^($4,start_time^),end_time=COALESCE^($5,end_time^),duration_minutes=COALESCE^($6,duration_minutes^),work_type=COALESCE^($7,work_type^),description=COALESCE^($8,description^),related_commit_ids=COALESCE^($9,related_commit_ids^),updated_at=NOW^(^) WHERE id=$10 RETURNING *',
echo       [projectId,taskId,date,startTime,endTime,dur,workType,description,relatedCommitIds,req.params.id]
echo     ^);
echo     if ^(!rows.length^) return res.status^(404^).json^({ error: 'Not found' }^);
echo     res.json^(rows[0]^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.patch^('/:id/submit', authenticate, async ^(req, res, next^) =^> {
echo   try {
echo     const { rows } = await pool.query^("UPDATE time_entries SET status='submitted',updated_at=NOW^(^) WHERE id=$1 AND user_id=$2 AND status='draft' RETURNING *", [req.params.id,req.user.id]^);
echo     if ^(!rows.length^) return res.status^(400^).json^({ error: 'Not found or not draft' }^);
echo     res.json^(rows[0]^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.patch^('/:id/approve', authenticate, requireRole^('manager','admin'^), async ^(req, res, next^) =^> {
echo   try {
echo     const { rows } = await pool.query^("UPDATE time_entries SET status='approved',approved_by=$1,approved_at=NOW^(^),updated_at=NOW^(^) WHERE id=$2 AND status='submitted' RETURNING *", [req.user.id,req.params.id]^);
echo     if ^(!rows.length^) return res.status^(400^).json^({ error: 'Not found or not submitted' }^);
echo     res.json^(rows[0]^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.patch^('/:id/reject', authenticate, requireRole^('manager','admin'^), async ^(req, res, next^) =^> {
echo   try {
echo     const { rows } = await pool.query^("UPDATE time_entries SET status='rejected',rejection_reason=$1,updated_at=NOW^(^) WHERE id=$2 AND status='submitted' RETURNING *", [req.body.reason^|^|null,req.params.id]^);
echo     if ^(!rows.length^) return res.status^(400^).json^({ error: 'Not found or not submitted' }^);
echo     res.json^(rows[0]^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.delete^('/:id', authenticate, async ^(req, res, next^) =^> {
echo   try {
echo     const { rows } = await pool.query^("DELETE FROM time_entries WHERE id=$1 AND user_id=$2 AND status='draft' RETURNING id", [req.params.id,req.user.id]^);
echo     if ^(!rows.length^) return res.status^(400^).json^({ error: 'Not found or not deletable' }^);
echo     res.json^({ deleted: rows[0].id }^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo module.exports = router;
) > timein-backend\src\routes\timeEntries.js

:: ── src/routes/reports.js ───────────────────────────────────
(
echo const router = require^('express'^).Router^(^);
echo const pool   = require^('../config/db'^);
echo const { authenticate, requireRole } = require^('../middleware/auth'^);
echo.
echo router.get^('/summary', authenticate, async ^(req, res, next^) =^> {
echo   try {
echo     const { rows } = await pool.query^(
echo       "SELECT SUM^(CASE WHEN date=CURRENT_DATE THEN duration_minutes ELSE 0 END^) AS today_minutes, SUM^(CASE WHEN date^>=date_trunc^('week',NOW^(^)^) THEN duration_minutes ELSE 0 END^) AS week_minutes, SUM^(CASE WHEN date^>=date_trunc^('month',NOW^(^)^) THEN duration_minutes ELSE 0 END^) AS month_minutes, COUNT^(CASE WHEN status='draft' THEN 1 END^) AS draft_count, COUNT^(CASE WHEN status='submitted' THEN 1 END^) AS pending_count FROM time_entries WHERE user_id=$1",
echo       [req.user.id]
echo     ^);
echo     res.json^(rows[0]^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.get^('/by-user', authenticate, requireRole^('manager','admin'^), async ^(req, res, next^) =^> {
echo   try {
echo     const { rows } = await pool.query^(
echo       "SELECT u.id,u.full_name,u.team,COUNT^(te.id^)::int AS entry_count,SUM^(te.duration_minutes^)::int AS total_minutes,ROUND^(SUM^(te.duration_minutes^)/60.0,2^) AS total_hours,COUNT^(DISTINCT te.project_id^)::int AS project_count FROM users u LEFT JOIN time_entries te ON te.user_id=u.id WHERE u.is_active=TRUE GROUP BY u.id,u.full_name,u.team ORDER BY total_minutes DESC NULLS LAST"
echo     ^);
echo     res.json^(rows^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.get^('/by-project', authenticate, requireRole^('manager','admin'^), async ^(req, res, next^) =^> {
echo   try {
echo     const { rows } = await pool.query^(
echo       "SELECT p.id,p.project_name,COUNT^(te.id^)::int AS entry_count,SUM^(te.duration_minutes^)::int AS total_minutes,ROUND^(SUM^(te.duration_minutes^)/60.0,2^) AS total_hours,COUNT^(DISTINCT te.user_id^)::int AS user_count FROM projects p LEFT JOIN time_entries te ON te.project_id=p.id GROUP BY p.id,p.project_name ORDER BY total_minutes DESC NULLS LAST"
echo     ^);
echo     res.json^(rows^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.get^('/by-task', authenticate, requireRole^('manager','admin'^), async ^(req, res, next^) =^> {
echo   try {
echo     const { rows } = await pool.query^(
echo       "SELECT t.id,t.task_name,t.estimated_hours,p.project_name,COUNT^(te.id^)::int AS entry_count,ROUND^(SUM^(te.duration_minutes^)/60.0,2^) AS total_hours,MAX^(te.date^) AS last_activity FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN time_entries te ON te.task_id=t.id GROUP BY t.id,t.task_name,t.estimated_hours,p.project_name ORDER BY total_hours DESC NULLS LAST"
echo     ^);
echo     res.json^(rows^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo.
echo router.get^('/anomalies', authenticate, requireRole^('manager','admin'^), async ^(req, res, next^) =^> {
echo   try {
echo     const [long, missing] = await Promise.all^([
echo       pool.query^("SELECT te.*,u.full_name,p.project_name FROM time_entries te JOIN users u ON u.id=te.user_id JOIN projects p ON p.id=te.project_id WHERE te.duration_minutes^>600 ORDER BY te.duration_minutes DESC LIMIT 20"^),
echo       pool.query^("SELECT u.id,u.full_name,u.team,MAX^(te.date^) AS last_entry_date FROM users u LEFT JOIN time_entries te ON te.user_id=u.id WHERE u.is_active=TRUE AND u.role='employee' GROUP BY u.id,u.full_name,u.team HAVING MAX^(te.date^)^<NOW^(^)-INTERVAL '7 days' OR MAX^(te.date^) IS NULL"^)
echo     ]^);
echo     res.json^({ longEntries: long.rows, missingActivity: missing.rows }^);
echo   } catch ^(err^) { next^(err^); }
echo }^);
echo module.exports = router;
) > timein-backend\src\routes\reports.js

:: ── src/routes/users.js ─────────────────────────────────────
(
echo const router = require^('express'^).Router^(^);
echo const pool   = require^('../config/db'^);
echo const { authenticate, requireRole } = require^('../middleware/auth'^);
echo router.get^('/', authenticate, requireRole^('manager','admin'^), async ^(req,res,next^) =^> {
echo   try { const {rows}=await pool.query^('SELECT id,full_name,email,role,team,is_active FROM users ORDER BY full_name'^); res.json^(rows^); } catch^(err^){next^(err^);}
echo }^);
echo router.patch^('/:id', authenticate, requireRole^('admin'^), async ^(req,res,next^) =^> {
echo   const {fullName,role,team,isActive}=req.body;
echo   try { const {rows}=await pool.query^('UPDATE users SET full_name=COALESCE^($1,full_name^),role=COALESCE^($2,role^),team=COALESCE^($3,team^),is_active=COALESCE^($4,is_active^),updated_at=NOW^(^) WHERE id=$5 RETURNING id,full_name,email,role,team,is_active',[fullName,role,team,isActive,req.params.id]^); if^(!rows.length^)return res.status^(404^).json^({error:'Not found'}^); res.json^(rows[0]^); } catch^(err^){next^(err^);}
echo }^);
echo module.exports = router;
) > timein-backend\src\routes\users.js

:: ── src/routes/integrations.js ──────────────────────────────
(
echo const router = require^('express'^).Router^(^);
echo const pool   = require^('../config/db'^);
echo const { authenticate } = require^('../middleware/auth'^);
echo router.get^('/commits', authenticate, async ^(req,res,next^) =^> {
echo   try { const {rows}=await pool.query^('SELECT gc.*,u.full_name FROM git_commits gc LEFT JOIN users u ON u.id=gc.linked_user_id ORDER BY gc.commit_date DESC LIMIT 100'^); res.json^(rows^); } catch^(err^){next^(err^);}
echo }^);
echo router.post^('/commits', authenticate, async ^(req,res,next^) =^> {
echo   const {repository,branch,commitHash,commitMessage,commitDate,linkedTaskId,linkedTimeEntryId}=req.body;
echo   if^(!commitHash^|^|!repository^)return res.status^(400^).json^({error:'commitHash and repository required'}^);
echo   try { const {rows}=await pool.query^('INSERT INTO git_commits ^(repository,branch,commit_hash,commit_message,commit_author_email,commit_date,linked_user_id,linked_task_id,linked_time_entry_id^) VALUES ^($1,$2,$3,$4,$5,$6,$7,$8,$9^) RETURNING *',[repository,branch,commitHash,commitMessage,req.user.email,commitDate^|^|new Date^(^),req.user.id,linkedTaskId^|^|null,linkedTimeEntryId^|^|null]^); res.status^(201^).json^(rows[0]^); } catch^(err^){next^(err^);}
echo }^);
echo router.get^('/status', authenticate, async ^(req,res,next^) =^> {
echo   try {
echo     const [c,cu]=await Promise.all^([pool.query^('SELECT COUNT^(*^) FROM git_commits'^),pool.query^('SELECT COUNT^(*^) FROM clickup_task_links'^)]^);
echo     res.json^({git:{status:'connected',count:+c.rows[0].count},clickup:{status:'connected',count:+cu.rows[0].count}}^);
echo   } catch^(err^){next^(err^);}
echo }^);
echo module.exports = router;
) > timein-backend\src\routes\integrations.js

echo [6/20] כל ה-routes נוצרו

:: ── src/app.js ──────────────────────────────────────────────
(
echo const express = require^('express'^);
echo const cors    = require^('cors'^);
echo const morgan  = require^('morgan'^);
echo require^('dotenv'^).config^(^);
echo const app = express^(^);
echo app.use^(cors^({ origin: process.env.FRONTEND_URL, credentials: true }^)^);
echo app.use^(express.json^(^)^);
echo app.use^(morgan^('dev'^)^);
echo app.use^('/api/auth',         require^('./routes/auth'^)^);
echo app.use^('/api/users',        require^('./routes/users'^)^);
echo app.use^('/api/projects',     require^('./routes/projects'^)^);
echo app.use^('/api/tasks',        require^('./routes/tasks'^)^);
echo app.use^('/api/time-entries', require^('./routes/timeEntries'^)^);
echo app.use^('/api/reports',      require^('./routes/reports'^)^);
echo app.use^('/api/integrations', require^('./routes/integrations'^)^);
echo app.get^('/api/health', ^(_, res^) =^> res.json^({ status: 'ok' }^)^);
echo app.use^(require^('./middleware/errorHandler'^)^);
echo module.exports = app;
) > timein-backend\src\app.js

:: ── src/server.js ───────────────────────────────────────────
(
echo const app  = require^('./app'^);
echo const pool = require^('./config/db'^);
echo const PORT = process.env.PORT ^|^| 4000;
echo pool.query^('SELECT 1'^)
echo   .then^(^(^) =^> { console.log^('Connected to PostgreSQL'^); app.listen^(PORT, ^(^) =^> console.log^(`Server on port ${PORT}`^)^); }^)
echo   .catch^(err =^> { console.error^('DB connection failed:', err.message^); process.exit^(1^); }^);
) > timein-backend\src\server.js

echo [7/20] app.js + server.js נוצרו

:: ════════════════════════════════════════════════════════════
:: FRONTEND FILES
:: ════════════════════════════════════════════════════════════

:: ── package.json ────────────────────────────────────────────
(
echo {
echo   "name": "timein-frontend",
echo   "version": "1.0.0",
echo   "dependencies": {
echo     "react": "^18.2.0",
echo     "react-dom": "^18.2.0",
echo     "react-router-dom": "^6.21.0",
echo     "react-scripts": "5.0.1",
echo     "axios": "^1.6.5",
echo     "recharts": "^2.10.0"
echo   },
echo   "scripts": {
echo     "start": "react-scripts start",
echo     "build": "react-scripts build"
echo   },
echo   "browserslist": {
echo     "production": ["^>0.2%%", "not dead", "not op_mini all"],
echo     "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
echo   }
echo }
) > timein-frontend\package.json

:: ── .env ────────────────────────────────────────────────────
(
echo REACT_APP_API_URL=http://localhost:4000/api
) > timein-frontend\.env

:: ── public/index.html ───────────────────────────────────────
mkdir timein-frontend\public
(
echo ^<!DOCTYPE html^>
echo ^<html lang="he" dir="rtl"^>
echo ^<head^>
echo   ^<meta charset="utf-8" /^>
echo   ^<meta name="viewport" content="width=device-width, initial-scale=1" /^>
echo   ^<title^>TimeIn^</title^>
echo ^</head^>
echo ^<body^>
echo   ^<div id="root"^>^</div^>
echo ^</body^>
echo ^</html^>
) > timein-frontend\public\index.html

echo [8/20] frontend package.json נוצר

:: ── src/index.js ────────────────────────────────────────────
(
echo import React from 'react';
echo import ReactDOM from 'react-dom/client';
echo import App from './App';
echo const root = ReactDOM.createRoot^(document.getElementById^('root'^)^);
echo root.render^(^<React.StrictMode^>^<App /^>^</React.StrictMode^>^);
) > timein-frontend\src\index.js

:: ── src/api/client.js ───────────────────────────────────────
(
echo import axios from 'axios';
echo const client = axios.create^({ baseURL: process.env.REACT_APP_API_URL ^|^| '/api' }^);
echo client.interceptors.request.use^(cfg =^> {
echo   const t = localStorage.getItem^('timein_token'^);
echo   if ^(t^) cfg.headers.Authorization = `Bearer ${t}`;
echo   return cfg;
echo }^);
echo client.interceptors.response.use^(
echo   res =^> res.data,
echo   err =^> {
echo     if ^(err.response?.status === 401^) { localStorage.removeItem^('timein_token'^); window.location.href='/login'; }
echo     return Promise.reject^(new Error^(err.response?.data?.error ^|^| 'Server error'^)^);
echo   }
echo ^);
echo export default client;
) > timein-frontend\src\api\client.js

:: ── src/api/auth.js ─────────────────────────────────────────
(
echo import client from './client';
echo export const authApi = {
echo   login:    ^(email, password^) =^> client.post^('/auth/login', { email, password }^),
echo   register: ^(data^)           =^> client.post^('/auth/register', data^),
echo   me:       ^(^)               =^> client.get^('/auth/me'^),
echo };
) > timein-frontend\src\api\auth.js

:: ── src/api/projects.js ─────────────────────────────────────
(
echo import client from './client';
echo export const projectsApi = {
echo   getAll: ^(^)       =^> client.get^('/projects'^),
echo   create: ^(data^)   =^> client.post^('/projects', data^),
echo   update: ^(id,data^) =^> client.patch^(`/projects/${id}`, data^),
echo };
) > timein-frontend\src\api\projects.js

:: ── src/api/tasks.js ────────────────────────────────────────
(
echo import client from './client';
echo export const tasksApi = {
echo   getAll: ^(params={}^) =^> client.get^('/tasks', { params }^),
echo   create: ^(data^)      =^> client.post^('/tasks', data^),
echo   update: ^(id,data^)   =^> client.patch^(`/tasks/${id}`, data^),
echo };
) > timein-frontend\src\api\tasks.js

:: ── src/api/timeEntries.js ──────────────────────────────────
(
echo import client from './client';
echo export const timeEntriesApi = {
echo   getAll:  ^(params={}^) =^> client.get^('/time-entries', { params }^),
echo   create:  ^(data^)      =^> client.post^('/time-entries', data^),
echo   update:  ^(id,data^)   =^> client.patch^(`/time-entries/${id}`, data^),
echo   submit:  ^(id^)        =^> client.patch^(`/time-entries/${id}/submit`^),
echo   approve: ^(id^)        =^> client.patch^(`/time-entries/${id}/approve`^),
echo   reject:  ^(id,reason^) =^> client.patch^(`/time-entries/${id}/reject`, { reason }^),
echo   delete:  ^(id^)        =^> client.delete^(`/time-entries/${id}`^),
echo };
) > timein-frontend\src\api\timeEntries.js

:: ── src/api/reports.js ──────────────────────────────────────
(
echo import client from './client';
echo export const reportsApi = {
echo   summary:   ^(^)          =^> client.get^('/reports/summary'^),
echo   byUser:    ^(params={}^) =^> client.get^('/reports/by-user',    { params }^),
echo   byProject: ^(params={}^) =^> client.get^('/reports/by-project', { params }^),
echo   byTask:    ^(params={}^) =^> client.get^('/reports/by-task',    { params }^),
echo   anomalies: ^(^)          =^> client.get^('/reports/anomalies'^),
echo };
) > timein-frontend\src\api\reports.js

:: ── src/api/integrations.js ─────────────────────────────────
(
echo import client from './client';
echo export const integrationsApi = {
echo   getCommits:  ^(params={}^) =^> client.get^('/integrations/commits',  { params }^),
echo   saveCommit:  ^(data^)      =^> client.post^('/integrations/commits', data^),
echo   getStatus:   ^(^)          =^> client.get^('/integrations/status'^),
echo };
) > timein-frontend\src\api\integrations.js

echo [9/20] API layer נוצר

:: ── src/context/AuthContext.jsx ─────────────────────────────
(
echo import { createContext, useContext, useState, useEffect, useCallback } from 'react';
echo import { authApi } from '../api/auth';
echo const AuthContext = createContext^(null^);
echo export function AuthProvider^({ children }^) {
echo   const [user, setUser]       = useState^(null^);
echo   const [loading, setLoading] = useState^(true^);
echo   useEffect^(^(^) =^> {
echo     const token = localStorage.getItem^('timein_token'^);
echo     if ^(!token^) { setLoading^(false^); return; }
echo     authApi.me^(^).then^(setUser^).catch^(^(^) =^> localStorage.removeItem^('timein_token'^)^).finally^(^(^) =^> setLoading^(false^)^);
echo   }, []^);
echo   const login = useCallback^(async ^(email, password^) =^> {
echo     const { token, user } = await authApi.login^(email, password^);
echo     localStorage.setItem^('timein_token', token^);
echo     setUser^(user^); return user;
echo   }, []^);
echo   const logout = useCallback^(^(^) =^> { localStorage.removeItem^('timein_token'^); setUser^(null^); }, []^);
echo   return ^<AuthContext.Provider value={{ user, loading, login, logout }}^>{children}^</AuthContext.Provider^>;
echo }
echo export const useAuth = ^(^) =^> useContext^(AuthContext^);
) > timein-frontend\src\context\AuthContext.jsx

:: ── src/context/ToastContext.jsx ────────────────────────────
(
echo import { createContext, useContext, useState, useCallback } from 'react';
echo const ToastContext = createContext^(null^);
echo export function ToastProvider^({ children }^) {
echo   const [toasts, setToasts] = useState^([]^);
echo   const addToast = useCallback^(^(msg, type='success'^) =^> {
echo     const id = Date.now^(^);
echo     setToasts^(t =^> [...t, { id, msg, type }]^);
echo     setTimeout^(^(^) =^> setToasts^(t =^> t.filter^(x =^> x.id !== id^)^), 3500^);
echo   }, []^);
echo   return ^(
echo     ^<ToastContext.Provider value={{ addToast }}^>
echo       {children}
echo       ^<div style={{ position:'fixed',top:16,left:'50%%',transform:'translateX^(-50%%^)',zIndex:9999,display:'flex',flexDirection:'column',gap:8 }}^>
echo         {toasts.map^(t =^> ^(
echo           ^<div key={t.id} style={{ background:t.type==='error'?'#ef4444':t.type==='warning'?'#f59e0b':'#10b981',color:'#fff',padding:'10px 20px',borderRadius:8,fontSize:13,fontWeight:500 }}^>{t.msg}^</div^>
echo         ^)^)}
echo       ^</div^>
echo     ^</ToastContext.Provider^>
echo   ^);
echo }
echo export const useToast = ^(^) =^> useContext^(ToastContext^);
) > timein-frontend\src\context\ToastContext.jsx

echo [10/20] Context נוצר

:: ── src/hooks/useTimeEntries.js ─────────────────────────────
(
echo import { useState, useEffect, useCallback } from 'react';
echo import { timeEntriesApi } from '../api/timeEntries';
echo import { useToast } from '../context/ToastContext';
echo export function useTimeEntries^(filters={}^) {
echo   const [entries, setEntries]   = useState^([]^);
echo   const [loading, setLoading]   = useState^(false^);
echo   const { addToast }            = useToast^(^);
echo   const key = JSON.stringify^(filters^);
echo   const fetch = useCallback^(async ^(^) =^> {
echo     setLoading^(true^);
echo     try { const d = await timeEntriesApi.getAll^(filters^); setEntries^(d^); }
echo     catch ^(err^) { addToast^(err.message,'error'^); }
echo     finally { setLoading^(false^); }
echo   // eslint-disable-next-line
echo   }, [key]^);
echo   useEffect^(^(^) =^> { fetch^(^); }, [fetch]^);
echo   const create  = async ^(data^)       =^> { const e=await timeEntriesApi.create^(data^);          setEntries^(p=^>[e,...p]^);                       addToast^('נשמר כטיוטה'^);            return e; };
echo   const update  = async ^(id,data^)    =^> { const e=await timeEntriesApi.update^(id,data^);       setEntries^(p=^>p.map^(x=^>x.id===id?e:x^)^);    addToast^('עודכן בהצלחה'^);           return e; };
echo   const submit  = async ^(id^)         =^> { const e=await timeEntriesApi.submit^(id^);            setEntries^(p=^>p.map^(x=^>x.id===id?e:x^)^);    addToast^('הוגש לאישור'^);                      };
echo   const approve = async ^(id^)         =^> { const e=await timeEntriesApi.approve^(id^);           setEntries^(p=^>p.map^(x=^>x.id===id?e:x^)^);    addToast^('אושר'^);                              };
echo   const reject  = async ^(id,reason^)  =^> { const e=await timeEntriesApi.reject^(id,reason^);    setEntries^(p=^>p.map^(x=^>x.id===id?e:x^)^);    addToast^('הוחזר לבדיקה','warning'^);            };
echo   const remove  = async ^(id^)         =^> { await timeEntriesApi.delete^(id^);                    setEntries^(p=^>p.filter^(x=^>x.id!==id^)^);     addToast^('נמחק'^);                              };
echo   return { entries, loading, refetch:fetch, create, update, submit, approve, reject, remove };
echo }
) > timein-frontend\src\hooks\useTimeEntries.js

:: ── src/hooks/useProjects.js ────────────────────────────────
(
echo import { useState, useEffect } from 'react';
echo import { projectsApi } from '../api/projects';
echo export function useProjects^(^) {
echo   const [projects, setProjects] = useState^([]^);
echo   const [loading,  setLoading]  = useState^(false^);
echo   useEffect^(^(^) =^> {
echo     setLoading^(true^);
echo     projectsApi.getAll^(^).then^(setProjects^).finally^(^(^) =^> setLoading^(false^)^);
echo   }, []^);
echo   const create = async ^(data^)    =^> { const p=await projectsApi.create^(data^);    setProjects^(prev=^>[...prev,p]^);                  return p; };
echo   const update = async ^(id,data^) =^> { const p=await projectsApi.update^(id,data^); setProjects^(prev=^>prev.map^(x=^>x.id===id?p:x^)^); return p; };
echo   return { projects, loading, create, update };
echo }
) > timein-frontend\src\hooks\useProjects.js

:: ── src/hooks/useTasks.js ───────────────────────────────────
(
echo import { useState, useEffect, useCallback } from 'react';
echo import { tasksApi } from '../api/tasks';
echo export function useTasks^(filters={}^) {
echo   const [tasks,   setTasks]   = useState^([]^);
echo   const [loading, setLoading] = useState^(false^);
echo   const key = JSON.stringify^(filters^);
echo   const fetch = useCallback^(^(^) =^> {
echo     setLoading^(true^);
echo     tasksApi.getAll^(filters^).then^(setTasks^).finally^(^(^) =^> setLoading^(false^)^);
echo   // eslint-disable-next-line
echo   }, [key]^);
echo   useEffect^(^(^) =^> { fetch^(^); }, [fetch]^);
echo   const create = async ^(data^)    =^> { const t=await tasksApi.create^(data^);    setTasks^(p=^>[t,...p]^);                  return t; };
echo   const update = async ^(id,data^) =^> { const t=await tasksApi.update^(id,data^); setTasks^(p=^>p.map^(x=^>x.id===id?t:x^)^); return t; };
echo   return { tasks, loading, refetch:fetch, create, update };
echo }
) > timein-frontend\src\hooks\useTasks.js

:: ── src/hooks/useReports.js ─────────────────────────────────
(
echo import { useState, useCallback } from 'react';
echo import { reportsApi } from '../api/reports';
echo export function useReports^(^) {
echo   const [data,    setData]    = useState^(null^);
echo   const [loading, setLoading] = useState^(false^);
echo   const [error,   setError]   = useState^(null^);
echo   const fetch = useCallback^(async ^(type, params={}^) =^> {
echo     setLoading^(true^); setError^(null^);
echo     try { const r=await reportsApi[type]^(params^); setData^(r^); return r; }
echo     catch ^(err^) { setError^(err.message^); }
echo     finally { setLoading^(false^); }
echo   }, []^);
echo   return { data, loading, error, fetch };
echo }
) > timein-frontend\src\hooks\useReports.js

echo [11/20] Hooks נוצרו

:: ── src/components/common/Card.jsx ──────────────────────────
(
echo export default function Card^({ children, style={} }^) {
echo   return ^<div style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px 20px',...style }}^>{children}^</div^>;
echo }
) > timein-frontend\src\components\common\Card.jsx

:: ── src/components/common/Spinner.jsx ───────────────────────
(
echo export default function Spinner^({ fullPage }^) {
echo   const w = fullPage ? { position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba^(255,255,255,0.8^)',zIndex:999 } : { display:'flex',justifyContent:'center',padding:32 };
echo   return ^<div style={w}^>^<div style={{ width:28,height:28,border:'3px solid #e2e8f0',borderTop:'3px solid #6366f1',borderRadius:'50%%',animation:'spin 0.8s linear infinite' }} /^>^<style^>{`@keyframes spin { to { transform: rotate(360deg); } }`}^</style^>^</div^>;
echo }
) > timein-frontend\src\components\common\Spinner.jsx

:: ── src/components/common/Badge.jsx ─────────────────────────
(
echo const M = { draft:['טיוטה','#f1f5f9','#64748b'], submitted:['הוגש','#dbeafe','#1d4ed8'], approved:['אושר','#d1fae5','#065f46'], rejected:['נדחה','#fee2e2','#991b1b'] };
echo export default function Badge^({ status }^) {
echo   const [l,bg,c] = M[status]^|^|['?','#f1f5f9','#64748b'];
echo   return ^<span style={{ fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:20,background:bg,color:c,whiteSpace:'nowrap' }}^>{l}^</span^>;
echo }
) > timein-frontend\src\components\common\Badge.jsx

:: ── src/components/common/Avatar.jsx ────────────────────────
(
echo export default function Avatar^({ name, size=32 }^) {
echo   const ini = name?.split^(' '^).map^(w=^>w[0]^).join^(''^).slice^(0,2^)^|^|'??';
echo   return ^<div style={{ width:size,height:size,borderRadius:'50%%',background:'#e0e7ff',color:'#4f46e5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.35,fontWeight:500,flexShrink:0 }}^>{ini}^</div^>;
echo }
) > timein-frontend\src\components\common\Avatar.jsx

echo [12/20] Common components נוצרו

:: ── src/components/layout/Sidebar.jsx ───────────────────────
(
echo import { NavLink } from 'react-router-dom';
echo import { useAuth } from '../../context/AuthContext';
echo import Avatar from '../common/Avatar';
echo const NAV = [
echo   { to:'/',             label:'דאשבורד',     icon:'⊞', roles:['employee','manager','admin'] },
echo   { to:'/report',       label:'דיווח שעות',  icon:'+', roles:['employee','manager','admin'] },
echo   { to:'/my-entries',   label:'הדיווחים שלי',icon:'☰', roles:['employee','manager','admin'] },
echo   { to:'/management',   label:'ניהול',        icon:'◈', roles:['manager','admin'] },
echo   { to:'/admin',        label:'אדמין',        icon:'⚙', roles:['admin'] },
echo   { to:'/integrations', label:'אינטגרציות',   icon:'⇄', roles:['employee','manager','admin'] },
echo ];
echo export default function Sidebar^(^) {
echo   const { user, logout } = useAuth^(^);
echo   return ^(
echo     ^<div dir="rtl" style={{ width:200,background:'#fff',borderLeft:'1px solid #e2e8f0',display:'flex',flexDirection:'column',flexShrink:0 }}^>
echo       ^<div style={{ padding:'20px 16px',borderBottom:'1px solid #f1f5f9' }}^>
echo         ^<div style={{ fontSize:20,fontWeight:700,color:'#6366f1' }}^>TimeIn^</div^>
echo         ^<div style={{ fontSize:10,color:'#94a3b8',marginTop:2 }}^>ניהול שעות עבודה^</div^>
echo       ^</div^>
echo       ^<nav style={{ padding:8,flex:1 }}^>
echo         {NAV.filter^(n=^>n.roles.includes^(user?.role^)^).map^(n=^>^(
echo           ^<NavLink key={n.to} to={n.to} end={n.to==='/'} style={^({ isActive }^)=^>^({ display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:8,cursor:'pointer',marginBottom:2,textDecoration:'none',background:isActive?'#e0e7ff':'transparent',color:isActive?'#4f46e5':'#64748b',fontSize:13,fontWeight:isActive?500:400 }^)}^>
echo             ^<span style={{ fontSize:14 }}^>{n.icon}^</span^>{n.label}
echo           ^</NavLink^>
echo         ^)^)}
echo       ^</nav^>
echo       ^<div style={{ padding:12,borderTop:'1px solid #f1f5f9' }}^>
echo         ^<div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}^>
echo           ^<Avatar name={user?.full_name} size={28} /^>
echo           ^<div^>^<div style={{ fontSize:12,fontWeight:500,color:'#334155' }}^>{user?.full_name}^</div^>^<div style={{ fontSize:10,color:'#94a3b8' }}^>{user?.role}^</div^>^</div^>
echo         ^</div^>
echo         ^<button onClick={logout} style={{ width:'100%%',padding:7,borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',fontSize:12,cursor:'pointer' }}^>יציאה^</button^>
echo       ^</div^>
echo     ^</div^>
echo   ^);
echo }
) > timein-frontend\src\components\layout\Sidebar.jsx

echo [13/20] Sidebar נוצר

:: ── src/pages/LoginPage.jsx ─────────────────────────────────
(
echo import { useState } from 'react';
echo import { useNavigate } from 'react-router-dom';
echo import { useAuth } from '../context/AuthContext';
echo import { useToast } from '../context/ToastContext';
echo export default function LoginPage^(^) {
echo   const [email,setEmail]=useState^(''^); const [password,setPassword]=useState^(''^); const [loading,setLoading]=useState^(false^);
echo   const { login }=useAuth^(^); const { addToast }=useToast^(^); const navigate=useNavigate^(^);
echo   const handleSubmit = async ^(e^) =^> {
echo     e.preventDefault^(^);
echo     if^(!email^|^|!password^){ addToast^('נא למלא אימייל וסיסמה','error'^); return; }
echo     setLoading^(true^);
echo     try { await login^(email,password^); navigate^('/'^); }
echo     catch^(err^){ addToast^(err.message,'error'^); }
echo     finally{ setLoading^(false^); }
echo   };
echo   return ^(
echo     ^<div dir="rtl" style={{ minHeight:'100vh',background:'linear-gradient^(135deg,#6366f1,#8b5cf6^)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif' }}^>
echo       ^<div style={{ background:'#fff',borderRadius:16,padding:'40px 36px',width:340,boxShadow:'0 20px 60px rgba^(0,0,0,0.15^)' }}^>
echo         ^<div style={{ textAlign:'center',marginBottom:32 }}^>
echo           ^<h1 style={{ fontSize:32,fontWeight:700,color:'#6366f1',margin:0 }}^>TimeIn^</h1^>
echo           ^<p style={{ color:'#94a3b8',fontSize:13,margin:'4px 0 0' }}^>מערכת ניהול שעות עבודה^</p^>
echo         ^</div^>
echo         ^<form onSubmit={handleSubmit} style={{ display:'flex',flexDirection:'column',gap:14 }}^>
echo           ^<div^>^<label style={{ fontSize:12,color:'#64748b',fontWeight:500 }}^>אימייל^</label^>^<input type="email" value={email} onChange={e=^>setEmail^(e.target.value^)} style={{ width:'100%%',marginTop:4,padding:'9px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:14,boxSizing:'border-box' }} /^>^</div^>
echo           ^<div^>^<label style={{ fontSize:12,color:'#64748b',fontWeight:500 }}^>סיסמה^</label^>^<input type="password" value={password} onChange={e=^>setPassword^(e.target.value^)} style={{ width:'100%%',marginTop:4,padding:'9px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:14,boxSizing:'border-box' }} /^>^</div^>
echo           ^<button type="submit" disabled={loading} style={{ marginTop:8,padding:10,borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:14,fontWeight:500,cursor:'pointer',opacity:loading?0.7:1 }}^>{loading?'מתחבר...':'כניסה'}^</button^>
echo         ^</form^>
echo       ^</div^>
echo     ^</div^>
echo   ^);
echo }
) > timein-frontend\src\pages\LoginPage.jsx

echo [14/20] LoginPage נוצר

:: ── src/pages/DashboardPage.jsx ─────────────────────────────
(
echo import { useEffect, useState } from 'react';
echo import { useNavigate } from 'react-router-dom';
echo import { useAuth } from '../context/AuthContext';
echo import { useTimeEntries } from '../hooks/useTimeEntries';
echo import { reportsApi } from '../api/reports';
echo import Card from '../components/common/Card';
echo import Badge from '../components/common/Badge';
echo import Spinner from '../components/common/Spinner';
echo const fmt=m=>`${Math.floor^(m/60^)}:${String^(m%%60^).padStart^(2,'0'^)}`;
echo export default function DashboardPage^(^) {
echo   const { user }=useAuth^(^); const navigate=useNavigate^(^);
echo   const { entries,loading }=useTimeEntries^(^);
echo   const [summary,setSummary]=useState^(null^);
echo   useEffect^(^(^)=^>{ reportsApi.summary^(^).then^(setSummary^).catch^(^(^)=^>{}^); },[]);
echo   return ^(
echo     ^<div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}^>
echo       ^<div style={{ marginBottom:20 }}^>
echo         ^<h2 style={{ fontSize:20,fontWeight:600,margin:0,color:'#1e293b' }}^>שלום, {user?.full_name?.split^(' '^)[0]} ^</h2^>
echo         ^<p style={{ color:'#94a3b8',fontSize:13,marginTop:4 }}^>{new Date^(^).toLocaleDateString^('he-IL',{weekday:'long',year:'numeric',month:'long',day:'numeric'}^)}^</p^>
echo       ^</div^>
echo       ^<div style={{ display:'flex',gap:12,marginBottom:20 }}^>
echo         {[['היום',summary?.today_minutes,'#6366f1'],['השבוע',summary?.week_minutes,'#3b82f6'],['החודש',summary?.month_minutes,'#10b981'],['טיוטות',summary?.draft_count,'#f59e0b']].map^(([l,v,c])=^>^(
echo           ^<Card key={l} style={{ flex:1 }}^>
echo             ^<div style={{ fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em' }}^>{l}^</div^>
echo             ^<div style={{ fontSize:24,fontWeight:600,color:c,margin:'4px 0' }}^>{v!=null?^(l==='טיוטות'?v:fmt^(+v^)^):'—'}^</div^>
echo           ^</Card^>
echo         ^)^)}
echo       ^</div^>
echo       ^<Card^>
echo         ^<div style={{ fontSize:13,fontWeight:500,color:'#64748b',marginBottom:12 }}^>דיווחים אחרונים^</div^>
echo         {loading^&^&^<Spinner/^>}
echo         {entries.slice^(0,5^).map^(e=^>^(
echo           ^<div key={e.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}^>
echo             ^<span style={{ color:'#94a3b8',minWidth:80 }}^>{e.date}^</span^>
echo             ^<span style={{ flex:1,color:'#334155',fontWeight:500 }}^>{e.project_name}^</span^>
echo             ^<span style={{ color:'#64748b' }}^>{e.description}^</span^>
echo             ^<span style={{ fontWeight:600,color:'#6366f1' }}^>{fmt^(e.duration_minutes^)}^</span^>
echo             ^<Badge status={e.status}/^>
echo           ^</div^>
echo         ^)^)}
echo         ^<button onClick={^(^)=^>navigate^('/report'^)} style={{ marginTop:12,width:'100%%',padding:8,borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer' }}^>+ דיווח חדש^</button^>
echo       ^</Card^>
echo     ^</div^>
echo   ^);
echo }
) > timein-frontend\src\pages\DashboardPage.jsx

echo [15/20] DashboardPage נוצר

:: ── src/pages/ReportPage.jsx ────────────────────────────────
(
echo import { useState, useEffect } from 'react';
echo import { useParams, useNavigate } from 'react-router-dom';
echo import { useProjects } from '../hooks/useProjects';
echo import { useTasks } from '../hooks/useTasks';
echo import { useTimeEntries } from '../hooks/useTimeEntries';
echo import { useToast } from '../context/ToastContext';
echo import Card from '../components/common/Card';
echo const today=new Date^(^).toISOString^(^).slice^(0,10^);
echo export default function ReportPage^(^) {
echo   const { id }=useParams^(^); const navigate=useNavigate^(^); const { addToast }=useToast^(^);
echo   const { projects }=useProjects^(^);
echo   const { entries,create,update }=useTimeEntries^(^);
echo   const [form,setForm]=useState^({ projectId:'',taskId:'',date:today,startTime:'',endTime:'',durationMinutes:'',workType:'development',description:'',commitHash:'',clickUpTaskId:'' }^);
echo   const [saving,setSaving]=useState^(false^);
echo   const { tasks }=useTasks^({ projectId:form.projectId^|^|undefined }^);
echo   useEffect^(^(^)=^>{ if^(!id^)return; const e=entries.find^(x=^>x.id===+id^); if^(!e^)return; setForm^({ projectId:String^(e.project_id^),taskId:String^(e.task_id^|^|''^),date:e.date,startTime:e.start_time?.slice^(0,5^)^|^|'',endTime:e.end_time?.slice^(0,5^)^|^|'',durationMinutes:String^(e.duration_minutes^),workType:e.work_type^|^|'development',description:e.description^|^|'',commitHash:e.related_commit_ids?.[0]^|^|'',clickUpTaskId:e.related_clickup_task_id^|^|'' }^); },[id,entries]);
echo   const set=f=^>e=^>setForm^(p=^>^({...p,[f]:e.target.value}^)^);
echo   const inp={ border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 10px',fontSize:13,width:'100%%',boxSizing:'border-box',background:'#fff' };
echo   const handleSave=async^(^)=^>{
echo     if^(!form.projectId^|^|!form.date^){ addToast^('חובה לבחור פרויקט ותאריך','error'^); return; }
echo     setSaving^(true^);
echo     try {
echo       const payload={ projectId:+form.projectId,taskId:form.taskId?+form.taskId:null,date:form.date,startTime:form.startTime^|^|null,endTime:form.endTime^|^|null,durationMinutes:form.durationMinutes?+form.durationMinutes:null,workType:form.workType,description:form.description,relatedCommitIds:form.commitHash?[form.commitHash]:[],relatedClickupTaskId:form.clickUpTaskId^|^|null };
echo       if^(id^) await update^(+id,payload^); else await create^(payload^);
echo       navigate^('/my-entries'^);
echo     } catch^(err^){ addToast^(err.message,'error'^); } finally{ setSaving^(false^); }
echo   };
echo   return ^(
echo     ^<div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}^>
echo       ^<h2 style={{ fontSize:18,fontWeight:600,marginBottom:20,color:'#1e293b' }}^>{id?'עריכת דיווח':'דיווח שעות'}^</h2^>
echo       ^<Card style={{ maxWidth:560 }}^>
echo         ^<div style={{ display:'flex',flexDirection:'column',gap:14 }}^>
echo           ^<div^>^<label style={{ fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 }}^>פרויקט *^</label^>^<select value={form.projectId} onChange={e=^>setForm^(p=^>^({...p,projectId:e.target.value,taskId:''}^)^)} style={inp}^>^<option value=""^>בחר פרויקט^</option^>{projects.map^(p=^>^<option key={p.id} value={p.id}^>{p.project_name}^</option^>^)}^</select^>^</div^>
echo           ^<div^>^<label style={{ fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 }}^>משימה^</label^>^<select value={form.taskId} onChange={set^('taskId'^)} style={inp}^>^<option value=""^>בחר משימה^</option^>{tasks.map^(t=^>^<option key={t.id} value={t.id}^>{t.task_name}^</option^>^)}^</select^>^</div^>
echo           ^<div^>^<label style={{ fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 }}^>תאריך *^</label^>^<input type="date" value={form.date} onChange={set^('date'^)} style={inp}/^>^</div^>
echo           ^<div style={{ display:'flex',gap:10 }}^>^<div style={{ flex:1 }}^>^<label style={{ fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 }}^>שעת התחלה^</label^>^<input type="time" value={form.startTime} onChange={set^('startTime'^)} style={inp}/^>^</div^>^<div style={{ flex:1 }}^>^<label style={{ fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 }}^>שעת סיום^</label^>^<input type="time" value={form.endTime} onChange={set^('endTime'^)} style={inp}/^>^</div^>^</div^>
echo           ^<div^>^<label style={{ fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 }}^>או משך דקות^</label^>^<input type="number" min="1" value={form.durationMinutes} onChange={set^('durationMinutes'^)} placeholder="90" style={inp}/^>^</div^>
echo           ^<div^>^<label style={{ fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 }}^>סוג עבודה^</label^>^<select value={form.workType} onChange={set^('workType'^)} style={inp}^>{[['development','פיתוח'],['design','עיצוב'],['review','ריביו'],['devops','DevOps'],['meeting','פגישה'],['qa','QA'],['other','אחר']].map^(([v,l])=^>^<option key={v} value={v}^>{l}^</option^>^)}^</select^>^</div^>
echo           ^<div^>^<label style={{ fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 }}^>תיאור^</label^>^<textarea value={form.description} onChange={set^('description'^)} rows={3} placeholder="מה עשית?" style={{...inp,resize:'vertical',fontFamily:'inherit'}}/^>^</div^>
echo           ^<div style={{ display:'flex',gap:10 }}^>^<div style={{ flex:1 }}^>^<label style={{ fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 }}^>Git Commit Hash^</label^>^<input value={form.commitHash} onChange={set^('commitHash'^)} placeholder="abc123" style={inp}/^>^</div^>^<div style={{ flex:1 }}^>^<label style={{ fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 }}^>ClickUp Task ID^</label^>^<input value={form.clickUpTaskId} onChange={set^('clickUpTaskId'^)} placeholder="CU-T001" style={inp}/^>^</div^>^</div^>
echo           ^<div style={{ display:'flex',gap:10 }}^>
echo             ^<button onClick={handleSave} disabled={saving} style={{ flex:1,padding:10,borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:14,fontWeight:500,cursor:'pointer',opacity:saving?0.7:1 }}^>{saving?'שומר...':id?'עדכן':'שמור כטיוטה'}^</button^>
echo             ^<button onClick={^(^)=^>navigate^('/my-entries'^)} style={{ padding:'10px 18px',borderRadius:8,background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',fontSize:14,cursor:'pointer' }}^>בטל^</button^>
echo           ^</div^>
echo         ^</div^>
echo       ^</Card^>
echo     ^</div^>
echo   ^);
echo }
) > timein-frontend\src\pages\ReportPage.jsx

echo [16/20] ReportPage נוצר

:: ── src/pages/MyEntriesPage.jsx ─────────────────────────────
(
echo import { useState } from 'react';
echo import { useNavigate } from 'react-router-dom';
echo import { useTimeEntries } from '../hooks/useTimeEntries';
echo import { useProjects } from '../hooks/useProjects';
echo import { useToast } from '../context/ToastContext';
echo import Card from '../components/common/Card';
echo import Badge from '../components/common/Badge';
echo import Spinner from '../components/common/Spinner';
echo const fmt=m=>`${Math.floor^(m/60^)}:${String^(m%%60^).padStart^(2,'0'^)}`;
echo export default function MyEntriesPage^(^) {
echo   const navigate=useNavigate^(^); const { addToast }=useToast^(^); const { projects }=useProjects^(^);
echo   const [f,setF]=useState^({ projectId:'',status:'',date:'' }^);
echo   const { entries,loading,submit,remove }=useTimeEntries^(Object.fromEntries^(Object.entries^(f^).filter^(([,v])=^>v^)^)^);
echo   const sel={ border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 10px',fontSize:12,background:'#fff' };
echo   return ^(
echo     ^<div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}^>
echo       ^<div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}^>
echo         ^<h2 style={{ fontSize:18,fontWeight:600,margin:0,color:'#1e293b' }}^>הדיווחים שלי^</h2^>
echo         ^<button onClick={^(^)=^>navigate^('/report'^)} style={{ padding:'7px 16px',borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer' }}^>+ דיווח חדש^</button^>
echo       ^</div^>
echo       ^<Card style={{ marginBottom:14 }}^>
echo         ^<div style={{ display:'flex',gap:10,flexWrap:'wrap' }}^>
echo           ^<select value={f.projectId} onChange={e=^>setF^(p=^>^({...p,projectId:e.target.value}^)^)} style={sel}^>^<option value=""^>כל הפרויקטים^</option^>{projects.map^(p=^>^<option key={p.id} value={p.id}^>{p.project_name}^</option^>^)}^</select^>
echo           ^<select value={f.status}    onChange={e=^>setF^(p=^>^({...p,status:e.target.value}^)^)} style={sel}^>^<option value=""^>כל הסטטוסים^</option^>^<option value="draft"^>טיוטה^</option^>^<option value="submitted"^>הוגש^</option^>^<option value="approved"^>אושר^</option^>^<option value="rejected"^>נדחה^</option^>^</select^>
echo           ^<input type="date" value={f.date} onChange={e=^>setF^(p=^>^({...p,date:e.target.value}^)^)} style={sel}/^>
echo           ^<button onClick={^(^)=^>setF^({ projectId:'',status:'',date:'' }^)} style={{ padding:'7px 12px',borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',fontSize:12,cursor:'pointer' }}^>נקה^</button^>
echo         ^</div^>
echo       ^</Card^>
echo       ^<Card^>
echo         {loading^&^&^<Spinner/^>}
echo         {!loading^&^&!entries.length^&^&^<p style={{ textAlign:'center',color:'#94a3b8',padding:40 }}^>אין דיווחים^</p^>}
echo         {entries.map^(e=^>^(
echo           ^<div key={e.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'11px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}^>
echo             ^<span style={{ color:'#94a3b8',minWidth:80 }}^>{e.date}^</span^>
echo             ^<div style={{ flex:1 }}^>^<div style={{ fontWeight:500,color:'#1e293b' }}^>{e.project_name}^</div^>^<div style={{ color:'#64748b' }}^>{e.task_name?`${e.task_name} · `:''}{e.description}^</div^>^</div^>
echo             ^<span style={{ fontWeight:600,color:'#6366f1',minWidth:48 }}^>{fmt^(e.duration_minutes^)}^</span^>
echo             ^<Badge status={e.status}/^>
echo             ^<div style={{ display:'flex',gap:5 }}^>
echo               {e.status==='draft'^&^&^<^>^<button onClick={^(^)=^>submit^(e.id^).catch^(err=^>addToast^(err.message,'error'^)^)} style={{ padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',fontSize:11,cursor:'pointer' }}^>הגש^</button^>^<button onClick={^(^)=^>navigate^(`/report/${e.id}`^)} style={{ padding:'4px 8px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',fontSize:11,cursor:'pointer' }}^>✏^</button^>^<button onClick={^(^)=^>{if^(window.confirm^('למחוק?'^)^)remove^(e.id^);}} style={{ padding:'4px 8px',borderRadius:6,border:'none',background:'#fee2e2',color:'#dc2626',fontSize:11,cursor:'pointer' }}^>✕^</button^>^<^/>}
echo               {e.status==='rejected'^&^&^<button onClick={^(^)=^>navigate^(`/report/${e.id}`^)} style={{ padding:'4px 10px',borderRadius:6,border:'1px solid #fca5a5',color:'#dc2626',background:'#fff',fontSize:11,cursor:'pointer' }}^>תקן^</button^>}
echo             ^</div^>
echo           ^</div^>
echo         ^)^)}
echo       ^</Card^>
echo     ^</div^>
echo   ^);
echo }
) > timein-frontend\src\pages\MyEntriesPage.jsx

echo [17/20] MyEntriesPage נוצר

:: ── src/pages/ManagementPage.jsx ────────────────────────────
(
echo import { useState, useEffect } from 'react';
echo import { useTimeEntries } from '../hooks/useTimeEntries';
echo import { useReports } from '../hooks/useReports';
echo import { useToast } from '../context/ToastContext';
echo import Card from '../components/common/Card';
echo import Badge from '../components/common/Badge';
echo import Spinner from '../components/common/Spinner';
echo const fmt=m=>`${Math.floor^(m/60^)}:${String^(m%%60^).padStart^(2,'0'^)}`;
echo export default function ManagementPage^(^) {
echo   const { addToast }=useToast^(^);
echo   const { data,loading:rLoading,fetch:fetchReport }=useReports^(^);
echo   const [rType,setRType]=useState^('byUser'^);
echo   const [f,setF]=useState^({ status:'',date:'' }^);
echo   const { entries,loading,approve,reject }=useTimeEntries^(Object.fromEntries^(Object.entries^(f^).filter^(([,v])=^>v^)^)^);
echo   useEffect^(^(^)=^>{ fetchReport^(rType^); },[rType]);
echo   const handleReject=async^(id^)=^>{ const r=window.prompt^('סיבת הדחייה:'^); try{ await reject^(id,r^); }catch^(err^){ addToast^(err.message,'error'^); } };
echo   const sel={ border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 10px',fontSize:12,background:'#fff' };
echo   const tabs=[['byUser','לפי עובד'],['byProject','לפי פרויקט'],['byTask','לפי משימה'],['anomalies','חריגות']];
echo   return ^(
echo     ^<div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}^>
echo       ^<h2 style={{ fontSize:18,fontWeight:600,marginBottom:20,color:'#1e293b' }}^>ניהול^</h2^>
echo       ^<Card style={{ marginBottom:16 }}^>
echo         ^<div style={{ display:'flex',gap:8,marginBottom:14 }}^>
echo           {tabs.map^(([k,l])=^>^<button key={k} onClick={^(^)=^>setRType^(k^)} style={{ padding:'6px 14px',borderRadius:8,border:rType===k?'none':'1px solid #e2e8f0',background:rType===k?'#6366f1':'#fff',color:rType===k?'#fff':'#64748b',fontSize:12,cursor:'pointer',fontWeight:rType===k?500:400 }}^>{l}^</button^>^)^)}
echo         ^</div^>
echo         {rLoading^&^&^<Spinner/^>}
echo         {data^&^&rType==='byUser'^&^&^<table style={{ width:'100%%',fontSize:12,borderCollapse:'collapse' }}^>^<thead^>^<tr style={{ color:'#94a3b8' }}^>{['עובד','צוות','שעות','דיווחים','פרויקטים'].map^(h=^>^<th key={h} style={{ textAlign:'right',padding:'6px 0',fontWeight:400 }}^>{h}^</th^>^)}^</tr^>^</thead^>^<tbody^>{data.map^(r=^>^<tr key={r.user_id} style={{ borderTop:'1px solid #f1f5f9' }}^>^<td style={{ padding:'8px 0',fontWeight:500 }}^>{r.full_name}^</td^>^<td style={{ padding:'8px 0',color:'#64748b' }}^>{r.team}^</td^>^<td style={{ padding:'8px 0',color:'#6366f1',fontWeight:600 }}^>{r.total_hours}ש'^</td^>^<td style={{ padding:'8px 0',color:'#64748b' }}^>{r.entry_count}^</td^>^<td style={{ padding:'8px 0',color:'#64748b' }}^>{r.project_count}^</td^>^</tr^>^)^)}^</tbody^>^</table^>}
echo         {data^&^&rType==='byProject'^&^&^<table style={{ width:'100%%',fontSize:12,borderCollapse:'collapse' }}^>^<thead^>^<tr style={{ color:'#94a3b8' }}^>{['פרויקט','שעות','עובדים','דיווחים'].map^(h=^>^<th key={h} style={{ textAlign:'right',padding:'6px 0',fontWeight:400 }}^>{h}^</th^>^)}^</tr^>^</thead^>^<tbody^>{data.map^(r=^>^<tr key={r.project_id} style={{ borderTop:'1px solid #f1f5f9' }}^>^<td style={{ padding:'8px 0',fontWeight:500 }}^>{r.project_name}^</td^>^<td style={{ padding:'8px 0',color:'#6366f1',fontWeight:600 }}^>{r.total_hours}ש'^</td^>^<td style={{ padding:'8px 0',color:'#64748b' }}^>{r.user_count}^</td^>^<td style={{ padding:'8px 0',color:'#64748b' }}^>{r.entry_count}^</td^>^</tr^>^)^)}^</tbody^>^</table^>}
echo       ^</Card^>
echo       ^<Card^>
echo         ^<div style={{ fontSize:13,fontWeight:500,color:'#64748b',marginBottom:12 }}^>אישור דיווחים^</div^>
echo         ^<div style={{ display:'flex',gap:10,marginBottom:12 }}^>
echo           ^<select value={f.status} onChange={e=^>setF^(p=^>^({...p,status:e.target.value}^)^)} style={sel}^>^<option value=""^>כל הסטטוסים^</option^>^<option value="submitted"^>ממתינים^</option^>^<option value="approved"^>אושרו^</option^>^<option value="rejected"^>נדחו^</option^>^</select^>
echo           ^<input type="date" value={f.date} onChange={e=^>setF^(p=^>^({...p,date:e.target.value}^)^)} style={sel}/^>
echo         ^</div^>
echo         {loading^&^&^<Spinner/^>}
echo         {entries.map^(e=^>^(
echo           ^<div key={e.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}^>
echo             ^<span style={{ color:'#94a3b8',minWidth:80 }}^>{e.date}^</span^>
echo             ^<div style={{ flex:1 }}^>^<div style={{ fontWeight:500 }}^>{e.user_name}^</div^>^<div style={{ color:'#64748b' }}^>{e.project_name}^</div^>^</div^>
echo             ^<span style={{ fontWeight:600,color:'#6366f1' }}^>{fmt^(e.duration_minutes^)}^</span^>
echo             ^<Badge status={e.status}/^>
echo             {e.status==='submitted'^&^&^<div style={{ display:'flex',gap:5 }}^>
echo               ^<button onClick={^(^)=^>approve^(e.id^).catch^(err=^>addToast^(err.message,'error'^)^)} style={{ padding:'4px 10px',borderRadius:6,background:'#d1fae5',color:'#065f46',border:'none',fontSize:11,cursor:'pointer',fontWeight:500 }}^>אשר^</button^>
echo               ^<button onClick={^(^)=^>handleReject^(e.id^)} style={{ padding:'4px 10px',borderRadius:6,background:'#fee2e2',color:'#991b1b',border:'none',fontSize:11,cursor:'pointer',fontWeight:500 }}^>דחה^</button^>
echo             ^</div^>}
echo           ^</div^>
echo         ^)^)}
echo       ^</Card^>
echo     ^</div^>
echo   ^);
echo }
) > timein-frontend\src\pages\ManagementPage.jsx

echo [18/20] ManagementPage נוצר

:: ── src/pages/IntegrationsPage.jsx ──────────────────────────
(
echo import { useEffect, useState } from 'react';
echo import { integrationsApi } from '../api/integrations';
echo import Card from '../components/common/Card';
echo export default function IntegrationsPage^(^) {
echo   const [status,setStatus]=useState^(null^);
echo   const [commits,setCommits]=useState^([]^);
echo   useEffect^(^(^)=^>{ integrationsApi.getStatus^(^).then^(setStatus^).catch^(^(^)=^>{}^); integrationsApi.getCommits^(^).then^(setCommits^).catch^(^(^)=^>{}^); },[]);
echo   return ^(
echo     ^<div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}^>
echo       ^<h2 style={{ fontSize:18,fontWeight:600,marginBottom:20,color:'#1e293b' }}^>אינטגרציות^</h2^>
echo       ^<div style={{ display:'flex',gap:16,flexWrap:'wrap',marginBottom:16 }}^>
echo         ^<Card style={{ flex:1,minWidth:240 }}^>
echo           ^<div style={{ fontWeight:500,marginBottom:8 }}^>Git^</div^>
echo           ^<div style={{ fontSize:12,color:'#64748b' }}^>סטטוס: {status?.git?.status^|^|'בודק...'}^</div^>
echo           ^<div style={{ fontSize:12,color:'#64748b' }}^>commits שמורים: {status?.git?.count^|^|0}^</div^>
echo         ^</Card^>
echo         ^<Card style={{ flex:1,minWidth:240 }}^>
echo           ^<div style={{ fontWeight:500,marginBottom:8 }}^>ClickUp^</div^>
echo           ^<div style={{ fontSize:12,color:'#64748b' }}^>סטטוס: {status?.clickup?.status^|^|'בודק...'}^</div^>
echo           ^<div style={{ fontSize:12,color:'#64748b' }}^>משימות: {status?.clickup?.count^|^|0}^</div^>
echo         ^</Card^>
echo       ^</div^>
echo       ^<Card^>
echo         ^<div style={{ fontSize:13,fontWeight:500,color:'#64748b',marginBottom:12 }}^>commits אחרונים^</div^>
echo         {commits.length===0^&^&^<p style={{ color:'#94a3b8',fontSize:12,textAlign:'center',padding:20 }}^>אין commits עדיין^</p^>}
echo         {commits.map^(c=^>^<div key={c.id} style={{ display:'flex',gap:10,padding:'8px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}^>^<code style={{ background:'#f1f5f9',padding:'2px 8px',borderRadius:4 }}^>{c.commit_hash?.slice^(0,7^)}^</code^>^<span style={{ flex:1,color:'#334155' }}^>{c.commit_message}^</span^>^<span style={{ color:'#94a3b8' }}^>{c.full_name}^</span^>^</div^>^)^)}
echo       ^</Card^>
echo     ^</div^>
echo   ^);
echo }
) > timein-frontend\src\pages\IntegrationsPage.jsx

echo [19/20] IntegrationsPage נוצר

:: ── src/App.jsx ─────────────────────────────────────────────
(
echo import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
echo import { AuthProvider, useAuth } from './context/AuthContext';
echo import { ToastProvider } from './context/ToastContext';
echo import Sidebar from './components/layout/Sidebar';
echo import Spinner from './components/common/Spinner';
echo import LoginPage from './pages/LoginPage';
echo import DashboardPage from './pages/DashboardPage';
echo import ReportPage from './pages/ReportPage';
echo import MyEntriesPage from './pages/MyEntriesPage';
echo import ManagementPage from './pages/ManagementPage';
echo import IntegrationsPage from './pages/IntegrationsPage';
echo.
echo function ProtectedRoute^({ children, roles }^) {
echo   const { user, loading } = useAuth^(^);
echo   if ^(loading^) return ^<Spinner fullPage /^>;
echo   if ^(!user^) return ^<Navigate to="/login" replace /^>;
echo   if ^(roles ^&^& !roles.includes^(user.role^)^) return ^<Navigate to="/" replace /^>;
echo   return children;
echo }
echo.
echo function AppLayout^(^) {
echo   return ^(
echo     ^<div dir="rtl" style={{ display:'flex',height:'100vh',background:'#f8fafc',fontFamily:'system-ui,sans-serif' }}^>
echo       ^<Sidebar /^>
echo       ^<main style={{ flex:1,overflow:'auto',padding:24 }}^>
echo         ^<Routes^>
echo           ^<Route path="/"             element={^<DashboardPage /^>} /^>
echo           ^<Route path="/report"       element={^<ReportPage /^>} /^>
echo           ^<Route path="/report/:id"   element={^<ReportPage /^>} /^>
echo           ^<Route path="/my-entries"   element={^<MyEntriesPage /^>} /^>
echo           ^<Route path="/management"   element={^<ProtectedRoute roles={['manager','admin']}^>^<ManagementPage /^>^</ProtectedRoute^>} /^>
echo           ^<Route path="/integrations" element={^<IntegrationsPage /^>} /^>
echo           ^<Route path="*"             element={^<Navigate to="/" replace /^>} /^>
echo         ^</Routes^>
echo       ^</main^>
echo     ^</div^>
echo   ^);
echo }
echo.
echo export default function App^(^) {
echo   return ^(
echo     ^<BrowserRouter^>
echo       ^<AuthProvider^>
echo         ^<ToastProvider^>
echo           ^<Routes^>
echo             ^<Route path="/login" element={^<LoginPage /^>} /^>
echo             ^<Route path="/*" element={^<ProtectedRoute^>^<AppLayout /^>^</ProtectedRoute^>} /^>
echo           ^</Routes^>
echo         ^</ToastProvider^>
echo       ^</AuthProvider^>
echo     ^</BrowserRouter^>
echo   ^);
echo }
) > timein-frontend\src\App.jsx

echo [20/20] App.jsx נוצר

:: ════════════════════════════════════════════════════════════
:: התקנת חבילות
:: ════════════════════════════════════════════════════════════
echo.
echo ========================================
echo   מתקין חבילות Backend...
echo ========================================
cd timein-backend
call npm install
cd ..

echo.
echo ========================================
echo   מתקין חבילות Frontend...
echo ========================================
cd timein-frontend
call npm install
cd ..

:: ════════════════════════════════════════════════════════════
:: יצירת מסד הנתונים
:: ════════════════════════════════════════════════════════════
echo.
echo ========================================
echo   יוצר מסד נתונים...
echo ========================================
"C:\Program Files\PostgreSQL\18\bin\psql.exe" postgresql://postgres:Winer4852@localhost:5432/postgres -c "CREATE DATABASE timein;" 2>nul
"C:\Program Files\PostgreSQL\18\bin\psql.exe" postgresql://postgres:Winer4852@localhost:5432/timein -f timein-backend\src\db\schema.sql

echo.
echo ========================================
echo   מוסיף משתמשי Demo...
echo ========================================
timeout /t 3 /nobreak >nul
start /b cmd /c "cd timein-backend && npm run dev" 2>nul
timeout /t 5 /nobreak >nul

curl -s -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d "{\"fullName\":\"אלי כהן\",\"email\":\"eli@timein.io\",\"password\":\"123456\",\"role\":\"employee\",\"team\":\"Frontend\"}" >nul
curl -s -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d "{\"fullName\":\"מיכל לוי\",\"email\":\"michal@timein.io\",\"password\":\"123456\",\"role\":\"manager\",\"team\":\"Backend\"}" >nul
curl -s -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d "{\"fullName\":\"דן ברק\",\"email\":\"dan@timein.io\",\"password\":\"123456\",\"role\":\"admin\",\"team\":\"DevOps\"}" >nul
curl -s -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d "{\"fullName\":\"שרה מזרחי\",\"email\":\"sara@timein.io\",\"password\":\"123456\",\"role\":\"employee\",\"team\":\"Frontend\"}" >nul

echo.
echo ========================================
echo   הכל מוכן!
echo.
echo   כדי להריץ את הפרויקט:
echo.
echo   Terminal 1:
echo     cd timein-backend
echo     npm run dev
echo.
echo   Terminal 2:
echo     cd timein-frontend
echo     npm start
echo.
echo   פתחי דפדפן: http://localhost:3000
echo.
echo   משתמשים לכניסה:
echo     eli@timein.io      / 123456  (עובד)
echo     michal@timein.io   / 123456  (מנהל)
echo     dan@timein.io      / 123456  (אדמין)
echo ========================================
pause