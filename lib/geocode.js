const { Client } = require('@googlemaps/google-maps-services-js');
const { getCacheClient } = require('./redisCache');
const logger = require('./logger.server');
const geocodeConfig = require('./geocodeConfig');

async function geocodeAddress(address) {
  const client = new Client({});
  const cache = getCacheClient();
  const cacheKey = cache ? `geo:${address}` : null;

  if (cache && cacheKey) {
    try {
      const cached = await cache.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      logger.warn({ err, address }, 'Failed to read geocode cache');
    }
  }

  try {
    const response = await client.geocode({
      params: { address, key: process.env.GOOGLE_MAPS_API_KEY },
      timeout: geocodeConfig.GEOCODE_TIMEOUT_MS,
    });

    if (response.data?.status === 'OVER_QUERY_LIMIT') {
      throw new Error('Geocoding quota exceeded');
    }

    if (response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      if (cache && cacheKey) {
        try {
          await cache.set(cacheKey, JSON.stringify(location), { ex: 60 * 60 * 24 * 30 });
        } catch (err) {
          logger.warn({ err, address }, 'Failed to write geocode cache');
        }
      }
      return location;
    }
  } catch (err) {
    if (err.response?.data?.status === 'OVER_QUERY_LIMIT') {
      throw new Error('Geocoding quota exceeded');
    }
    logger.error({ err, address }, 'Geocode error');
  }

  return null;
}

module.exports = { geocodeAddress };
