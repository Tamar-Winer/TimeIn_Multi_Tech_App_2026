
const router = require('express').Router();
const https  = require('https');
const pool   = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

// ── DB init ──────────────────────────────────────────────────────
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clickup_configs (
      id         SERIAL PRIMARY KEY,
      api_key    TEXT NOT NULL,
      team_id    VARCHAR(50),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // add columns to clickup_task_links that might be missing
  const newCols = [
    ['space_id',       'VARCHAR(50)'],
    ['list_id',        'VARCHAR(50)'],
    ['list_name',      'VARCHAR(200)'],
    ['priority',       'VARCHAR(20)'],
    ['assignee_email', 'VARCHAR(150)'],
    ['clickup_url',    'VARCHAR(500)'],
    ['description',    'TEXT'],
    ['project_id',     'INTEGER'],
  ];
  for (const [col, type] of newCols) {
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='clickup_task_links' AND column_name='${col}'
        ) THEN ALTER TABLE clickup_task_links ADD COLUMN ${col} ${type};
        END IF;
      END $$
    `).catch(() => {});
  }
}
initTables().catch(console.error);

// ── ClickUp API helper ───────────────────────────────────────────
function cuGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    };
    https.get(`https://api.clickup.com/api/v2${path}`, opts, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400)
            reject(new Error(parsed.err || parsed.error || `HTTP ${res.statusCode}`));
          else resolve(parsed);
        } catch { reject(new Error('Invalid ClickUp response')); }
      });
    }).on('error', reject);
  });
}

async function getApiKey() {
  const { rows } = await pool.query('SELECT api_key FROM clickup_configs ORDER BY id DESC LIMIT 1');
  if (!rows.length) throw new Error('ClickUp לא מוגדר — הוסף API Key בהגדרות');
  return rows[0].api_key;
}

async function fetchAllTasksFromList(listId, apiKey) {
  const tasks = [];
  let page = 0;
  while (page < 5) { // max 500 tasks per list
    const data = await cuGet(
      `/list/${listId}/task?page=${page}&include_closed=true&subtasks=false`,
      apiKey
    );
    tasks.push(...(data.tasks || []));
    if (data.last_page !== false || !(data.tasks || []).length) break;
    page++;
  }
  return tasks;
}

async function upsertTask(task, listId, listName, emailMap) {
  const assigneeEmail = task.assignees?.[0]?.email || null;
  const userId        = assigneeEmail ? (emailMap[assigneeEmail.toLowerCase()] || null) : null;
  const estimatedMs   = task.time_estimate ? Math.round(task.time_estimate / 60000) : null;
  const dueDateMs     = task.due_date ? new Date(+task.due_date).toISOString().slice(0, 10) : null;
  const priority      = task.priority?.priority || null;
  const status        = task.status?.status || 'unknown';
  const spaceId       = task.space?.id || null;

  await pool.query(
    `INSERT INTO clickup_task_links
       (clickup_task_id, task_name, status, estimated_time, due_date,
        assignee_email, assigned_user_id, space_id, list_id, list_name,
        priority, clickup_url, description, last_sync_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
     ON CONFLICT (clickup_task_id) DO UPDATE SET
       task_name        = EXCLUDED.task_name,
       status           = EXCLUDED.status,
       estimated_time   = EXCLUDED.estimated_time,
       due_date         = EXCLUDED.due_date,
       assignee_email   = EXCLUDED.assignee_email,
       assigned_user_id = EXCLUDED.assigned_user_id,
       space_id         = EXCLUDED.space_id,
       list_id          = EXCLUDED.list_id,
       list_name        = EXCLUDED.list_name,
       priority         = EXCLUDED.priority,
       clickup_url      = EXCLUDED.clickup_url,
       description      = EXCLUDED.description,
       last_sync_date   = NOW()`,
    [task.id, task.name, status, estimatedMs, dueDateMs,
     assigneeEmail, userId, spaceId, listId, listName,
     priority, task.url || null, task.description || null]
  );
}

// ── Config ────────────────────────────────────────────────────────
router.get('/config', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, team_id, created_at, updated_at FROM clickup_configs ORDER BY id DESC LIMIT 1'
    );
    res.json(rows[0] || null);
  } catch (err) { next(err); }
});

router.post('/config', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  const { apiKey, teamId } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'apiKey נדרש' });
  try {
    // test key first
    await cuGet('/team', apiKey);
    // upsert config (only one row)
    await pool.query('DELETE FROM clickup_configs');
    const { rows } = await pool.query(
      'INSERT INTO clickup_configs (api_key, team_id, created_by) VALUES ($1,$2,$3) RETURNING id, team_id, created_at',
      [apiKey, teamId || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/config', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM clickup_configs');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Teams ─────────────────────────────────────────────────────────
router.get('/teams', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const apiKey = await getApiKey();
    const data   = await cuGet('/team', apiKey);
    res.json((data.teams || []).map(t => ({ id: t.id, name: t.name, members: t.members?.length || 0 })));
  } catch (err) { next(err); }
});

// ── Spaces ────────────────────────────────────────────────────────
router.get('/spaces/:teamId', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const apiKey = await getApiKey();
    const data   = await cuGet(`/team/${req.params.teamId}/space?archived=false`, apiKey);
    res.json((data.spaces || []).map(s => ({
      id: s.id, name: s.name, private: s.private, statuses: s.statuses?.map(x => x.status) || [],
    })));
  } catch (err) { next(err); }
});

// ── Lists in a space ──────────────────────────────────────────────
router.get('/lists/:spaceId', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const apiKey = await getApiKey();
    const [foldersData, folderlessData] = await Promise.all([
      cuGet(`/space/${req.params.spaceId}/folder?archived=false`, apiKey),
      cuGet(`/space/${req.params.spaceId}/list?archived=false`, apiKey),
    ]);

    const lists = [];
    for (const folder of (foldersData.folders || [])) {
      const listRes = await cuGet(`/folder/${folder.id}/list?archived=false`, apiKey);
      for (const list of (listRes.lists || [])) {
        lists.push({ id: list.id, name: list.name, folder: folder.name, task_count: list.task_count || 0 });
      }
    }
    for (const list of (folderlessData.lists || [])) {
      lists.push({ id: list.id, name: list.name, folder: null, task_count: list.task_count || 0 });
    }
    res.json(lists);
  } catch (err) { next(err); }
});

// ── Sync all lists in a space ─────────────────────────────────────
router.post('/sync/space/:spaceId', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const apiKey = await getApiKey();
    const { rows: users } = await pool.query('SELECT id, email FROM users WHERE is_active=TRUE');
    const emailMap = Object.fromEntries(users.map(u => [u.email.toLowerCase(), u.id]));

    const [foldersData, folderlessData] = await Promise.all([
      cuGet(`/space/${req.params.spaceId}/folder?archived=false`, apiKey),
      cuGet(`/space/${req.params.spaceId}/list?archived=false`, apiKey),
    ]);

    const allLists = [];
    for (const folder of (foldersData.folders || [])) {
      const lr = await cuGet(`/folder/${folder.id}/list?archived=false`, apiKey);
      (lr.lists || []).forEach(l => allLists.push({ id: l.id, name: l.name }));
    }
    (folderlessData.lists || []).forEach(l => allLists.push({ id: l.id, name: l.name }));

    let saved = 0;
    for (const list of allLists) {
      const tasks = await fetchAllTasksFromList(list.id, apiKey);
      for (const task of tasks) {
        await upsertTask(task, list.id, list.name, emailMap);
        saved++;
      }
    }
    res.json({ saved, lists: allLists.length });
  } catch (err) { next(err); }
});

// ── Sync a single list ────────────────────────────────────────────
router.post('/sync/list/:listId', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const apiKey  = await getApiKey();
    const { rows: users } = await pool.query('SELECT id, email FROM users WHERE is_active=TRUE');
    const emailMap = Object.fromEntries(users.map(u => [u.email.toLowerCase(), u.id]));

    // get list name
    const listData = await cuGet(`/list/${req.params.listId}`, apiKey);
    const tasks    = await fetchAllTasksFromList(req.params.listId, apiKey);

    for (const task of tasks) {
      await upsertTask(task, req.params.listId, listData.name || '', emailMap);
    }
    res.json({ saved: tasks.length, listName: listData.name });
  } catch (err) { next(err); }
});

// ── Sync status ───────────────────────────────────────────────────
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const safe = (promise) => promise.catch(() => null);
    const [
      gitTotal, gitLinked, gitRepos, gitLastSync,
      cuTotal, cuOpen, cuLastSync, cuConfig,
    ] = await Promise.all([
      safe(pool.query('SELECT COUNT(*) FROM git_commits')),
      safe(pool.query("SELECT COUNT(*) FROM git_commits WHERE linked_task_id IS NOT NULL OR linked_time_entry_id IS NOT NULL")),
      safe(pool.query('SELECT COUNT(*) FROM git_repo_configs')),
      safe(pool.query('SELECT MAX(created_at) AS last FROM git_commits')),
      safe(pool.query('SELECT COUNT(*) FROM clickup_task_links')),
      safe(pool.query("SELECT COUNT(*) FROM clickup_task_links WHERE status NOT IN ('done','closed','completed')")),
      safe(pool.query('SELECT MAX(last_sync_date) AS last FROM clickup_task_links')),
      safe(pool.query('SELECT updated_at FROM clickup_configs ORDER BY id DESC LIMIT 1')),
    ]);
    res.json({
      git: {
        totalCommits:  Number(gitTotal?.rows[0]?.count  || 0),
        linkedCommits: Number(gitLinked?.rows[0]?.count || 0),
        repoCount:     Number(gitRepos?.rows[0]?.count  || 0),
        lastSync:      gitLastSync?.rows[0]?.last || null,
      },
      clickup: {
        connected:  !!(cuConfig?.rows?.length),
        totalTasks: Number(cuTotal?.rows[0]?.count || 0),
        openTasks:  Number(cuOpen?.rows[0]?.count  || 0),
        lastSync:   cuLastSync?.rows[0]?.last || null,
      },
    });
  } catch (err) { next(err); }
});

// ── User mapping ──────────────────────────────────────────────────
router.get('/mapping/users', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const [mappingsRes, usersRes] = await Promise.all([
      pool.query(`
        SELECT DISTINCT ctl.assignee_email, ctl.assigned_user_id, u.full_name
        FROM clickup_task_links ctl
        LEFT JOIN users u ON u.id = ctl.assigned_user_id
        WHERE ctl.assignee_email IS NOT NULL
        ORDER BY ctl.assignee_email
      `),
      pool.query("SELECT id, full_name, email FROM users WHERE is_active=TRUE ORDER BY full_name"),
    ]);
    res.json({ mappings: mappingsRes.rows, users: usersRes.rows });
  } catch (err) { next(err); }
});

router.post('/mapping/users', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  const { email, userId } = req.body;
  if (!email) return res.status(400).json({ error: 'email נדרש' });
  try {
    await pool.query(
      'UPDATE clickup_task_links SET assigned_user_id=$1 WHERE LOWER(assignee_email)=LOWER($2)',
      [userId || null, email]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Project mapping ───────────────────────────────────────────────
router.get('/mapping/projects', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const [mappingsRes, projectsRes] = await Promise.all([
      pool.query(`
        SELECT DISTINCT ctl.list_id, ctl.list_name, ctl.project_id, p.project_name
        FROM clickup_task_links ctl
        LEFT JOIN projects p ON p.id = ctl.project_id
        WHERE ctl.list_id IS NOT NULL
        ORDER BY ctl.list_name
      `),
      pool.query("SELECT id, project_name FROM projects WHERE status='active' ORDER BY project_name"),
    ]);
    res.json({ mappings: mappingsRes.rows, projects: projectsRes.rows });
  } catch (err) { next(err); }
});

router.post('/mapping/projects', authenticate, requireRole('manager', 'admin'), async (req, res, next) => {
  const { listId, projectId } = req.body;
  if (!listId) return res.status(400).json({ error: 'listId נדרש' });
  try {
    await pool.query(
      'UPDATE clickup_task_links SET project_id=$1 WHERE list_id=$2',
      [projectId || null, listId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Get synced tasks ──────────────────────────────────────────────
router.get('/tasks', authenticate, async (req, res, next) => {
  try {
    const { search, status, listId, assignedUserId, projectId } = req.query;
    const conds = [], vals = [];
    if (search)         { conds.push(`LOWER(ctl.task_name) LIKE $${vals.length+1}`); vals.push(`%${search.toLowerCase()}%`); }
    if (status)         { conds.push(`ctl.status = $${vals.length+1}`);              vals.push(status); }
    if (listId)         { conds.push(`ctl.list_id = $${vals.length+1}`);             vals.push(listId); }
    if (assignedUserId) { conds.push(`ctl.assigned_user_id = $${vals.length+1}`);    vals.push(assignedUserId); }
    if (projectId)      { conds.push(`ctl.project_id = $${vals.length+1}`);          vals.push(projectId); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT ctl.*, u.full_name AS assigned_user_name
       FROM clickup_task_links ctl
       LEFT JOIN users u ON u.id = ctl.assigned_user_id
       ${where}
       ORDER BY ctl.last_sync_date DESC, ctl.task_name
       LIMIT 200`,
      vals
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
