
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/auth',         require('./routes/googleAuth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/projects',     require('./routes/projects'));
app.use('/api/tasks',        require('./routes/tasks'));
app.use('/api/time-entries', require('./routes/timeEntries'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/integrations', require('./routes/integrations'));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.use(require('./middleware/errorHandler'));
module.exports = app;
