const { AppError } = require("../utils/errors");
const { logger } = require("../logger");

function notFound(req, res, next) {
  next(new AppError("Route not found", 404, "not_found"));
}

function errorHandler(err, req, res, next) {
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
