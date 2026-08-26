const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// GET /api/dashboard/stats
// All numbers are computed live from the leads table - never hard-coded.
router.get('/stats', async (req, res, next) => {
  try {
    const totalLeads = (await db.get('SELECT COUNT(*) AS c FROM leads')).c;

    const byStatusRows = await db.all(`
      SELECT lead_status, COUNT(*) AS count
      FROM leads
      GROUP BY lead_status
    `);

    const byStatus = byStatusRows.reduce((acc, r) => {
      acc[r.lead_status] = r.count;
      return acc;
    }, {});

    const potentialValueRow = await db.get(`
      SELECT COALESCE(SUM(estimated_value), 0) AS total
      FROM leads
      WHERE lead_status NOT IN ('Won', 'Lost')
    `);

    const byServiceRows = await db.all(`
      SELECT service_required, COUNT(*) AS count
      FROM leads
      GROUP BY service_required
    `);

    res.json({
      success: true,
      data: {
        totalLeads,
        newLeads: byStatus['New'] || 0,
        proposalSent: byStatus['Proposal Sent'] || 0,
        won: byStatus['Won'] || 0,
        lost: byStatus['Lost'] || 0,
        contacted: byStatus['Contacted'] || 0,
        negotiation: byStatus['Negotiation'] || 0,
        potentialBusinessValue: potentialValueRow.total,
        leadsByStatus: byStatus,
        leadsByService: byServiceRows.reduce((acc, r) => {
          acc[r.service_required] = r.count;
          return acc;
        }, {}),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
