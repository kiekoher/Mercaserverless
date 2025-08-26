/** @jest-environment node */
const { geocodeAddress } = require('../../lib/geocode');
const { getCacheClient } = require('../../lib/redisCache');
const { Client } = require('@googlemaps/google-maps-services-js');

jest.mock('../../lib/redisCache');
jest.mock('@googlemaps/google-maps-services-js');

describe('geocodeAddress', () => {
  let mockClient;
  let mockCache;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { geocode: jest.fn().mockResolvedValue({ data: { results: [{ geometry: { location: { lat: 1, lng: 2 } } }] } }) };
    Client.mockReturnValue(mockClient);
    mockCache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK') };
    getCacheClient.mockReturnValue(mockCache);
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  });

  it('returns cached result if present', async () => {
    mockCache.get.mockResolvedValue(JSON.stringify({ lat: 3, lng: 4 }));
    const res = await geocodeAddress('Addr');
    expect(res).toEqual({ lat: 3, lng: 4 });
    expect(mockClient.geocode).not.toHaveBeenCalled();
  });

  it('fetches and caches when not cached', async () => {
    const res = await geocodeAddress('Addr');
    expect(mockClient.geocode).toHaveBeenCalled();
    expect(mockCache.set).toHaveBeenCalled();
    expect(res).toEqual({ lat: 1, lng: 2 });
  });
});
