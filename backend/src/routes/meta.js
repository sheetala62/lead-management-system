const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { SERVICES, SOURCES, STATUSES, FOLLOWUP_TYPES } = require('../utils/validators');

const router = express.Router();

// GET /api/meta - all dropdown options in one call
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let assignees = await db.all('SELECT id, name FROM assignees WHERE active = 1 ORDER BY name');
    
    // Fallback: if no active assignees, get all assignees
    if (assignees.length === 0) {
      assignees = await db.all('SELECT id, name FROM assignees ORDER BY name');
    }
    
    // Final fallback: ensure we always return the standard defaults
    if (assignees.length === 0) {
      assignees = [
        { id: 0, name: 'Unassigned' },
        { id: 0, name: 'Rahul Sharma' },
        { id: 0, name: 'Priya Nair' },
        { id: 0, name: 'Amit Verma' },
        { id: 0, name: 'Sara Khan' },
      ];
    }
    
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
