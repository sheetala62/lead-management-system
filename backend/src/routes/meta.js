const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { SERVICES, SOURCES, STATUSES, FOLLOWUP_TYPES } = require('../utils/validators');

const router = express.Router();

// GET /api/meta - all dropdown options in one call
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const assignees = await db.all('SELECT id, name FROM assignees WHERE active = 1 ORDER BY name');
    res.json({
      success: true,
      data: {
        services: SERVICES,
        sources: SOURCES,
        statuses: STATUSES,
        followupTypes: FOLLOWUP_TYPES,
        assignees: assignees.map((a) => a.name),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
