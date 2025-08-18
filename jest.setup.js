// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import logger from './lib/logger';
import { closeRedis } from './lib/rateLimiter';

// Load environment variables from .env.local for Jest
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Gracefully close open handles after all tests are done
afterAll(() => {
  if (logger && typeof logger.close === 'function') {
    logger.close();
  }
  closeRedis();
});
