import cookie from 'cookie';
import { tokensMatch } from './tokensMatch';

export function getCsrfCookieName() {
  return process.env.NODE_ENV === 'production' ? '__Host-csrf-secret' : 'csrf-secret';
}

export function validateCsrfToken(req) {
  const headers = req.headers || {};
  const getHeader = typeof headers.get === 'function'
    ? (name) => headers.get(name)
    : (name) => headers[name.toLowerCase()];

  const cookieHeader = getHeader('cookie') || '';
  const token = getHeader('x-csrf-token');
  const cookies = cookie.parse(cookieHeader);
  const secret = cookies[getCsrfCookieName()];

  if (!secret) {
    return 'Missing CSRF cookie';
  }
  if (!token) {
    return 'Missing CSRF token';
  }
  if (!tokensMatch(secret, token)) {
    return 'CSRF token mismatch';
  }
  return null;
}
