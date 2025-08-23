const { createMocks } = require('node-mocks-http');

jest.mock('../../lib/supabaseServer');
jest.mock('../../lib/logger.server');
// Mock getRedisClient from rateLimiter instead of ioredis
jest.mock('../../lib/rateLimiter', () => ({
    getRedisClient: jest.fn(),
}));

describe('health API', () => {
    let handler;
    let getSupabaseServerClient, getRedisClient;

    beforeEach(() => {
        jest.resetModules();
        process.env.HEALTHCHECK_TOKEN = 'a-very-secret-token';

        getSupabaseServerClient = require('../../lib/supabaseServer').getSupabaseServerClient;
        getRedisClient = require('../../lib/rateLimiter').getRedisClient;
        handler = require('../../pages/api/health');

        // Default success case
        getSupabaseServerClient.mockReturnValue({
            auth: { getSession: jest.fn().mockResolvedValue({ error: null }) }
        });
        getRedisClient.mockReturnValue({
            ping: jest.fn().mockResolvedValue('PONG'),
        });
    });

    it('should return 200 with a valid token', async () => {
        const { req, res } = createMocks({
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.HEALTHCHECK_TOKEN}` },
        });
        await handler(req, res);
        expect(res._getStatusCode()).toBe(200);
    });

    it('should return 503 if Supabase fails', async () => {
        getSupabaseServerClient.mockReturnValue({
            auth: { getSession: jest.fn().mockResolvedValue({ error: new Error('DB Error') }) }
        });
        const { req, res } = createMocks({
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.HEALTHCHECK_TOKEN}` },
        });
        await handler(req, res);
        expect(res._getStatusCode()).toBe(503);
        expect(res._getJSONData().dependencies.supabase).toBe('error');
    });

    it('should return 503 if Redis fails', async () => {
        getRedisClient.mockReturnValue({
            ping: jest.fn().mockRejectedValue(new Error('Redis Down')),
        });
        const { req, res } = createMocks({
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.HEALTHCHECK_TOKEN}` },
        });
        await handler(req, res);
        expect(res._getStatusCode()).toBe(503);
        expect(res._getJSONData().dependencies.redis).toBe('error');
    });
});
