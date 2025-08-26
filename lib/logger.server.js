const pino = require('pino');

const level = process.env.LOG_LEVEL || 'info';
let logger;

// NEXT_RUNTIME is set to 'edge' in middleware and 'nodejs' in other server-side routes.
// This allows us to create a logger that is compatible with both environments.
if (process.env.NEXT_RUNTIME === 'edge') {
  // In the Edge Runtime, we can't use transports that rely on Node.js APIs.
  // We create a basic pino logger that writes to the console.
  // Vercel will automatically capture console output for logs.
  logger = pino({
    level,
    // The browser object is used by pino to print to console in non-Node.js envs
    browser: {
      asObject: true,
    },
  });
} else {
  // In the Node.js runtime (for API routes), we can use the full-featured logger.
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && process.env.LOGTAIL_SOURCE_TOKEN) {
    // Dynamically import to avoid bundling in the edge runtime
    const { logtailTransport } = require('@logtail/pino');
    const transport = logtailTransport(process.env.LOGTAIL_SOURCE_TOKEN);
    logger = pino({ level }, transport);
  } else {
    // For local development in Node.js, use pino-pretty for nice formatting.
    const transport = pino.transport({
      target: 'pino-pretty',
      options: { colorize: true },
    });
    logger = pino({ level }, transport);
  }
}

async function flushLogger() {
  if (logger && typeof logger.flush === 'function') {
    try {
      await logger.flush();
    } catch (err) {
      // Swallow errors to avoid breaking tests on flush failures
    }
  }
}

module.exports = logger;
module.exports.flushLogger = flushLogger;
