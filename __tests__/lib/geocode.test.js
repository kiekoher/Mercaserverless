const { Client } = require('@googlemaps/google-maps-services-js');
const pRetry = require('p-retry');
const { getCacheClient } = require('../../lib/redisCache');
const { geocodeAddress, normalizeAddress } = require('../../lib/geocode');

jest.mock('@googlemaps/google-maps-services-js');
jest.mock('../../lib/redisCache');
// Mock p-retry with a factory that returns a jest function.
// The default implementation will just call the function once.
jest.mock('p-retry', () => jest.fn((fn) => fn()));

describe('geocode service', () => {
  let mockMapsClient;
  let mockCache;

  beforeEach(() => {
    jest.clearAllMocks();

    mockMapsClient = {
      geocode: jest.fn(),
    };
    Client.mockImplementation(() => mockMapsClient);

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    getCacheClient.mockReturnValue(mockCache);

    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  });

  describe('normalizeAddress', () => {
    it('should lowercase and trim address', () => {
      expect(normalizeAddress('  123 Main St  ')).toBe('123 main st');
    });
  });

  describe('geocodeAddress', () => {
    it('should return cached location if available', async () => {
      const cachedLocation = { lat: 1, lng: 1 };
      mockCache.get.mockResolvedValue(JSON.stringify(cachedLocation));

      const result = await geocodeAddress('123 Main St');

      expect(result).toEqual(cachedLocation);
      expect(mockMapsClient.geocode).not.toHaveBeenCalled();
    });

    it('should call geocode API and cache the result on cache miss', async () => {
      const apiLocation = { lat: 2, lng: 2 };
      mockCache.get.mockResolvedValue(null);
      mockCache.set.mockResolvedValueOnce('OK'); // For the lock
      mockMapsClient.geocode.mockResolvedValue({
        data: { results: [{ geometry: { location: apiLocation } }], status: 'OK' },
      });

      const result = await geocodeAddress('456 Other Ave');

      expect(result).toEqual(apiLocation);
      expect(mockMapsClient.geocode).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        'geo:456 other ave',
        JSON.stringify(apiLocation),
        expect.any(Object)
      );
    });

    it('should retry on transient errors using p-retry', async () => {
      const apiLocation = { lat: 3, lng: 3 };

      // Specific mock implementation for this test
      pRetry.mockImplementationOnce(async (fn) => {
        // First call fails
        await expect(fn()).rejects.toThrow('Network error');
        // Second call succeeds
        return fn();
      });

      mockMapsClient.geocode
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: { results: [{ geometry: { location: apiLocation } }], status: 'OK' },
        });

      await geocodeAddress('789 Retry Rd');

      // p-retry was called, and it internally called geocode twice
      expect(pRetry).toHaveBeenCalledTimes(1);
      expect(mockMapsClient.geocode).toHaveBeenCalledTimes(2);
    });

    it('should not retry on OVER_QUERY_LIMIT error', async () => {
      mockMapsClient.geocode.mockResolvedValue({
        data: { status: 'OVER_QUERY_LIMIT' },
      });

      const result = await geocodeAddress('111 Quota Ct');

      expect(result).toBeNull();
      expect(pRetry).toHaveBeenCalledTimes(1);
      expect(mockMapsClient.geocode).toHaveBeenCalledTimes(1);
    });

    it('should handle no results found from API', async () => {
        mockMapsClient.geocode.mockResolvedValue({
          data: { results: [], status: 'ZERO_RESULTS' },
        });

        const result = await geocodeAddress('Nonexistent Place');

        expect(result).toBeNull();
        expect(pRetry).toHaveBeenCalledTimes(1);
        expect(mockMapsClient.geocode).toHaveBeenCalledTimes(1);
    });
  });
});
