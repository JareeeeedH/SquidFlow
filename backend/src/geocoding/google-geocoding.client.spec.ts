import { GoogleGeocodingClient } from './google-geocoding.client';

describe('GoogleGeocodingClient', () => {
  const originalKey = process.env.GOOGLE_GEOCODING_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.GOOGLE_GEOCODING_API_KEY;
    } else {
      process.env.GOOGLE_GEOCODING_API_KEY = originalKey;
    }
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns DISABLED when API key is missing', async () => {
    delete process.env.GOOGLE_GEOCODING_API_KEY;
    const client = new GoogleGeocodingClient();
    await expect(client.geocode('台北車站')).resolves.toEqual({
      ok: false,
      reason: 'DISABLED',
    });
    expect(client.isEnabled()).toBe(false);
  });

  it('maps OK responses to coordinates', async () => {
    process.env.GOOGLE_GEOCODING_API_KEY = 'test-secret-key-abc';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'OK',
          results: [{ geometry: { location: { lat: 25.0478, lng: 121.517 } } }],
        }),
    });
    global.fetch = fetchMock;

    const client = new GoogleGeocodingClient();
    await expect(client.geocode('台北車站')).resolves.toEqual({
      ok: true,
      coordinates: { latitude: 25.0478, longitude: 121.517 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const calledUrl = String(firstCall?.[0]);
    expect(calledUrl).toContain('address=');
    expect(calledUrl).toContain('key=test-secret-key-abc');
  });

  it('maps ZERO_RESULTS without retries at client layer', async () => {
    process.env.GOOGLE_GEOCODING_API_KEY = 'test-secret-key-abc';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
    });

    const client = new GoogleGeocodingClient();
    await expect(client.geocode('nowhere-xyz')).resolves.toEqual({
      ok: false,
      reason: 'ZERO_RESULTS',
    });
  });

  it('does not expose API key in safe error messages', () => {
    process.env.GOOGLE_GEOCODING_API_KEY = 'super-secret-key-xyz';
    const client = new GoogleGeocodingClient();
    const redacted = client.redactForLog(
      'failed https://maps.googleapis.com/maps/api/geocode/json?key=super-secret-key-xyz',
    );
    expect(redacted).not.toContain('super-secret-key-xyz');
    expect(redacted).toContain('[REDACTED]');
  });

  it('treats empty address as INVALID without calling Google', async () => {
    process.env.GOOGLE_GEOCODING_API_KEY = 'test-secret-key-abc';
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const client = new GoogleGeocodingClient();
    await expect(client.geocode('   ')).resolves.toEqual({
      ok: false,
      reason: 'INVALID',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
