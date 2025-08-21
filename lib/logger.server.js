import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

let logger;

const isProd = process.env.NODE_ENV === 'production';

if (isProd && process.env.LOGTAIL_SOURCE_TOKEN) {
  // In production, send logs to Logtail
  const { Logtail } = require('@logtail/pino');
  const logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN);
  logger = pino({ level }, logtail);
} else {
  // For local development and testing, use a pretty-printed console output.
  const transport = pino.transport({
    target: 'pino-pretty',
    options: { colorize: true },
  });
  logger = pino({ level }, transport);

  // Attach a close method for Jest to call during teardown
  if (process.env.NODE_ENV === 'test') {
    logger.close = () => {
      if (transport && typeof transport.end === 'function') {
        transport.end();
      }
    };
  }
}

export default logger;
