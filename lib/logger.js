import pino from 'pino';
import { Logtail } from '@logtail/pino';
import { Writable } from 'stream';

const level = process.env.LOG_LEVEL || 'info';
const isBrowser = typeof window !== 'undefined';

let logger;

if (isBrowser) {
  // In the browser, use a simple logger that writes to the console.
  logger = pino({ level, browser: { asObject: true } });
} else {
  // In a serverless environment (Node.js)
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && process.env.LOGTAIL_SOURCE_TOKEN) {
    // In production, send logs to Logtail
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
}

export default logger;
