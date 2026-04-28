const { AppError } = require("../utils/errors");
const { logger } = require("../logger");

function isDbConnectionError(err) {
  // AggregateError from pg-pool when PostgreSQL isn't running
  if (err && err.code === "ECONNREFUSED") return true;
  if (err && Array.isArray(err.errors)) {
    return err.errors.some(e => e && e.code === "ECONNREFUSED");
  }
  return false;
}

function notFound(req, res, next) {
  next(new AppError("Route not found", 404, "not_found"));
}

function errorHandler(err, req, res, next) {
  // Gracefully handle "PostgreSQL not running" — return empty data rather than 500
  if (isDbConnectionError(err)) {
    logger.warn({ requestId: req.id }, "Database unavailable (ECONNREFUSED) — returning empty result");
    return res.json({ data: [], meta: { status: "db_unavailable" } });
  }

  const isAppError = err instanceof AppError;
  const status = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : "internal_error";
  const message = isAppError ? err.message : "Internal Server Error";
  const requestId = req.id || null;

  if (status >= 500) {
    logger.error({ err, requestId }, "Unhandled error");
  } else {
    logger.warn({ err, requestId }, "Request error");
  }

  res.status(status).json({
    error: {
      code,
      message,
      requestId
    }
  });
}

module.exports = {
  notFound,
  errorHandler
};
