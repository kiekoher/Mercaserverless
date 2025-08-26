const cookie = require('cookie');
const logger = require('./logger.server');
const { requireUser } = require('./auth');
const { tokensMatch } = require('./tokensMatch');

/**
 * A higher-order function to wrap API handlers with structured logging and security checks.
 * It logs requests, handles CSRF protection, and ensures errors are caught.
 *
 * @param {Function} handler The original API handler function.
 * @returns {Function} The wrapped handler function.
 */
function withLogging(handler) {
  return async function (req, res) {
    const startTime = Date.now();
    const { method, url: path, headers } = req;

    // --- CSRF Protection ---
    const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (unsafeMethods.includes(method)) {
      const isProd = process.env.NODE_ENV === 'production';
      const cookieName = isProd ? '__Host-csrf-secret' : 'csrf-secret';
      const cookies = cookie.parse(headers.cookie || '');
      const secret = cookies[cookieName];
      const token = headers['x-csrf-token'];

      if (!secret || !token || !tokensMatch(secret, token)) {
        logger.error(
          { req: { method, path }, res: { statusCode: 403 } },
          'Invalid CSRF token'
        );
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
    }
    // --- End CSRF Protection ---

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
