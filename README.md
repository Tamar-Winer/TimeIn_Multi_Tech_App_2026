# 🕒 TimeIn - Smart Work Hours Management System

![Version](https://img.shields.io/badge/version-1.0.0--MVP-blue)
![License](https://img.shields.io/badge/license-MIT-green)

[cite_start]**TimeIn** היא מערכת מתקדמת לניהול, דיווח ובקרה של שעות עבודה, המיועדת לספק פתרון מקצה לקצה עבור צוותי פיתוח[cite: 1, 2]. [cite_start]המערכת מייצרת סנכרון מושלם בין דיווחי השעות בפועל לבין תוצרי העבודה במערכות הניהול והפיתוח הארגוניות[cite: 21, 22].

---

## 🚀 חזון הפרויקט
[cite_start]מטרת המערכת היא להחליף את דיווחי השעות הידניים והמיושנים בכלי חכם המשלב נתונים בזמן אמת מתוך סביבת העבודה של המפתח[cite: 3, 4]. המערכת מאפשרת:
- [cite_start]**שקיפות מלאה:** חיבור ישיר בין שעות עבודה ל-Commits ב-Git ולמשימות ב-ClickUp[cite: 9, 27].
- [cite_start]**אמינות נתונים:** צמצום טעויות אנוש באמצעות טיימרים חכמים וזיהוי אוטומטי של פעילות[cite: 13, 232].
- [cite_start]**בקרה ניהולית:** דוחות מתקדמים לניתוח יעילות וזיהוי חריגות[cite: 49, 213].

---

## 🛠 הטכנולוגיות בשימוש (Tech Stack)

### Backend (Node.js & Express)
- [cite_start]**Runtime:** Node.js [cite: 137]
- **API:** RESTful API המספק שירותים מאובטחים לניהול משתמשים, פרויקטים ודיווחי שעות.
- [cite_start]**Database:** PostgreSQL/MongoDB (ניתן להתאמה) לניהול ישויות המערכת: משתמשים, משימות, פרויקטים ודיווחי שעות[cite: 62].
- [cite_start]**Integrations:** עבודה מול ה-APIs של GitHub/GitLab ו-ClickUp[cite: 223, 242].

### Frontend (React.js)
- **Framework:** React עם שימוש ב-Hooks ו-Context API לניהול מצב גלובלי.
- [cite_start]**UI/UX:** עיצוב מודרני המותאם לדשבורד ניהולי וממשק דיווח מהיר לעובד[cite: 257, 275].
- **State Management:** Redux Toolkit או React Query לסנכרון נתונים מול השרת.

---

## 📋 תכונות עיקריות (Key Features)

### 👤 ממשק עובד (Employee Suite)
- [cite_start]**דיווח גמיש:** הזנה ידנית של שעות או שימוש בטיימר (Start/Pause/Stop)[cite: 152, 159].
- [cite_start]**חיבור לתוצרים:** קישור דיווח שעה ישירות ל-Commit Hash או ל-Task ID מ-ClickUp[cite: 40, 108].
- [cite_start]**מרכז בקרה אישי:** צפייה בסיכומי שעות יומיים, שבועיים וחודשיים[cite: 169, 171].

### 👨‍💼 ממשק מנהל (Management Suite)
- [cite_start]**Dashboard ניהולי:** צפייה בסטטוס הצוות בזמן אמת - מי עובד על מה ובאיזה פרויקט[cite: 176, 179].
- [cite_start]**אישור דיווחים:** מנגנון Workflow לאישור (Approve) או דחייה (Reject) של דיווחי שעות[cite: 51, 107].
- [cite_start]**מנוע דוחות:** הפקת דוחות חריגות, ניצולת פרויקטים וסיכומי שעות לפי עובד[cite: 193, 213].

### ⚙️ אינטגרציות (Deep Integrations)
- [cite_start]**Git Sync:** משיכת קומיטים לפי אימייל המשתמש והצגת פערים בין דיווח השעות לפעילות הקוד בפועל[cite: 223, 233].
- [cite_start]**ClickUp Connectivity:** סנכרון משימות בזמן אמת מאפשר בחירת משימה מתוך רשימה קיימת בעת הדיווח[cite: 242, 244].

---

## 🏗 מבנה הנתונים (Core Entities)
המערכת מבוססת על ארכיטקטורת נתונים חזקה הכוללת:
- [cite_start]**User:** ניהול תפקידים (Admin, Manager, Employee)[cite: 63, 69].
- [cite_start]**Project:** ניהול פרויקטים עם קישור למאגרי קוד ולוחות משימות[cite: 72, 79].
- [cite_start]**TimeEntry:** הישות המרכזית הכוללת זמני התחלה/סיום, משך זמן, סוג עבודה וקישורים חיצוניים[cite: 92, 106].

---

## 🗺 מפת דרכים (Roadmap - MVP & Beyond)

### [cite_start]שלב 1: MVP (מיושם) [cite: 281]
- ניהול משתמשים והרשאות בסיסי.
- דיווח שעות ידני וטיימר פשוט.
- חיבור בסיסי ל-ClickUp ו-Git (הזנת IDs ידנית).
- דוחות שעות בסיסיים.

### [cite_start]שלב 2: Next Steps (בתכנון) [cite: 282, 283]
- **AI Suggestions:** הצעה אוטומטית לדיווחי שעות על בסיס פעילות ב-Git.
- **Mobile App:** אפליקציה ייעודית לדיווח מהיר מהשטח.
- **Payroll Integration:** חיבור למערכות שכר וייצוא נתונים ל-CSV/Excel.
- **Slack/Teams Bot:** קבלת התראות ודיווח שעות ישירות מהצ'אט הארגוני.

---

## 🔧 התקנה והרצה מקומית

1. **שכפול הפרויקט:**
   ```bash
   git clone [https://github.com/your-username/TimeIn.git](https://github.com/your-username/TimeIn.git)