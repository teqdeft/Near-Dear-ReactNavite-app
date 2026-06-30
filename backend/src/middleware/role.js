const ApiError = require('../utils/ApiError');

/**
 * Role-based access control. Usage: router.get('/x', authenticate, requireRole('admin'))
 * Pass one or more allowed roles.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

module.exports = { requireRole };
