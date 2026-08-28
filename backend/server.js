require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes     = require('./src/routes/auth');
const leadRoutes     = require('./src/routes/leads');
const followupRoutes = require('./src/routes/followups');
const noteRoutes     = require('./src/routes/notes');
const tagRoutes      = require('./src/routes/tags');
const activityRoutes = require('./src/routes/activity');
const filterRoutes   = require('./src/routes/filters');
const dashboardRoutes= require('./src/routes/dashboard');
const metaRoutes     = require('./src/routes/meta');
const exportRoutes   = require('./src/routes/export');
const importRoutes   = require('./src/routes/import');
const userRoutes     = require('./src/routes/users');
const adminRoutes    = require('./src/routes/admin');
const settingsRoutes = require('./src/routes/settings');

const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) =>
  res.json({ success: true, message: 'LMS API is running', time: new Date().toISOString() })
);

// ── Auth ──────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ── Leads + sub-resources ─────────────────────────────────────────────────────
app.use('/api/leads', leadRoutes);
app.use('/api/leads/:id/followups', followupRoutes);
app.use('/api/leads/:id/notes',     noteRoutes);
app.use('/api/leads/:id/tags',      tagRoutes);
app.use('/api/leads/:id/activity',  activityRoutes);

// ── Global standalone ─────────────────────────────────────────────────────────
app.use('/api/tags',      tagRoutes);
app.use('/api/activity',  activityRoutes);
app.use('/api/filters',   filterRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/meta',      metaRoutes);
app.use('/api/export',    exportRoutes);
app.use('/api/import',    importRoutes);

// ── User / Admin / Settings ───────────────────────────────────────────────────
app.use('/api/users',    userRoutes);      // profile + staff management
app.use('/api/admin',    adminRoutes);     // audit logs, login history, stats
app.use('/api/settings', settingsRoutes);  // company settings + email templates

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`LMS backend running on http://localhost:${PORT}`);
});
