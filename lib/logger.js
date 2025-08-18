import pino, { multistream } from 'pino';

const level = process.env.LOG_LEVEL || 'info';
const isBrowser = typeof window !== 'undefined';

let logger;

if (isBrowser) {
  // In the browser, use a simple logger that writes to the console.
  // No transports are needed.
  logger = pino({ level, browser: { asObject: true } });
} else {
  // In Node.js, set up transports for file and remote logging.
  const isProd = process.env.NODE_ENV === 'production';

  // Do not use file transport for test environment to prevent open handles
  if (isProd && process.env.NODE_ENV !== 'test') {
    const { Writable } = require('stream');
    const maxSize = parseInt(process.env.LOG_MAX_SIZE || '10485760', 10);
    const size = `${Math.floor(maxSize / 1024 / 1024)}m`;
    const maxFiles = parseInt(process.env.LOG_MAX_FILES || '5', 10);

    const fileStream = pino.transport({
      target: 'pino-roll',
      options: {
        file: process.env.LOG_FILE_PATH || './logs/app.log',
        size,
        mkdir: true,
        limit: { count: maxFiles },
        frequency: 'daily',
      },
    });

    const streams = [{ stream: fileStream }];

    if (process.env.LOG_REMOTE_URL) {
      const remoteStream = new Writable({
        write(chunk, enc, cb) {
          fetch(process.env.LOG_REMOTE_URL, { method: 'POST', body: chunk }).finally(cb);
        },
      });
      streams.push({ stream: remoteStream });
    }

    logger = pino({ level }, multistream(streams));
  } else {
    // For local development and testing in Node.js, use pino-pretty.
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
