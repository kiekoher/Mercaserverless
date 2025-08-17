import pino, { multistream } from 'pino';
import { Writable } from 'stream';

const level = process.env.LOG_LEVEL || 'info';
const isProd = process.env.NODE_ENV === 'production';

let logger;
if (isProd) {
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
  const transport = pino.transport({
    target: 'pino-pretty',
    options: { colorize: true },
  });
  logger = pino({ level }, transport);
}

export default logger;
