import { Redis as UpstashRedis } from '@upstash/redis';
import logger from './logger.server';

let cacheClient;

export function getCacheClient() {
  if (!cacheClient) {
    if (
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      try {
        cacheClient = new UpstashRedis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
      } catch (err) {
        logger.error({ err }, 'Failed to create cache client');
        cacheClient = undefined;
      }
    }
  }
  return cacheClient;
}

