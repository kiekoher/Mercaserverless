import logger from './logger';

export function verifyCsrf(req, res) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieName = isProd ? '__Host-csrf-secret' : 'csrf-secret';

  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies?.[cookieName];

  if (!headerToken) {
    logger.warn('CSRF verification failed: Missing x-csrf-token header');
    res.status(403).json({ error: 'CSRF token missing from headers' });
    return false;
  }

  if (!cookieToken) {
    logger.warn('CSRF verification failed: Missing CSRF secret cookie');
    res.status(403).json({ error: 'CSRF secret missing' });
    return false;
  }

  if (headerToken !== cookieToken) {
    logger.warn('CSRF verification failed: Token mismatch');
    res.status(403).json({ error: 'Invalid CSRF token' });
    return false;
  }

  return true;
}
