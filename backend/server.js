require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/auth');
const leadRoutes = require('./src/routes/leads');
const followupRoutes = require('./src/routes/followups');
const dashboardRoutes = require('./src/routes/dashboard');
const metaRoutes = require('./src/routes/meta');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Health check - useful for deployment platforms and quick sanity checks
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'LMS API is running', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/leads/:id/followups', followupRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/meta', metaRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`LMS backend running on http://localhost:${PORT}`);
});
