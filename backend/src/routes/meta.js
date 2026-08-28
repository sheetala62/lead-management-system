const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { SERVICES, SOURCES, STATUSES, PRIORITIES, FOLLOWUP_TYPES } = require('../utils/validators');

const router = express.Router();

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let assignees = await db.all('SELECT id, name FROM assignees WHERE active = 1 ORDER BY name');
    if (assignees.length === 0)
      assignees = await db.all('SELECT id, name FROM assignees ORDER BY name');
    if (assignees.length === 0)
      assignees = [
        { id: 0, name: 'Unassigned' }, { id: 0, name: 'Rahul Sharma' },
        { id: 0, name: 'Priya Nair' }, { id: 0, name: 'Amit Verma' }, { id: 0, name: 'Sara Khan' },
      ];

    const tags = await db.all('SELECT * FROM tags ORDER BY name');

    res.json({
      success: true,
      data: {
        services:     SERVICES,
        sources:      SOURCES,
        statuses:     STATUSES,
        priorities:   PRIORITIES,
        followupTypes: FOLLOWUP_TYPES,
        assignees:    assignees.map(a => a.name),
        tags,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
