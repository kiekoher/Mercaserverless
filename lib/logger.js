import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';
const isProd = process.env.NODE_ENV === 'production';

let transport;
if (isProd) {
  transport = pino.transport({
    target: 'pino/file',
    options: {
      destination: process.env.LOG_FILE_PATH || './logs/app.log',
      mkdir: true,
      maxSize: parseInt(process.env.LOG_MAX_SIZE || '10485760', 10), // 10MB
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
