import logger from '../../lib/logger.server';
import { checkRateLimit } from '../../lib/rateLimiter';
import { z } from 'zod';

const MAX_BODY_SIZE = 1024; // 1KB

const cspSchema = z.object({
  'csp-report': z.object({
    'violated-directive': z.string(),
  }).passthrough(),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!(await checkRateLimit(req))) {
    return res.status(429).end();
  }

  try {
    const rawBody = JSON.stringify(req.body || '');
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_SIZE) {
      return res.status(413).end();
    }

    const parsed = cspSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).end();
    }

    const report = parsed.data['csp-report'];
    logger.warn({ report }, 'CSP Violation');
  } catch (err) {
    logger.error({ err }, 'Failed to process CSP report');
  }

  res.status(204).end();
}
