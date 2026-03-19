/**
 * Global error handler middleware.
 * Catches all errors thrown in route handlers (via next(err) or async throws).
 *
 * Usage in routes: throw new AppError('message', 400)
 * Or just throw any Error — it becomes a 500.
 */
export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  // Always log the full error server-side
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'error',
    method: req.method,
    path: req.path,
    status,
    message: err.message,
    stack: status === 500 ? err.stack : undefined,
  }));

  res.status(status).json({ error: message });
}
