// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import logger from './lib/logger.server';
import { closeRedis } from './lib/rateLimiter';

// Environment variables are loaded in jest.env.js, executed via setupFiles.

// Gracefully close open handles after all tests are done
afterAll(() => {
  if (logger && typeof logger.close === 'function') {
    logger.close();
  }
  closeRedis();
});
