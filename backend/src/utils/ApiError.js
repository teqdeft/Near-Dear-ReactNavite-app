/** Throwable error that carries an HTTP status code and optional field errors. */
class ApiError extends Error {
  // `code` is an optional machine-readable identifier (e.g. 'ACCOUNT_BLOCKED')
  // so clients can react to a specific error without matching on the message.
  constructor(status, message, errors = null, code = null) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.code = code;
    this.isApiError = true;
  }

  static badRequest(msg, errors) {
    return new ApiError(400, msg || 'Bad request', errors);
  }
  static unauthorized(msg, code) {
    return new ApiError(401, msg || 'Unauthorized', null, code);
  }
  static forbidden(msg, code) {
    return new ApiError(403, msg || 'Forbidden', null, code);
  }
  static notFound(msg) {
    return new ApiError(404, msg || 'Not found');
  }
  static conflict(msg) {
    return new ApiError(409, msg || 'Conflict');
  }
}

module.exports = ApiError;
