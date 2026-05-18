<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=32&duration=2800&pause=2000&color=6366F1&center=true&vCenter=true&width=600&lines=TimeIn+%E2%8F%B1;Track+What+Matters." alt="TimeIn" />

<br/>

**A clean, developer-friendly time tracking platform built for modern engineering teams.**  
Log hours by project, link work to Git commits and ClickUp tasks, and give managers the visibility they actually need.

<br/>

[![Status](https://img.shields.io/badge/status-MVP-6366f1?style=for-the-badge&logo=rocket&logoColor=white)](.)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=for-the-badge)](.)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-f59e0b?style=for-the-badge)](.)
[![Made with ❤️](https://img.shields.io/badge/made%20with-❤️-ef4444?style=for-the-badge)](.)

<br/>

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232a?style=flat-square&logo=react&logoColor=61DAFB)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=flat-square&logo=reactrouter&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00E5BF?style=flat-square&logo=neon&logoColor=black)
![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white)
![ClickUp](https://img.shields.io/badge/ClickUp-7B68EE?style=flat-square&logo=clickup&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

---

## ✨ What is TimeIn?

TimeIn is a **work-hour reporting system** designed around the way developers actually work — by project, by task, and in relation to real code activity. It's not just a stopwatch. It's a bridge between your team's hours and their output.

```
Hours logged  →  Project context  →  Git commits  →  ClickUp tasks
     ↓                ↓                   ↓                ↓
  Audit trail    Manager view       Code linkage      Task sync
```
<img width="1917" height="921" alt="20260518174531228" src="https://github.com/user-attachments/assets/cdf5c4a8-a314-4a23-a54f-153266320058" />

---

## 🎯 Core Features

### ⏱ Time Entry
- **Manual logging** — date, project, task, start/end or total duration, work type, and notes
- **Live timer** — start/pause/stop with auto-generated time entry on completion
- **Timer persistence** — survives page refresh via `localStorage` (no lost sessions)
- **Draft & submit** workflow — save entries as draft before sending for approval
- **Overlap detection** — PostgreSQL trigger prevents duplicate time ranges for the same user per day
- **Work types** — development, design, review, devops, meeting, QA, other
- **Retroactive logging** — configurable per workspace by the admin (max days lookback)

### 📊 Employee Dashboard
- Today / this week / this month summary at a glance
- Task breakdown chart powered by Recharts
- Recent entries with quick edit / delete
- Active timer widget always visible in the sidebar

### 🧑‍💼 Manager View
- Filter by employee, project, task, or date range
- Per-project and per-task hour breakdown
- Daily drill-down for any team member
- Full approval queue — approve or reject with a rejection reason

### 👑 Admin Panel
- Full user management (create, deactivate, assign to team)
- Projects CRUD — with Git repository URL and ClickUp Space ID per project
- **Teams** — group employees into teams, each team mapped to one or more projects
- **Multi-project teams** — a single team can work on multiple projects via a `team_projects` junction table
- System-wide settings (retroactive policy, Slack webhook, reminder time)

### 🔗 Git Integration *(Beta)*
- Fetch commits from a linked GitHub repository
- Extract task references from commit messages (`#123` / `TASK-123`)
- Store `related_commit_ids[]` directly on each time entry
- Configurable per-project via `git_repository_url`

### 📋 ClickUp Integration *(Beta)*
- Sync tasks from ClickUp into TimeIn via the ClickUp API
- Select a ClickUp task when logging hours
- Store `related_clickup_task_id` on each time entry
- Local cache in `clickup_task_links` table for fast lookups

### 🔔 Notifications & Reminders
- In-app notification feed per user (approve/reject events)
- Configurable daily reminders via Slack webhook
- Reminder time controllable from admin settings

### 📤 Export & Payroll
- CSV and Excel export of time entries
- Payroll calculation: `hourly_rate × hours` per employee
- Role-scoped exports (employees see own data, managers see team, admins see all)

---

## 🛠 Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | React | 18.2.0 | UI & component library |
| **Routing** | React Router DOM | 6.21.0 | Client-side navigation |
| **HTTP Client** | Axios | 1.6.5 | API requests with auto JWT injection |
| **Charts** | Recharts | 2.10.0 | Dashboard statistics visualizations |
| **Backend** | Express.js | 4.18.2 | REST API & middleware |
| **Database** | PostgreSQL (Neon) | — | Relational data + serverless cloud hosting |
| **Auth** | JWT + bcryptjs | — | Token authentication + password hashing |
| **Validation** | express-validator | 7.0.1 | Input validation & sanitization |
| **Logging** | Morgan | 1.10.0 | HTTP request logging |
| **Dev Server** | nodemon | 3.0.2 | Auto-restart on file changes |
| **Deployment** | Vercel | — | Frontend CDN + serverless backend |
| **Task Sync** | ClickUp API | — | Task integration (beta) |
| **Code Linking** | GitHub API | — | Commit tracking & linking (beta) |
| **Messaging** | Slack Webhooks | — | Reminders & notifications |

```
                    ┌─────────────┐
                    │   Vercel    │  ← Deploy & CDN
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼──────┐          ┌───────▼──────┐
        │   React    │          │   Node.js    │  ← Express API
        │  Frontend  │◄────────►│   Backend    │
        │  (port 3000)│         │  (port 4000) │
        └────────────┘          └──────┬───────┘
                                       │
                          ┌────────────┼────────────┐
                          │            │             │
                   ┌──────▼───┐  ┌─────▼───┐  ┌────▼─────┐
                   │ Neon DB  │  │ ClickUp │  │  GitHub  │
                   │(Postgres)│  │  API β  │  │  API β   │
                   └──────────┘  └─────────┘  └──────────┘
                                       │
                                ┌──────▼──────┐
                                │    Slack    │  ← Webhooks
                                └─────────────┘
```

---

## 🗂 Data Model

```
Team ──────────────────────────────────── team_projects ──── Project
 │                                                                │
 │  (manager_id → User)                                          │
 │                                                            Task │
 │                                                                │
User ─────────────────────── TimeEntry ─────────────────────────┘
 │    (employee/manager/admin)   │   (draft/submitted/approved/rejected)
 │                               │
 │                               ├── GitCommit    (related_commit_ids[])
 │                               └── ClickUpTask  (related_clickup_task_id)
 │
 └── Notification
```

### Key Tables

| Table | Key Fields |
|---|---|
| `users` | `id`, `full_name`, `email`, `password_hash`, `role`, `team_id`, `hourly_rate`, `is_active` |
| `teams` | `id`, `name`, `manager_id` |
| `team_projects` | `team_id`, `project_id` — M:N junction |
| `projects` | `id`, `project_name`, `status`, `manager_id`, `git_repository_url`, `clickup_space_id` |
| `tasks` | `id`, `task_name`, `project_id`, `assigned_user_id`, `status`, `priority`, `estimated_hours`, `clickup_task_id` |
| `time_entries` | `id`, `user_id`, `project_id`, `task_id?`, `date`, `start_time`, `end_time`, `duration_minutes`, `work_type`, `description`, `source`, `status`, `related_commit_ids[]`, `related_clickup_task_id`, `approved_by`, `rejection_reason` |
| `git_commits` | `commit_hash`, `commit_message`, `commit_author_email`, `linked_user_id`, `linked_task_id`, `linked_time_entry_id` |
| `clickup_task_links` | `clickup_task_id`, `task_name`, `project_id`, `status`, `estimated_time`, `last_sync_date` |
| `notifications` | `id`, `user_id`, `message`, `link`, `is_read`, `created_at` |
| `settings` | `key`, `value` — e.g. `retroactive_allowed`, `retroactive_max_days`, `slack_webhook_url`, `reminder_hour` |
| `api_keys` | `id`, `name`, `key_hash`, `key_prefix`, `user_id`, `is_active`, `last_used` |

### Database Constraints & Triggers
- **Overlap prevention** — PostgreSQL `TRIGGER check_time_overlap()` blocks same-user overlapping entries per day
- **Role enum** — `role IN ('employee', 'manager', 'admin')`
- **Status flow** — `status IN ('draft', 'submitted', 'approved', 'rejected')`
- **Work type enum** — `work_type IN ('development', 'design', 'review', 'devops', 'meeting', 'qa', 'other')`
- **Cascade deletes** — Projects → Tasks, Teams → Users

---

## 🛡 Roles & Permissions

| Action | Employee | Manager | Admin |
|---|:---:|:---:|:---:|
| Log own hours | ✅ | ✅ | ✅ |
| Edit own entries | ✅ | ✅ | ✅ |
| View own history | ✅ | ✅ | ✅ |
| View team entries | ❌ | ✅ | ✅ |
| Approve / reject entries | ❌ | ✅ | ✅ |
| Export team data | ❌ | ✅ | ✅ |
| Manage users & teams | ❌ | ❌ | ✅ |
| Manage projects | ❌ | ❌ | ✅ |
| Configure integrations | ❌ | ❌ | ✅ |
| Manage API keys | ❌ | ❌ | ✅ |
| System settings | ❌ | ❌ | ✅ |

> **Role scoping** is enforced both in middleware (`requireRole()`) and at the SQL query level — employees always receive only their own rows, managers receive their team's rows, admins receive all rows.

---

## 🖥 Screens

| Screen | Route | Roles | Description |
|---|---|---|---|
| **Login** | `/login` | All | Email/password + Google OAuth |
| **Dashboard** | `/` | All | Daily/weekly/monthly summary, active timer, task breakdown chart, recent entries |
| **Log Time** | `/log-time` | All | Manual entry form + live timer with persistence |
| **My Entries** | `/my-entries` | All | Full history table — edit, delete, submit |
| **Management** | `/management` | Manager, Admin | Team overview, approval queue, drill-down by employee/project/date |
| **Projects** | `/projects` | Admin | Projects CRUD with Git & ClickUp config |
| **Teams** | `/teams` | Admin | Teams CRUD, member assignment, project mapping |
| **Integrations** | `/integrations` | Admin | Git & ClickUp connection status and mapping |

---

## 🔄 Entry Workflow

```
┌─────────┐    submit    ┌───────────┐    approve   ┌──────────┐
│  Draft  │ ──────────→ │ Submitted │ ───────────→ │ Approved │
└─────────┘             └───────────┘              └──────────┘
                               │
                               │ reject (with reason)
                               ↓
                         ┌──────────┐
                         │ Rejected │  → Employee can edit & resubmit
                         └──────────┘
```

Entries can originate from three sources stored in the `source` field:
- `manual` — filled in by the user on the Log Time page
- `timer` — generated automatically when the live timer is stopped
- `git` — created or linked via the Git integration

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- A [Neon](https://neon.tech) PostgreSQL database (or any Postgres instance)

### 1. Clone & Install

```bash
git clone https://github.com/Tamar-Winer/TimeIn_Multi_Tech_App_2026.git
cd timein

# Install backend dependencies
cd timein-backend && npm install

# Install frontend dependencies
cd ../timein-frontend && npm install
```

### 2. Configure Environment

**`timein-backend/.env`**
```env
PORT=4000
DATABASE_URL=postgresql://user:password@host/dbname
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**`timein-frontend/.env`**
```env
REACT_APP_API_URL=http://localhost:4000/api
REACT_APP_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### 3. Run

The backend auto-runs all database migrations on startup (no manual SQL needed).

```bash
# Terminal 1 — Backend
cd timein-backend
npm run dev        # nodemon on port 4000

# Terminal 2 — Frontend
cd timein-frontend
npm start          # React dev server on port 3000
```

### 4. Seed an Admin User

```bash
cd timein-backend
node src/db/seed_admin.js
```

---

## ✅ What's Built

| Feature | Status |
|---|---|
| Email/password auth with JWT | ✅ Done |
| Google OAuth login | ✅ Done |
| Role-based access control (Employee / Manager / Admin) | ✅ Done |
| Teams with multi-project assignment | ✅ Done |
| Projects & tasks management | ✅ Done |
| Manual time entry with validation | ✅ Done |
| Live timer with localStorage persistence | ✅ Done |
| Time entry approval workflow | ✅ Done |
| Employee dashboard with charts | ✅ Done |
| Manager view (drill-down, approval queue) | ✅ Done |
| Reports by user / project / task | ✅ Done |
| Role-scoped SQL queries | ✅ Done |
| PostgreSQL overlap-prevention trigger | ✅ Done |
| Retroactive logging policy (configurable) | ✅ Done |
| In-app notifications | ✅ Done |
| CSV / Excel export | ✅ Done |
| Payroll calculation (hourly rate × hours) | ✅ Done |
| API key management | ✅ Done |
| Git commit fetching & linking | ✅ Beta |
| ClickUp task sync | ✅ Beta |
| Slack reminders & webhooks | ✅ Beta |

---

## 🗺 Roadmap

```
MVP (complete)
 ├─ Manual time entry & live timer
 ├─ Role-based access (Employee / Manager / Admin)
 ├─ Teams with multi-project support
 ├─ Approval workflow (draft → submitted → approved/rejected)
 ├─ Dashboard with charts and reports
 ├─ Google OAuth
 └─ External ID fields (Git / ClickUp)

Phase 2
 ├─ Auto-match Git commits to time entries (AI-assisted)
 ├─ ClickUp full bi-directional task sync
 ├─ Gemini-powered commit → task suggestions
 └─ Real-time updates via WebSockets

Phase 3
 ├─ Estimate vs. actual comparison
 ├─ Advanced Excel reports
 └─ Mobile app

Future
 ├─ Multi-company / multi-tenant support
 ├─ External public API
 └─ Full payroll system integration
```

---

## ⚙️ Validation Rules

- Time entry **must** have a user, date, and project
- End time must be **after** start time — no negative durations
- **Overlapping entries** for the same user on the same day are blocked at the database level
- Task is **optional** on an entry (can be added or changed later)
- Retroactive logging window is **configurable** by the admin (`retroactive_max_days`)

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a pull request

---

<div align="center">

Built with care for teams who want to know where their time actually goes.

**[TimeIn](#)** · Report Issues · Request Features

</div>
