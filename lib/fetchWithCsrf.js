import { useCsrf } from '../context/Csrf';
import { useCallback } from 'react';
import logger from './logger.client';

/**
 * A hook that returns a function for making fetch requests with CSRF protection.
 * This should be used for all state-changing API calls (POST, PUT, DELETE, etc.).
 *
 * @returns {function(string, object): Promise<Response>} A function that behaves like `fetch`.
 */
export async function fetchWithCsrf(url, options = {}, csrfToken, setCsrfToken) {
  const opts = { ...options };
  opts.headers = { ...(options.headers || {}) };
  const method = (opts.method || 'GET').toUpperCase();

  if (method !== 'GET' && method !== 'HEAD') {
    if (!csrfToken) {
      logger.error('CSRF token is not available. Aborting request.');
      throw new Error('CSRF token not available. Request cannot be sent.');
    }
    opts.headers['x-csrf-token'] = csrfToken;
    if (!opts.headers['Content-Type']) {
      opts.headers['Content-Type'] = 'application/json';
    }
  }

  let res = await fetch(url, opts);
  if (res.status === 403) {
    try {
      const data = await res.clone().json();
      if (data?.error && data.error.toLowerCase().includes('csrf')) {
        const refresh = await fetch('/api/csrf', { credentials: 'same-origin', cache: 'no-store' });
        if (refresh.ok) {
          const { csrfToken: newToken } = await refresh.json();
          setCsrfToken(newToken);
          opts.headers['x-csrf-token'] = newToken;
          res = await fetch(url, opts);
        }
      }
    } catch (e) {
      // ignore parsing errors
    }
  }
  return res;
}

export function useCsrfFetcher() {
  const { csrfToken, setCsrfToken } = useCsrf();

  return useCallback((url, options = {}) => fetchWithCsrf(url, options, csrfToken, setCsrfToken), [csrfToken, setCsrfToken]);
}
