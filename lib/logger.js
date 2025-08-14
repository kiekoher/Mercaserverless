import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';
const isProd = process.env.NODE_ENV === 'production';

let transport;
if (isProd) {
  const maxSize = parseInt(process.env.LOG_MAX_SIZE || '10485760', 10);
  const size = `${Math.floor(maxSize / 1024 / 1024)}m`;
  const maxFiles = parseInt(process.env.LOG_MAX_FILES || '5', 10);
  transport = pino.transport({
    target: 'pino-roll',
    options: {
      file: process.env.LOG_FILE_PATH || './logs/app.log',
      size,
      mkdir: true,
      limit: { count: maxFiles },
      frequency: 'daily',
    },
  });
} else {
  transport = pino.transport({
    target: 'pino-pretty',
    options: { colorize: true },
  });
}

const logger = pino({ level }, transport);

export default logger;
