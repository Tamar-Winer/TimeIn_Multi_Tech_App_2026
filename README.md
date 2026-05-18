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
![React](https://img.shields.io/badge/React-20232a?style=flat-square&logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00E5BF?style=flat-square&logo=neon&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat-square&logo=google-gemini&logoColor=white)
![ClickUp](https://img.shields.io/badge/ClickUp-7B68EE?style=flat-square&logo=clickup&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white)

</div>

---

## ✨ What is TimeIn?

TimeIn is a **work-hour reporting system** designed around the way developers actually work — by project, by task, and in relation to real code activity. It's not just a stopwatch. It's a bridge between your team's hours and their output.

```
Hours logged  →  Project context  →  Git commits  →  ClickUp tasks
     ↓                ↓                   ↓                ↓
  Audit trail    Manager view       Code linkage      Task sync
```

---

## 🎯 Core Features

### ⏱ Time Entry
- **Manual logging** — date, project, task, start/end or total duration
- **Live timer** — start/pause/stop with auto-generated time entry on completion
- **Draft & submit** workflow — save entries before sending for approval
- Overlap detection and validation built-in

### 📊 Employee Dashboard
- Today / this week / this month summary at a glance
- Breakdown by project and task
- Recent entries with quick edit/copy/delete
- Active timer always visible

### 🧑‍💼 Manager View
- Filter by employee, project, task, or date range
- Per-project and per-task hour breakdown
- Daily drill-down for any team member
- Anomaly detection: long entries, missing days, overlaps

### 🔗 GitHub Integration *(Phase 2)*
Pulls commits from **GitHub** and matches them to time entries by:
- Task ID in commit message
- Branch name
- Author email

> Commits are a supporting signal, not a replacement for time reports.

### 📋 ClickUp Integration *(Phase 2)*
- Sync tasks from ClickUp into TimeIn
- Select a ClickUp task when logging hours
- Store `ClickUpTaskId` directly in each `TimeEntry`
- Future: compare estimated vs. actual time

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | [React](https://react.dev) | UI & component library |
| **Backend** | [Node.js](https://nodejs.org) | REST API & business logic |
| **Database** | [PostgreSQL](https://www.postgresql.org) | Relational data storage |
| **DB Cloud** | [Neon](https://neon.tech) | Serverless Postgres hosting |
| **Deployment** | [Vercel](https://vercel.com) | Frontend & serverless functions |
| **AI** | [Gemini](https://deepmind.google/technologies/gemini/) | Smart suggestions & commit analysis |
| **Task Sync** | [ClickUp API](https://clickup.com/api) | Task integration |
| **Code Linking** | [GitHub API](https://docs.github.com/en/rest) | Commit tracking & linking |

```
                    ┌─────────────┐
                    │   Vercel    │  ← Deploy & CDN
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼──────┐          ┌───────▼──────┐
        │   React    │          │   Node.js    │  ← API
        │  Frontend  │◄────────►│   Backend    │
        └────────────┘          └──────┬───────┘
                                       │
                          ┌────────────┼────────────┐
                          │            │             │
                   ┌──────▼───┐  ┌─────▼───┐  ┌────▼─────┐
                   │ Neon DB  │  │ ClickUp │  │  GitHub  │
                   │(Postgres)│  │   API   │  │   API    │
                   └──────────┘  └─────────┘  └──────────┘
                                       │
                                ┌──────▼──────┐
                                │   Gemini    │  ← AI layer
                                └─────────────┘
```

---

## 🗂 Data Model

```
User ────────────────── TimeEntry ──────────── Project
 │                         │                      │
 │  (Employee/Manager/     │  (Draft/Submitted/   │
 │   Admin)                │   Approved/Rejected) │
 │                         │                      │
 └── Task ────────────────┘                       │
      │                                           │
      └───────────────────────────────────────────┘
      
TimeEntry also links to:
  ├── GitCommit     (RelatedCommitIds)
  └── ClickUpTask   (RelatedClickUpTaskId)
```

### Key Entities

| Entity | Key Fields |
|---|---|
| `User` | `UserId`, `FullName`, `Email`, `Role`, `Team`, `IsActive` |
| `Project` | `ProjectId`, `ProjectName`, `Status`, `ManagerId`, `GitRepoURL`, `ClickUpSpaceId` |
| `Task` | `TaskId`, `TaskName`, `ProjectId`, `AssignedUserId`, `EstimatedHours`, `ClickUpTaskId` |
| `TimeEntry` | `UserId`, `ProjectId`, `TaskId?`, `Date`, `StartTime`, `EndTime`, `DurationMinutes`, `Status`, `Source` |
| `GitCommit` | `CommitHash`, `CommitMessage`, `CommitAuthor`, `LinkedUserId`, `LinkedTaskId?` |

---

## 🛡 Roles & Permissions

| Action | Employee | Manager | Admin |
|---|:---:|:---:|:---:|
| Log own hours | ✅ | ✅ | ✅ |
| Edit own entries | ✅ | ✅ | ✅ |
| View own history | ✅ | ✅ | ✅ |
| View team entries | ❌ | ✅ | ✅ |
| Approve/reject entries | ❌ | ✅ | ✅ |
| Manage users & projects | ❌ | ❌ | ✅ |
| Configure integrations | ❌ | ❌ | ✅ |

---

## 🖥 Screens

| Screen | Description |
|---|---|
| **Login** | Email + password (SSO planned) |
| **Employee Dashboard** | Daily/weekly summary, active timer, quick log |
| **Log Time** | Project picker, task picker, time fields, notes |
| **My Entries** | Full history table with filters and bulk actions |
| **Manager Panel** | Team overview, reports, drill-down by employee/project |
| **Integrations** | Git & ClickUp connection status and mapping settings |

---

## 🔄 Entry Workflow

```
┌─────────┐    submit    ┌───────────┐    approve   ┌──────────┐
│  Draft  │ ──────────→ │ Submitted │ ───────────→ │ Approved │
└─────────┘             └───────────┘              └──────────┘
                               │
                               │ reject
                               ↓
                         ┌──────────┐
                         │ Rejected │
                         └──────────┘
```

> **MVP note:** approval flow is optional at launch — teams can start with direct submission and add approval gates later.

---

## 🚀 MVP Scope

### ✅ In MVP
- Users, roles, and basic permissions
- Projects and tasks management
- Manual time entry with validation
- Basic work timer (start / pause / stop)
- Employee personal view
- Manager overview with filters
- Date / employee / project / task filtering
- Basic hours report
- External `TaskId` field for ClickUp linkage
- Manual `CommitHash` field for Git linkage

### 🚫 Not in MVP
- Entry approval workflow
- Advanced notifications
- Full bidirectional ClickUp sync
- Smart commit-to-task auto-matching
- Advanced analytics & graphs
- Mobile app
- Billing / payroll integration

---

## 🗺 Roadmap

```
MVP (now)
 ├─ Manual time entry & timer
 ├─ Employee & manager views
 └─ External ID fields (Git / ClickUp)

Phase 2
 ├─ GitHub integration (commits → time entries)
 ├─ ClickUp full task sync
 ├─ Gemini-powered commit → task suggestions
 └─ Approval workflow

Phase 3
 ├─ Smart commit → task suggestions
 ├─ Estimate vs. actual comparison
 ├─ Excel / CSV export
 └─ Slack / Teams reminders

Future
 ├─ Multi-team / multi-company support
 ├─ External API
 └─ Payroll system integration
```

---

## ⚙️ Validation Rules

- Time entry **must** have a user, date, and project
- End time must be **after** start time — no negative durations
- Duplicate/overlapping entries for the same user trigger a **warning**
- Task is **optional** (can be added later in a post-MVP iteration)
- Retroactive logging is configurable per workspace by the admin

---

## ❓ Open Design Decisions

These are intentional open questions for the team to resolve:

1. Is a **task required** on every time entry, or optional?
2. Does the manager **approve** entries, or is submission enough?
3. **Live timer** or manual-only entry at launch?
4. Is ClickUp the **source of truth** for tasks, or just a reference?
5. Is Git a **display layer** or part of the core business logic?
6. Single team or **multi-tenant** from day one?
7. Should **retroactive logging** be allowed, and who can configure it?
8. Do we need **overtime / salary calculations** in scope?

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
