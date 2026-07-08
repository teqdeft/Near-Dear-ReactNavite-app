const config = require('../config');
const { fail } = require('../utils/response');

// 404 handler for unknown routes.
function notFound(req, res) {
  return fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

// Central error handler.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.isApiError || status < 500 ? err.message : 'Internal server error';

  if (status >= 500) {
    // Log unexpected errors for debugging.
    // eslint-disable-next-line no-console
    console.error('[ERROR]', err);
  }

  const body = { success: false, message, code: err.code || null, errors: err.errors || null };
  if (config.env !== 'production' && status >= 500) {
    body.stack = err.stack;
  }
  return res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
