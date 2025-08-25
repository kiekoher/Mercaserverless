import { middleware } from '../middleware';
import { NextResponse } from 'next/server';
import { createMocks } from 'node-mocks-http';

// Mock Supabase client
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }), // Default to unauthenticated
    },
  })),
}));
const { createServerClient } = require('@supabase/ssr');

// Mock a helper function used in CSRF check
jest.mock('../lib/tokensMatch', () => ({
  tokensMatch: jest.fn((a, b) => a === b),
}));

const getMockReq = (url, options = {}) => {
  const { req } = createMocks({
    method: 'GET',
    url,
    ...options,
  });

  const urlObject = new URL(url, 'http://localhost');
  req.nextUrl = urlObject;
  req.nextUrl.clone = () => new URL(req.nextUrl.href);

  req.cookies = {
    _raw: options.cookies || {},
    get: function(name) {
      return this._raw[name] ? { name, value: this._raw[name] } : undefined;
    },
    ...options.cookies,
  };

  return req;
}

describe('Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // process.env is now handled by jest.setup-env.js
  });

  describe('Security Headers', () => {
    it('should add security headers to the response', async () => {
      const req = getMockReq('/dashboard');
      const response = await middleware(req);
      expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
      expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=63072000');
      expect(response.headers.get('Content-Security-Policy')).toContain('default-src \'self\'');
    });
  });

  describe('Authentication Logic', () => {
    it('should redirect unauthenticated users from a protected page to /login', async () => {
      const req = getMockReq('/dashboard');
      const response = await middleware(req);
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get('Location')).pathname).toBe('/login');
    });

    it('should allow unauthenticated users to access the /login page', async () => {
      const req = getMockReq('/login');
      const response = await middleware(req);
      expect(response.status).toBe(200);
    });

    it('should redirect authenticated users from /login to /dashboard', async () => {
      createServerClient.mockImplementation(() => ({
        auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: '123' } } } }) },
      }));
      const req = getMockReq('/login');
      const response = await middleware(req);
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get('Location')).pathname).toBe('/dashboard');
    });
  });

  describe('CSRF Protection', () => {
    it('should block POST requests to API routes without CSRF token', async () => {
      const req = getMockReq('/api/some-endpoint', {
        method: 'POST',
        cookies: { 'csrf-secret': 'some-secret' },
      });
      const response = await middleware(req);
      expect(response.status).toBe(403);
    });

    it('should block POST requests with mismatched CSRF tokens', async () => {
      const req = getMockReq('/api/some-endpoint', {
        method: 'POST',
        headers: { 'x-csrf-token': 'wrong-token' },
        cookies: { 'csrf-secret': 'correct-secret' },
      });
      const response = await middleware(req);
      expect(response.status).toBe(403);
    });

    it('should allow POST requests with valid CSRF tokens', async () => {
      const req = getMockReq('/api/some-endpoint', {
        method: 'POST',
        headers: { 'x-csrf-token': 'valid-secret' },
        cookies: { 'csrf-secret': 'valid-secret' },
      });
      const response = await middleware(req);
      expect(response.status).toBe(200);
    });
  });
});
