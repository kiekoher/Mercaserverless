import logger from '../../lib/logger.server';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const report = req.body?.['csp-report'] || req.body;
    logger.warn({ report }, 'CSP Violation');
  } catch (err) {
    logger.error({ err }, 'Failed to process CSP report');
  }

  res.status(204).end();
}
