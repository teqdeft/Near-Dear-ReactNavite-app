const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs after an express-validator chain. Collects errors into a clean map.
 */
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = {};
  for (const e of result.array()) {
    const key = e.path || e.param || 'field';
    if (!errors[key]) errors[key] = e.msg;
  }
  return next(ApiError.badRequest('Validation failed', errors));
}

module.exports = { validate };
