
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: (origin, cb) => {
    // allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return cb(null, true);
    const allowed = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allowed.length === 0 || allowed.some(u => origin.startsWith(u))) return cb(null, true);
    // in production also allow any vercel.app subdomain
    if (process.env.NODE_ENV === 'production' && origin.includes('.vercel.app')) return cb(null, true);
    cb(null, true); // permissive fallback for development
  },
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/auth',         require('./routes/googleAuth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/teams',        require('./routes/teams'));
app.use('/api/projects',     require('./routes/projects'));
app.use('/api/tasks',        require('./routes/tasks'));
app.use('/api/time-entries', require('./routes/timeEntries'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/integrations',  require('./routes/integrations'));
app.use('/api/clickup',       require('./routes/clickup'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/export',       require('./routes/export'));
app.use('/api/payroll',      require('./routes/payroll'));
app.use('/api/api-keys',     require('./routes/apiKeys'));
app.use('/api/slack',        require('./routes/slack'));
app.use('/api/reminders',    require('./routes/reminders'));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.use(require('./middleware/errorHandler'));
module.exports = app;
