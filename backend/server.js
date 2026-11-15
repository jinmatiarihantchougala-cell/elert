require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : true, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/contacts', require('./routes/contactRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/police', require('./routes/policeRoutes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'API route not found' });
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.use((error, req, res, next) => {
  if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
  if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid resource identifier' });
  if (error.code === 11000) return res.status(409).json({ message: 'A record with that value already exists' });
  console.error(error);
  res.status(error.status || 500).json({ message: error.status ? error.message : 'Internal server error' });
});

const PORT = Number(process.env.PORT || 5000);

async function start() {
  await connectDB();
  return app.listen(PORT, () => console.log(`Silent SOS server listening on http://localhost:${PORT}`));
}

if (require.main === module) start().catch(error => {
  console.error('Unable to start server:', error.message);
  process.exit(1);
});

module.exports = app;
