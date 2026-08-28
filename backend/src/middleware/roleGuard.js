/**
 * roleGuard.js — Role-based access middleware.
 *
 * Usage:
 *   router.get('/admin-only', requireRole('admin'), handler);
 *   router.get('/staff-ok',   requireRole('admin','staff'), handler);
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorised.' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role.' });
    }
    next();
  };
}

module.exports = { requireRole };
