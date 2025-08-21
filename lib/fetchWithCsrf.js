import { useCsrf } from '../context/Csrf';
import { useCallback } from 'react';
import logger from './logger.client';

/**
 * A hook that returns a function for making fetch requests with CSRF protection.
 * This should be used for all state-changing API calls (POST, PUT, DELETE, etc.).
 *
 * @returns {function(string, object): Promise<Response>} A function that behaves like `fetch`.
 */
export function useCsrfFetcher() {
  const { csrfToken } = useCsrf();

  return useCallback(async (url, options = {}) => {
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

    return fetch(url, opts);
  }, [csrfToken]);
}
