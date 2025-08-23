const pino = jest.fn(() => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
  debug: jest.fn(),
  silent: jest.fn(),
  child: jest.fn().mockReturnThis(),
  level: 'silent',
}));

pino.destination = jest.fn();
pino.transport = jest.fn(() => ({}));

// Use CJS exports to match the rest of the codebase for Jest
module.exports = pino;
