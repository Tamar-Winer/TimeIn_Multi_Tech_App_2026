# TimeIn – סקירה מלאה של הפרויקט

## מה הפרויקט עושה

TimeIn הוא מערכת ניהול שעות עבודה לחברות. המטרה שלו היא לגשר על הפער בין עבודה בפועל לבין דיווח שעות – על ידי סינכרון בין לוגים של שעות, commits בגיט, ומשימות ב-ClickUp, כל זה בתוך ממשק אחד.

**תרחיש שימוש טיפוסי:**
- עובד מתחיל טיימר ב-Dashboard, עובד, ואז עוצר
- המערכת יוצרת רשומת שעות שמקושרת לפרויקט, משימה, ו-commit בגיט
- מנהל רואה את הרשומה ומאשר / דוחה אותה
- מנהל מקבל דוחות: כמה שעות כל עובד עשה, על אילו פרויקטים, מה החריגות

---

## ארכיטקטורה

```
timein-frontend (React SPA)  ──HTTP──►  timein-backend (Node/Express)  ──►  PostgreSQL
                                                   │
                              ┌────────────────────┼────────────────────┐
                              ▼                    ▼                    ▼
                          GitHub API          ClickUp API         Slack Webhook
```

### Backend – `timein-backend/`

```
src/
├── app.js              ← Express app + CORS + middleware
├── server.js           ← נקודת כניסה, מריץ migrations בהרמה
├── config/db.js        ← Connection Pool ל-PostgreSQL
├── middleware/
│   ├── auth.js         ← JWT verification + requireRole()
│   └── errorHandler.js ← Global error handling
├── routes/             ← route per feature (15+ קבצים)
└── db/
    ├── schema.sql          ← סכמה ראשונית
    ├── schema_v2.sql       ← migration: hourly_rate, api_keys, settings
    └── migration_teams.sql ← migration: teams + team_projects
```

### Frontend – `timein-frontend/`

```
src/
├── api/        ← module per feature, כולם משתמשים ב-axios client
├── context/
│   ├── AuthContext.jsx   ← JWT + user state גלובלי
│   ├── TimerContext.jsx  ← טיימר עם localStorage persistence
│   └── ToastContext.jsx  ← הודעות toast
├── hooks/      ← custom hook לכל resource (useTimeEntries, useReports...)
├── pages/      ← page per role/feature
└── components/ ← UI generics (Card, Badge, Avatar, Spinner)
```

---

## טכנולוגיות

| קטגוריה | טכנולוגיה | גרסה |
|---|---|---|
| Frontend Framework | React | 18.2 |
| Routing | React Router DOM | 6.21 |
| HTTP Client | Axios | 1.6 |
| Charts | Recharts | 2.10 |
| Backend Framework | Express.js | 4.18 |
| Database | PostgreSQL | – |
| DB Client | node-postgres (pg) | 8.11 |
| Auth | JWT (jsonwebtoken) | 9.0 |
| Passwords | bcryptjs | 2.4 |
| Validation | express-validator | 7.0 |
| Logging | Morgan | 1.10 |
| Deployment | Vercel | – |
| External APIs | GitHub, ClickUp, Slack | – |

---

## סכמת בסיס הנתונים

### טבלאות מרכזיות

**`users`** – עובד / מנהל / אדמין, עם `team_id` + `hourly_rate`

**`projects`** – פרויקטים עם לינקים לגיט ולClickUp space

**`teams`** – צוותים. קשר M:N עם פרויקטים דרך `team_projects` (junction table)

**`tasks`** – משימות, עם status/priority ו-`clickup_task_id` לסנכרון

**`time_entries`** – הלב של המערכת:
- `start_time`, `end_time`, `duration_minutes`
- `source`: manual / timer / git / clickup / suggested
- `status`: draft → submitted → approved / rejected
- `related_commit_ids TEXT[]` – מערך של commit hashes
- **Trigger SQL** שמונע חפיפות שעות לאותו משתמש באותו יום

**`git_commits`** – commits מגיט, עם `linked_user_id` ו-`linked_task_id`

**`settings`** – key-value config: Slack webhook, retroactive policy, reminders

---

## Flow של אישור שעות

```
עובד יוצר רשומה (status: draft)
        │
        ▼
עובד מגיש (status: submitted)
        │
        ▼
מנהל מאשר/דוחה
   ┌────┴────┐
approved    rejected (עם סיבה)
                │
                ▼
         עובד מתקן ומגיש שוב
```

---

## מה מורכב בפרויקט

### 1. Role-Based Access Control (RBAC) בשאילתות SQL

הבעיה: אותו endpoint (`GET /reports`) צריך להחזיר נתונים שונים לגמרי לפי תפקיד:
- **עובד**: רק הנתונים שלו
- **מנהל**: רק הצוות שלו
- **אדמין**: כל הנתונים

הפתרון: בנייה דינמית של WHERE clause ב-JavaScript:

```js
// מ-reports.js
let whereClause = 'WHERE 1=1';
const params = [];

if (req.user.role === 'employee') {
  whereClause += ` AND te.user_id = $${params.length + 1}`;
  params.push(req.user.id);
} else if (req.user.role === 'manager') {
  whereClause += ` AND u.team_id IN (
    SELECT tp.team_id FROM team_projects tp
    JOIN teams t ON tp.team_id = t.id
    WHERE t.manager_id = $${params.length + 1}
  )`;
  params.push(req.user.id);
}
```

### 2. Trigger SQL למניעת חפיפות שעות

במקום לבדוק חפיפות ב-JavaScript, זה נאכף ברמת ה-DB:

```sql
CREATE OR REPLACE FUNCTION check_time_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM time_entries
    WHERE user_id = NEW.user_id
      AND date = NEW.date
      AND id != NEW.id
      AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
  ) THEN
    RAISE EXCEPTION 'Time overlap detected';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3. טיימר עם Persistence

הטיימר לא נאבד בריענון דף:

```js
// TimerContext.jsx
const [elapsed, setElapsed] = useState(() => {
  const saved = localStorage.getItem('timer_elapsed');
  const savedAt = localStorage.getItem('timer_saved_at');
  if (saved && savedAt) {
    const drift = (Date.now() - parseInt(savedAt)) / 1000;
    return parseInt(saved) + drift;  // מחשבים כמה זמן עבר מאז השמירה
  }
  return 0;
});
```

### 4. Migrations אוטומטיות בהרמה

`server.js` מריץ migration scripts בעת הפעלת השרת – כך שה-DB תמיד מעודכן ללא צורך בהרצה ידנית:

```js
// server.js
async function runMigrations() {
  await runMigration('teams', migrationTeams);
  await runMigration('notifications', migrationNotifications);
  await runMigration('settings', migrationSettings);
}
```

### 5. קישור Commit למשימה דרך Regex

המערכת מנתחת commit messages ומוצאת task IDs:

```js
const taskRef = message.match(/#(\d+)|([A-Z]+-\d+)/);
// תתאים ל-#123 או ל-TASK-123
```

### 6. Junction Table לצוותים ופרויקטים

צוות יכול להיות משויך למספר פרויקטים ופרויקט יכול להיות משויך למספר צוותים. זה מממש דרך `team_projects`:

```sql
CREATE TABLE team_projects (
  team_id    INT REFERENCES teams(id),
  project_id INT REFERENCES projects(id),
  PRIMARY KEY (team_id, project_id)
);
```

---

## דברים מעניינים לספר למראיין

### שאלות אדריכלות

**"למה בחרת PostgreSQL ולא MongoDB?"**
> כי הנתונים שלנו רלציוניים ביסודם – משתמש שייך לצוות, צוות שייך לפרויקטים, רשומת שעות שייכת למשתמש ולמשימה. JOIN-ים מורכבים ו-constraints כמו `time_entries.duration_minutes > 0` קל הרבה יותר לאכוף ב-SQL. גם ה-trigger למניעת חפיפות לא היה אפשרי ב-NoSQL.

**"למה Context API ולא Redux?"**
> הסטייט הגלובלי שלנו מוגבל: auth state, timer, ו-toasts. Redux זה overhead לא הכרחי כשיש לך 3 contexts. כל ה-data fetching מנוהל בcustom hooks שמקושרים לendpoints ספציפיים, אז אין צורך ב-store מרכזי.

**"איך אתה מטפל ב-authorization בצורה scalable?"**
> כל route מקבל `requireRole('manager', 'admin')` middleware. בפנים ה-route, הסטייט של `req.user.role` קובע מה ה-WHERE clause שייבנה. כך ה-business logic נשאר בשכבת ה-route ולא דולף ל-middleware.

### שאלות Implementation

**"מה הייתה הבאג הכי מסובכת שנתקלת בה?"**
> בניית ה-WHERE clause הדינמי לדוחות: שכחתי שמנהל יכול להיות manager של מספר צוותים, שכל אחד יכול להיות על מספר פרויקטים. כשהחלפתי JOIN רגיל ל-subquery על team_projects, הדוחות נכשלו בגלל שהפרמטרים ($1, $2...) לא הגיע בסדר הנכון. הצורך למנות ידנית את האינדקסים של ה-params מקורב ל-params.length + 1 בכל הוספה היה מקור לבאגים.

**"איך הגנת על endpoint-ים מ-SQL Injection?"**
> כל השאילתות משתמשות ב-parameterized queries של node-postgres. אין string concatenation של ערכי משתמש לתוך SQL. `express-validator` מנקה את הinput בכניסה.

**"איך תבנה את זה אחרת בפעם הבאה?"**
> הייתי מוסיף ORM כמו Prisma מהתחלה. הmigrations הידניות עם `schema_v2.sql` הפכו למסורבלות. גם הייתי מפריד את שכבת ה-service מה-routes – עכשיו יש business logic ישירות ב-route handlers.

### דברים שמראים depth

- **Security**: JWT נשמר ב-localStorage (trade-off: פשוט יותר, אבל פחות מאובטח מ-httpOnly cookie). בסביבת production הייתי עובר ל-httpOnly cookie.
- **Scalability**: Connection Pool ל-DB (לא חיבור חדש לכל request). גם indexes על `user_id`, `date`, `status` בטבלת `time_entries`.
- **UX**: הטיימר שורד ריענון דף כי המצב שלו נשמר ב-localStorage עם timestamp, וכשחוזרים מחשבים את ה-drift.
- **Business Rules ב-DB**: הtrigger למניעת חפיפות הוא הגנה ברמת DB, גם אם מישהו יקרא ל-API ישירות בלי את ה-frontend.

---

## מה אפשר להוסיף (roadmap)

- AI suggestions על בסיס commits וhistory
- Mobile app
- Slack bot לדיווח שעות ישירות מ-Slack
- Payroll export לקסל/חשבשבת
- WebSocket לעדכונים real-time (במקום polling)
- תמיכה ב-GitLab בנוסף ל-GitHub
