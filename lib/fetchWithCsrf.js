function getCookie(name) {
  if (typeof document === 'undefined') return '';
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}

export default async function fetchWithCsrf(url, options = {}) {
  const opts = { ...options };
  opts.headers = { ...(options.headers || {}) };
  const method = (opts.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    const token = getCookie('csrf-token');
    if (token) {
      opts.headers['x-csrf-token'] = token;
    }
    if (!opts.headers['Content-Type']) {
      opts.headers['Content-Type'] = 'application/json';
    }
  }
  return fetch(url, opts);
}
