/**
 * Global Express error-handling middleware.
 *
 * Must be registered LAST with `app.use(errorHandler)`.
 * Catches all errors thrown or passed via `next(err)` and returns a
 * uniform, sanitized JSON response. Stack traces are only exposed in
 * development mode.
 */

const logger = require('../config/logger');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // ── Determine status code ──────────────────────────────────────────────
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((e) => e.message);
    message = `Validation failed: ${messages.join(', ')}`;
  }

  // Mongoose duplicate key (e.g. unique email)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern).join(', ');
    message = `Duplicate value for field: ${field}`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  }

  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large. Maximum size is 10 MB.';
    }
  }

  // ── Log ────────────────────────────────────────────────────────────────
  logger.error(message, {
    statusCode,
    method: req.method,
    url: req.originalUrl,
    stack: err.stack,
  });

  // ── Respond ────────────────────────────────────────────────────────────
  const isProd = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    message,
    ...(isProd ? {} : { stack: err.stack }),
  });
};

module.exports = errorHandler;
