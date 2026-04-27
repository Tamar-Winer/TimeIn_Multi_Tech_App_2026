-- הוספת תמיכה ב-Google OAuth
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(100) UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
