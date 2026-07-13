/**
 * Vercel serverless entrypoint.
 *
 * Vercel never runs a long-lived process, so it cannot use src/server.js (which
 * calls app.listen). It invokes this handler once per request instead.
 * src/server.js is untouched and still drives local development.
 */
const app = require('../src/app');

module.exports = app;
