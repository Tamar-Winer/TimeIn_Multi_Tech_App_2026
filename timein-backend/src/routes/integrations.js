
const router = require('express').Router();
const https  = require('https');
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

// ── DB init ──────────────────────────────────────────────────────
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS git_repo_configs (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(150),
      provider   VARCHAR(20) NOT NULL DEFAULT 'github',
      owner      VARCHAR(150) NOT NULL,
      repo_name  VARCHAR(150) NOT NULL,
      token      TEXT,
      project_id INTEGER REFERENCES projects(id),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname='uq_git_commits_hash_repo'
      ) THEN
        ALTER TABLE git_commits
          ADD CONSTRAINT uq_git_commits_hash_repo UNIQUE (commit_hash, repository);
      END IF;
    END $$
  `).catch(() => {});
}
initTables().catch(console.error);

// ── helpers ──────────────────────────────────────────────────────
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'timein-app', Accept: 'application/json', ...headers } };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(parsed.message || `HTTP ${res.statusCode}`));
          else resolve(parsed);
        } catch { reject(new Error('Invalid JSON response')); }
      });
    }).on('error', reject);
  });
}

// extract #123 or TASK-123 style ref from message + branch
function extractTaskRef(message = '', branch = '') {
  const text = `${message} ${branch}`;
  const m = text.match(/#(\d+)/) || text.match(/\b([A-Za-z]+-\d+)\b/);
  return m ? (m[1] ?? m[0]) : null;
}

async function findTaskByRef(ref) {
  if (!ref) return null;
  const numId = parseInt(ref, 10);
  if (!isNaN(numId)) {
    const { rows } = await pool.query(
      'SELECT id, task_name, project_id FROM tasks WHERE id=$1', [numId]
    );
    if (rows.length) return rows[0];
  }
  const { rows } = await pool.query(
    "SELECT id, task_name, project_id FROM tasks WHERE LOWER(task_name) LIKE $1 LIMIT 1",
    [`%${ref.toLowerCase()}%`]
  );
  return rows[0] || null;
}

// ── Repo configs ─────────────────────────────────────────────────
router.get('/repo-configs', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT rc.id, rc.name, rc.provider, rc.owner, rc.repo_name, rc.project_id, rc.created_at,
              p.project_name,
              CASE WHEN rc.token IS NOT NULL THEN true ELSE false END AS has_token
       FROM git_repo_configs rc
       LEFT JOIN projects p ON p.id = rc.project_id
       ORDER BY rc.created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/repo-configs', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  const { name, provider = 'github', owner, repoName, token, projectId } = req.body;
  if (!owner || !repoName) return res.status(400).json({ error: 'owner ו-repoName נדרשים' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO git_repo_configs (name, provider, owner, repo_name, token, project_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, name, provider, owner, repo_name, project_id, created_at`,
      [name || `${owner}/${repoName}`, provider, owner, repoName, token || null, projectId || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/repo-configs/:id', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM git_repo_configs WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Fetch commits from provider ──────────────────────────────────
router.post('/repo-configs/:id/fetch', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { rows: cfgs } = await pool.query('SELECT * FROM git_repo_configs WHERE id=$1', [req.params.id]);
    if (!cfgs.length) return res.status(404).json({ error: 'Config not found' });
    const cfg = cfgs[0];

    const { dateFrom, dateTo, branch } = req.body;
    const since = dateFrom
      ? new Date(dateFrom).toISOString()
      : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const until = dateTo ? new Date(dateTo + 'T23:59:59Z').toISOString() : new Date().toISOString();

    let rawCommits = [];

    if (cfg.provider === 'github') {
      const params =
        `?since=${since}&until=${until}&per_page=100` +
        (branch ? `&sha=${encodeURIComponent(branch)}` : '');
      const headers = { Accept: 'application/vnd.github.v3+json' };
      if (cfg.token) headers.Authorization = `token ${cfg.token}`;
      const data = await httpGet(
        `https://api.github.com/repos/${cfg.owner}/${cfg.repo_name}/commits${params}`,
        headers
      );
      rawCommits = (Array.isArray(data) ? data : []).map(c => ({
        hash:    c.sha,
        message: (c.commit.message || '').split('\n')[0],
        email:   c.commit.author?.email || '',
        date:    c.commit.author?.date || new Date().toISOString(),
        branch:  branch || 'main',
      }));

    } else if (cfg.provider === 'gitlab') {
      const projectPath = encodeURIComponent(`${cfg.owner}/${cfg.repo_name}`);
      const params =
        `?since=${since}&until=${until}&per_page=100` +
        (branch ? `&ref_name=${encodeURIComponent(branch)}` : '');
      const headers = {};
      if (cfg.token) headers['PRIVATE-TOKEN'] = cfg.token;
      const data = await httpGet(
        `https://gitlab.com/api/v4/projects/${projectPath}/repository/commits${params}`,
        headers
      );
      rawCommits = (Array.isArray(data) ? data : []).map(c => ({
        hash:    c.id,
        message: c.title || '',
        email:   c.author_email || '',
        date:    c.authored_date || new Date().toISOString(),
        branch:  branch || 'main',
      }));

    } else if (cfg.provider === 'bitbucket') {
      const path = branch
        ? `/${encodeURIComponent(branch)}?pagelen=100`
        : `?pagelen=100`;
      const headers = {};
      if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
      const data = await httpGet(
        `https://api.bitbucket.org/2.0/repositories/${cfg.owner}/${cfg.repo_name}/commits${path}`,
        headers
      );
      rawCommits = (data.values || [])
        .filter(c => {
          const d = new Date(c.date);
          return d >= new Date(since) && d <= new Date(until);
        })
        .map(c => ({
          hash:    c.hash,
          message: (c.message || '').split('\n')[0],
          email:   c.author?.raw?.match(/<(.+)>/)?.[1] || '',
          date:    c.date,
          branch:  branch || 'main',
        }));
    }

    // match emails to users
    const { rows: users } = await pool.query('SELECT id, email FROM users WHERE is_active=TRUE');
    const emailMap = Object.fromEntries(users.map(u => [u.email.toLowerCase(), u.id]));

    const repo = `${cfg.owner}/${cfg.repo_name}`;
    let saved = 0, skipped = 0;

    for (const c of rawCommits) {
      const userId  = emailMap[c.email.toLowerCase()] || null;
      const taskRef = extractTaskRef(c.message, c.branch);
      const task    = taskRef ? await findTaskByRef(taskRef) : null;

      const { rowCount } = await pool.query(
        `INSERT INTO git_commits
           (repository, branch, commit_hash, commit_message, commit_author_email,
            commit_date, linked_user_id, linked_task_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT ON CONSTRAINT uq_git_commits_hash_repo DO NOTHING`,
        [repo, c.branch, c.hash, c.message, c.email, c.date, userId, task?.id || null]
      );
      if (rowCount > 0) saved++; else skipped++;
    }

    res.json({ saved, skipped, total: rawCommits.length });
  } catch (err) { next(err); }
});

// ── List commits ─────────────────────────────────────────────────
router.get('/commits', authenticate, async (req, res, next) => {
  try {
    const { userId, dateFrom, dateTo, repository, linked } = req.query;
    const isManager = ['manager', 'admin'].includes(req.user.role);
    const effectiveUserId = isManager ? (userId || null) : req.user.id;

    const conds = [], vals = [];
    if (effectiveUserId) {
      conds.push(`gc.linked_user_id=$${vals.length + 1}`);
      vals.push(effectiveUserId);
    }
    if (dateFrom) {
      conds.push(`gc.commit_date >= $${vals.length + 1}::date`);
      vals.push(dateFrom);
    }
    if (dateTo) {
      conds.push(`gc.commit_date < $${vals.length + 1}::date + INTERVAL '1 day'`);
      vals.push(dateTo);
    }
    if (repository) {
      conds.push(`gc.repository = $${vals.length + 1}`);
      vals.push(repository);
    }
    if (linked === 'true')  conds.push('gc.linked_time_entry_id IS NOT NULL');
    if (linked === 'false') conds.push('gc.linked_time_entry_id IS NULL');

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT gc.*,
              u.full_name, u.email AS user_email,
              t.task_name, p.project_name AS task_project,
              te.date AS entry_date
       FROM git_commits gc
       LEFT JOIN users u         ON u.id  = gc.linked_user_id
       LEFT JOIN tasks t         ON t.id  = gc.linked_task_id
       LEFT JOIN projects p      ON p.id  = t.project_id
       LEFT JOIN time_entries te ON te.id = gc.linked_time_entry_id
       ${where}
       ORDER BY gc.commit_date DESC
       LIMIT 300`,
      vals
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Link commit to task / time-entry ────────────────────────────
router.patch('/commits/:id/link', authenticate, async (req, res, next) => {
  const { timeEntryId, taskId } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE git_commits
       SET linked_time_entry_id=$1, linked_task_id=COALESCE($2, linked_task_id)
       WHERE id=$3
       RETURNING *`,
      [timeEntryId || null, taskId || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Commit not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── Task suggestions for a commit ───────────────────────────────
router.get('/commits/:id/suggestions', authenticate, async (req, res, next) => {
  try {
    const { rows: [commit] } = await pool.query('SELECT * FROM git_commits WHERE id=$1', [req.params.id]);
    if (!commit) return res.status(404).json({ error: 'Not found' });

    const suggestions = [];

    // 1. exact task-ref in message or branch
    const taskRef = extractTaskRef(commit.commit_message || '', commit.branch || '');
    if (taskRef) {
      const task = await findTaskByRef(taskRef);
      if (task) {
        const { rows: [tp] } = await pool.query('SELECT project_name FROM projects WHERE id=$1', [task.project_id]);
        suggestions.push({ ...task, project_name: tp?.project_name, reason: 'מזהה משימה בהודעת הקומיט', confidence: 'high' });
      }
    }

    // 2. keyword match against task names
    const words = (commit.commit_message || '')
      .split(/\W+/)
      .filter(w => w.length > 3)
      .slice(0, 6);
    if (words.length) {
      const likes = words.map((_, i) => `LOWER(t.task_name) LIKE $${i + 1}`).join(' OR ');
      const { rows: kwTasks } = await pool.query(
        `SELECT t.id, t.task_name, t.project_id, p.project_name
         FROM tasks t JOIN projects p ON p.id=t.project_id
         WHERE (${likes}) AND t.status NOT IN ('done','cancelled')
         LIMIT 5`,
        words.map(w => `%${w.toLowerCase()}%`)
      );
      for (const t of kwTasks) {
        if (!suggestions.find(s => s.id === t.id))
          suggestions.push({ ...t, reason: 'מילות מפתח מהודעת הקומיט', confidence: 'medium' });
      }
    }

    // 3. active tasks assigned to this user
    if (commit.linked_user_id) {
      const { rows: userTasks } = await pool.query(
        `SELECT t.id, t.task_name, t.project_id, p.project_name
         FROM tasks t JOIN projects p ON p.id=t.project_id
         WHERE t.assigned_user_id=$1 AND t.status='in_progress'
         LIMIT 3`,
        [commit.linked_user_id]
      );
      for (const t of userTasks) {
        if (!suggestions.find(s => s.id === t.id))
          suggestions.push({ ...t, reason: 'משימה פעילה של העובד', confidence: 'low' });
      }
    }

    res.json({ commit, suggestions });
  } catch (err) { next(err); }
});

// ── Gaps analysis ────────────────────────────────────────────────
router.get('/gaps', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const since = dateFrom || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const until = dateTo   || new Date().toISOString().slice(0, 10);

    const { rows } = await pool.query(
      `SELECT u.id AS user_id, u.full_name, u.team,
              gc.commit_date::date                                           AS commit_day,
              COUNT(gc.id)::int                                              AS commit_count,
              STRING_AGG(DISTINCT gc.repository, ', ')                      AS repositories
       FROM git_commits gc
       JOIN users u ON u.id = gc.linked_user_id
       WHERE gc.linked_user_id IS NOT NULL
         AND gc.commit_date::date BETWEEN $1 AND $2
         AND NOT EXISTS (
           SELECT 1 FROM time_entries te
           WHERE te.user_id = u.id AND te.date = gc.commit_date::date
         )
       GROUP BY u.id, u.full_name, u.team, gc.commit_date::date
       ORDER BY gc.commit_date::date DESC, u.full_name`,
      [since, until]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Status ───────────────────────────────────────────────────────
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const [c, cu, cfg] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM git_commits'),
      pool.query('SELECT COUNT(*) FROM clickup_task_links'),
      pool.query('SELECT COUNT(*) FROM git_repo_configs').catch(() => ({ rows: [{ count: 0 }] })),
    ]);
    res.json({
      git:     { status: 'connected', count: +c.rows[0].count,   repos: +cfg.rows[0].count },
      clickup: { status: 'connected', count: +cu.rows[0].count },
    });
  } catch (err) { next(err); }
});

// ── Manual commit save (backward compat) ─────────────────────────
router.post('/commits', authenticate, async (req, res, next) => {
  const { repository, branch, commitHash, commitMessage, commitDate, linkedTaskId, linkedTimeEntryId } = req.body;
  if (!commitHash || !repository) return res.status(400).json({ error: 'commitHash and repository required' });
  try {
    const taskRef = extractTaskRef(commitMessage || '', branch || '');
    const task    = (!linkedTaskId && taskRef) ? await findTaskByRef(taskRef) : null;

    const { rows } = await pool.query(
      `INSERT INTO git_commits
         (repository, branch, commit_hash, commit_message, commit_author_email,
          commit_date, linked_user_id, linked_task_id, linked_time_entry_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT ON CONSTRAINT uq_git_commits_hash_repo DO NOTHING
       RETURNING *`,
      [repository, branch, commitHash, commitMessage, req.user.email,
       commitDate || new Date(), req.user.id,
       linkedTaskId || task?.id || null, linkedTimeEntryId || null]
    );
    res.status(201).json(rows[0] || {});
  } catch (err) { next(err); }
});

module.exports = router;
