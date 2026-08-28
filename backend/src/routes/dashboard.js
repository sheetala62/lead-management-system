const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// GET /api/dashboard/stats
router.get('/stats', async (req, res, next) => {
  try {
    // ── Core counts ──────────────────────────────────────────────────────────
    const totalRow = await db.get('SELECT COUNT(*) AS c FROM leads');
    const totalLeads = Number(totalRow.c);

    const byStatusRows = await db.all('SELECT lead_status, COUNT(*) AS count FROM leads GROUP BY lead_status');
    const byStatus = byStatusRows.reduce((a, r) => { a[r.lead_status] = Number(r.count); return a; }, {});

    const valueRow = await db.get(
      `SELECT COALESCE(SUM(estimated_value), 0) AS total FROM leads WHERE lead_status NOT IN ('Won', 'Lost')`
    );
    const wonValueRow = await db.get(
      `SELECT COALESCE(SUM(estimated_value), 0) AS total FROM leads WHERE lead_status = 'Won'`
    );

    const byServiceRows = await db.all('SELECT service_required, COUNT(*) AS count FROM leads GROUP BY service_required');
    const byService = byServiceRows.reduce((a, r) => { a[r.service_required] = Number(r.count); return a; }, {});

    // ── Priority breakdown ────────────────────────────────────────────────────
    const byPriorityRows = await db.all('SELECT priority, COUNT(*) AS count FROM leads GROUP BY priority');
    const byPriority = byPriorityRows.reduce((a, r) => { a[r.priority] = Number(r.count); return a; }, {});

    // ── Monthly trend — last 6 months ─────────────────────────────────────────
    const monthlyRows = await db.all(`
      SELECT TO_CHAR(created_at, 'Mon YY') AS month,
             TO_CHAR(created_at, 'YYYY-MM') AS month_key,
             COUNT(*) AS count
      FROM leads
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY month, month_key
      ORDER BY month_key ASC
    `);

    // ── Top assignees ─────────────────────────────────────────────────────────
    const assigneeRows = await db.all(`
      SELECT assigned_to,
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE lead_status = 'Won') AS won
      FROM leads
      GROUP BY assigned_to
      ORDER BY total DESC
      LIMIT 5
    `);

    // ── Conversion funnel (pipeline stage counts in order) ────────────────────
    const funnelStages = ['New', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won'];
    const funnel = funnelStages.map(s => ({ stage: s, count: byStatus[s] || 0 }));

    // ── Recent activity ───────────────────────────────────────────────────────
    const recentActivity = await db.all(`
      SELECT a.*, l.lead_name, l.company_name
      FROM lead_activity a
      JOIN leads l ON l.id = a.lead_id
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    // ── This week vs last week ────────────────────────────────────────────────
    const thisWeekRow = await db.get(
      `SELECT COUNT(*) AS c FROM leads WHERE created_at >= DATE_TRUNC('week', NOW())`
    );
    const lastWeekRow = await db.get(
      `SELECT COUNT(*) AS c FROM leads
       WHERE created_at >= DATE_TRUNC('week', NOW()) - INTERVAL '1 week'
         AND created_at <  DATE_TRUNC('week', NOW())`
    );

    res.json({
      success: true,
      data: {
        totalLeads,
        newLeads:             byStatus['New']          || 0,
        contacted:            byStatus['Contacted']    || 0,
        proposalSent:         byStatus['Proposal Sent']|| 0,
        negotiation:          byStatus['Negotiation']  || 0,
        won:                  byStatus['Won']           || 0,
        lost:                 byStatus['Lost']          || 0,
        potentialBusinessValue: Number(valueRow.total),
        wonValue:               Number(wonValueRow.total),
        leadsByStatus:  byStatus,
        leadsByService: byService,
        leadsByPriority: byPriority,
        monthlyTrend:   monthlyRows.map(r => ({ month: r.month, count: Number(r.count) })),
        topAssignees:   assigneeRows.map(r => ({
          name:  r.assigned_to,
          total: Number(r.total),
          won:   Number(r.won),
          rate:  r.total > 0 ? Math.round((r.won / r.total) * 100) : 0,
        })),
        conversionFunnel: funnel,
        recentActivity,
        thisWeek: Number(thisWeekRow.c),
        lastWeek: Number(lastWeekRow.c),
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
