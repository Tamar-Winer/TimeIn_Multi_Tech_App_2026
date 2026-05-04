
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: true,
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
