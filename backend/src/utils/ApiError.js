/** Throwable error that carries an HTTP status code and optional field errors. */
class ApiError extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.isApiError = true;
  }

  static badRequest(msg, errors) {
    return new ApiError(400, msg || 'Bad request', errors);
  }
  static unauthorized(msg) {
    return new ApiError(401, msg || 'Unauthorized');
  }
  static forbidden(msg) {
    return new ApiError(403, msg || 'Forbidden');
  }
  static notFound(msg) {
    return new ApiError(404, msg || 'Not found');
  }
  static conflict(msg) {
    return new ApiError(409, msg || 'Conflict');
  }
}

module.exports = ApiError;
