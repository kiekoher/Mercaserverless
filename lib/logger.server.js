const pino = require('pino');

const level = process.env.LOG_LEVEL || 'info';

let logger;
let logtail;

const isProd = process.env.NODE_ENV === 'production';

if (isProd && process.env.LOGTAIL_SOURCE_TOKEN) {
  const { Logtail } = eval("require('@logtail/pino')");
  logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN);
  logger = pino({ level }, logtail);
} else {
  const transport = pino.transport({
    target: 'pino-pretty',
    options: { colorize: true },
  });
  logger = pino({ level }, transport);

  if (process.env.NODE_ENV === 'test') {
    logger.close = () => {
      if (transport && typeof transport.end === 'function') {
        transport.end();
      }
    };
  }
}

async function flushLogger() {
  if (logtail && typeof logtail.flush === 'function') {
    await logtail.flush();
  }
}

// Use CJS exports to avoid module interop issues in Jest environment.
module.exports = logger;
module.exports.flushLogger = flushLogger;
