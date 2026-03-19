/**
 * Structured request logger middleware.
 * Logs method, path, status, and duration in JSON format.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    console[level](JSON.stringify({
      ts: new Date().toISOString(),
      level,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms,
    }));
  });

  next();
}
