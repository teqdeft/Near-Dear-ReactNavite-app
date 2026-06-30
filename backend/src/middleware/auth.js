const { verifyAccessToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const db = require('../db/knex');
const { USER_STATUS } = require('../constants/enums');

/**
 * Requires a valid Bearer access token. Loads the user and attaches it to req.user.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized('Missing access token');

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (e) {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    const user = await db('users').where({ id: decoded.sub }).first();
    if (!user) throw ApiError.unauthorized('User no longer exists');
    if (user.status === USER_STATUS.BLOCKED) throw ApiError.forbidden('Your account is blocked');
    if (user.status === USER_STATUS.DELETED) throw ApiError.unauthorized('Account deleted');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
