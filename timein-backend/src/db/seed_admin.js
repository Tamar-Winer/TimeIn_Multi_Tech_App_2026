// הרץ: node src/db/seed_admin.js  (מתוך timein-backend)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('../config/db');

(async () => {
  try {
    const hash = await bcrypt.hash('Winer4852', 10);
    await pool.query(`
      INSERT INTO users (full_name, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, 'admin', TRUE)
      ON CONFLICT (email) DO UPDATE
        SET full_name     = EXCLUDED.full_name,
            password_hash = EXCLUDED.password_hash,
            role          = 'admin',
            is_active     = TRUE
    `, ['TamarWiner', 'winer4852@gmail.com', hash]);
    console.log('✓ משתמש admin נוצר/עודכן בהצלחה');
    console.log('  שם: TamarWiner');
    console.log('  אימייל: winer4852@gmail.com');
    console.log('  סיסמה: Winer4852');
    console.log('  תפקיד: admin');
  } catch (err) {
    console.error('✗ שגיאה:', err.message);
  } finally {
    await pool.end();
  }
})();
