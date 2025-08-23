const config = {
  GEOCODE_TIMEOUT_MS: parseInt(process.env.GEOCODE_TIMEOUT_MS || '1000', 10),
  GEOCODE_RETRIES: parseInt(process.env.GEOCODE_RETRIES || '3', 10),
  GEOCODE_CONCURRENCY: parseInt(process.env.GEOCODE_CONCURRENCY || '5', 10),
  GEOCODE_RETRY_BASE_MS: parseInt(process.env.GEOCODE_RETRY_BASE_MS || '100', 10),
};

module.exports = config;
