class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function badRequest(message, code) {
  return new AppError(message, 400, code || "bad_request");
}

function unauthorized(message, code) {
  return new AppError(message, 401, code || "unauthorized");
}

function forbidden(message, code) {
  return new AppError(message, 403, code || "forbidden");
}

function notFound(message, code) {
  return new AppError(message, 404, code || "not_found");
}

function databaseUnavailable(message, code) {
  return new AppError(message, 503, code || "database_unavailable");
}

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  databaseUnavailable
};
