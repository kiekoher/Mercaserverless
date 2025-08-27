const { Client } = require('@googlemaps/google-maps-services-js');
const pRetry = require('p-retry');
const { getCacheClient } = require('./redisCache');
const logger = require('./logger.server');
const geocodeConfig = require('./geocodeConfig');

const LOCK_TIMEOUT_MS = 5000; // Max time to hold a lock
const LOCK_RETRY_DELAY_MS = 200; // Time to wait before retrying to get a result

/**
 * Normalizes an address string for consistent caching.
 * @param {string} address The address to normalize.
 * @returns {string} The normalized address.
 */
function normalizeAddress(address) {
  if (!address || typeof address !== 'string') return '';
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function geocodeAddress(address) {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) return null;

  const client = new Client({});
  const cache = getCacheClient();
  if (!cache) {
    logger.warn('Redis cache not available for geocoding. Proceeding without cache.');
    // Fallback to direct API call if cache is down
    const response = await client.geocode({
      params: { address: normalizedAddress, key: process.env.GOOGLE_MAPS_API_KEY },
      timeout: geocodeConfig.GEOCODE_TIMEOUT_MS,
    });
    if (response.data.results.length > 0) {
      return response.data.results[0].geometry.location;
    }
    return null;
  }

  const cacheKey = `geo:${normalizedAddress}`;
  const lockKey = `lock:${cacheKey}`;

  // 1. Check cache first
  try {
    const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    logger.warn({ err, address }, 'Failed to read geocode cache');
  }

  // 2. Try to acquire a lock to prevent cache stampede
  const lockAcquired = await cache.set(lockKey, '1', { nx: true, px: LOCK_TIMEOUT_MS });

  if (lockAcquired) {
    try {
      // 3. We have the lock, so we fetch from the API
      logger.info({ address: normalizedAddress }, 'Geocode cache miss. Fetching from API.');
      const geocodeFn = async () => {
        const response = await client.geocode({
          params: { address: normalizedAddress, key: process.env.GOOGLE_MAPS_API_KEY },
          timeout: geocodeConfig.GEOCODE_TIMEOUT_MS,
        });

        if (response.data?.status === 'OVER_QUERY_LIMIT' || response.data?.status === 'REQUEST_DENIED') {
          // Do not retry on these errors, they are not transient
          throw new pRetry.AbortError(`Geocoding API error: ${response.data.status}`);
        }
        if (response.data.results.length === 0) {
          // Also a valid response, don't retry
          throw new pRetry.AbortError('No results found for address.');
        }
        return response.data.results[0].geometry.location;
      };

      const location = await pRetry(geocodeFn, {
        retries: geocodeConfig.GEOCODE_RETRIES,
        minTimeout: geocodeConfig.GEOCODE_RETRY_BASE_MS,
        onFailedAttempt: (error) => {
          logger.warn(`Geocode attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`);
        },
      });

      // 4. Store successful result in cache
      await cache.set(cacheKey, JSON.stringify(location), { ex: 60 * 60 * 24 * 30 });
      return location;

    } catch (err) {
      logger.error({ err, address: normalizedAddress }, 'Failed to geocode address after retries');
      // If we fail, cache a 'null' for a short time to prevent hammering the API for a known bad address
      await cache.set(cacheKey, JSON.stringify(null), { ex: 60 * 5 }); // Cache failure for 5 mins
      return null;
    } finally {
      // 5. Always release the lock
      await cache.del(lockKey);
    }
  } else {
    // 6. Could not get lock, another process is fetching. Wait and poll cache.
    logger.info({ address: normalizedAddress }, 'Could not acquire geocode lock, waiting for result.');
    await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
    // Retry the whole function, which will now hopefully hit the cache populated by the other process.
    return geocodeAddress(address);
  }
}

module.exports = { geocodeAddress, normalizeAddress };
