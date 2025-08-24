const logger = require('./logger.server');
const { requireUser } = require('./auth');

/**
 * A higher-order function to wrap API handlers with structured logging.
 * It logs the start and end of each request, including context like user,
 * status code, and duration.
 *
 * @param {Function} handler The original API handler function.
 * @returns {Function} The wrapped handler function.
 */
function withLogging(handler) {
  return async function (req, res) {
    const startTime = Date.now();
    const { method, url: path } = req;

    // We try to get user info for logging, but we don't block the request if it fails.
    // The actual route handler is still responsible for authorization.
    const { user } = await requireUser(req, res);

    // Ensure API responses are not cached by browsers or proxies
    res.setHeader('Cache-Control', 'no-store');

    logger.info({
      req: { method, path },
      user: { id: user?.id },
    }, `[API] Request received: ${method} ${path}`);

    // By wrapping the original end function, we can capture the status code
    // and log it just before the response is sent.
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
      const duration = Date.now() - startTime;
      logger.info({
        req: { method, path },
        res: { statusCode: res.statusCode },
        user: { id: user?.id },
        duration,
      }, `[API] Request finished: ${method} ${path} -> ${res.statusCode} in ${duration}ms`);
      res.end = originalEnd;
      res.end(chunk, encoding);
    };

    try {
      await handler(req, res);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({
        err: error,
        req: { method, path },
        user: { id: user?.id },
        duration,
      }, `[API] Unhandled error in ${method} ${path} after ${duration}ms`);

      // Ensure a response is sent for unhandled errors
      if (!res.writableEnded) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  };
}

module.exports = { withLogging };
