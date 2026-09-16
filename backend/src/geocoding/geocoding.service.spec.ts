import { GeocodingService } from './geocoding.service';
import { GoogleGeocodingClient } from './google-geocoding.client';
import { GeocodeResult } from './geocoding.types';

describe('GeocodingService', () => {
  let client: { isEnabled: jest.Mock; geocode: jest.Mock };
  let service: GeocodingService;

  beforeEach(() => {
    client = {
      isEnabled: jest.fn().mockReturnValue(true),
      geocode: jest.fn(),
    };
    service = new GeocodingService(client as unknown as GoogleGeocodingClient);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function success(lat = 25.0, lng = 121.5): GeocodeResult {
    return {
      ok: true,
      coordinates: { latitude: lat, longitude: lng },
    };
  }

  it('caches successful geocode and does not call Google again', async () => {
    client.geocode.mockResolvedValue(success());

    const first = await service.ensureGeocoded('order-1', '台北車站');
    const second = await service.ensureGeocoded('order-1', '台北車站');

    expect(first).toEqual(success());
    expect(second).toEqual(success());
    expect(client.geocode).toHaveBeenCalledTimes(1);
  });

  it('uses single-flight for concurrent requests on the same Order + address', async () => {
    let resolveGeocode!: (value: GeocodeResult) => void;
    client.geocode.mockImplementation(
      () =>
        new Promise<GeocodeResult>((resolve) => {
          resolveGeocode = resolve;
        }),
    );

    const p1 = service.ensureGeocoded('order-1', '左營高鐵站');
    const p2 = service.ensureGeocoded('order-1', '左營高鐵站');
    const p3 = service.getPickupCoordinates('order-1', '左營高鐵站');

    expect(client.geocode).toHaveBeenCalledTimes(1);

    resolveGeocode(success(22.687, 120.307));
    await expect(Promise.all([p1, p2, p3])).resolves.toEqual([
      success(22.687, 120.307),
      success(22.687, 120.307),
      { latitude: 22.687, longitude: 120.307 },
    ]);
    expect(client.geocode).toHaveBeenCalledTimes(1);
  });

  it('invalidates prior coordinates when pickup_location changes', async () => {
    client.geocode
      .mockResolvedValueOnce(success(25.0, 121.5))
      .mockResolvedValueOnce(success(22.6, 120.3));

    await service.ensureGeocoded('order-1', '舊地址');
    expect(service.peekCached('order-1', '舊地址')).toEqual(
      success(25.0, 121.5),
    );

    service.invalidateOrder('order-1');
    expect(service.peekCached('order-1', '舊地址')).toBeUndefined();

    const next = await service.ensureGeocoded('order-1', '新地址');
    expect(next).toEqual(success(22.6, 120.3));
    expect(service.peekCached('order-1', '舊地址')).toBeUndefined();
    expect(client.geocode).toHaveBeenCalledTimes(2);
  });

  it('does not store stale in-flight result after invalidate', async () => {
    let resolveFirst!: (value: GeocodeResult) => void;
    client.geocode.mockImplementationOnce(
      () =>
        new Promise<GeocodeResult>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const stalePromise = service.ensureGeocoded('order-1', '舊地址');
    service.invalidateOrder('order-1');

    client.geocode.mockResolvedValueOnce(success(22.6, 120.3));
    const freshPromise = service.ensureGeocoded('order-1', '新地址');

    resolveFirst(success(25.0, 121.5));
    await stalePromise;
    await freshPromise;

    expect(service.peekCached('order-1', '舊地址')).toBeUndefined();
    expect(service.peekCached('order-1', '新地址')).toEqual(
      success(22.6, 120.3),
    );
  });

  it('caches ZERO_RESULTS and does not re-call Google for the same address', async () => {
    client.geocode.mockResolvedValue({ ok: false, reason: 'ZERO_RESULTS' });

    await expect(service.ensureGeocoded('order-1', 'nowhere')).resolves.toEqual(
      { ok: false, reason: 'ZERO_RESULTS' },
    );
    await expect(service.ensureGeocoded('order-1', 'nowhere')).resolves.toEqual(
      { ok: false, reason: 'ZERO_RESULTS' },
    );
    expect(client.geocode).toHaveBeenCalledTimes(1);
    await expect(
      service.getPickupCoordinates('order-1', 'nowhere'),
    ).resolves.toBeNull();
  });

  it('retries provider errors once after 200ms then succeeds (2 total attempts)', async () => {
    jest.useFakeTimers();
    client.geocode
      .mockResolvedValueOnce({ ok: false, reason: 'PROVIDER_ERROR' })
      .mockResolvedValueOnce(success(1, 2));

    const promise = service.ensureGeocoded('order-1', 'retry-me');
    await jest.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toEqual(success(1, 2));
    expect(client.geocode).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('stops after 2 provider attempts on repeated PROVIDER_ERROR', async () => {
    jest.useFakeTimers();
    client.geocode.mockResolvedValue({ ok: false, reason: 'PROVIDER_ERROR' });

    const promise = service.ensureGeocoded('order-1', 'flaky');
    await jest.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toEqual({
      ok: false,
      reason: 'PROVIDER_ERROR',
    });
    expect(client.geocode).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('does not retry ZERO_RESULTS, INVALID, or DISABLED', async () => {
    client.geocode.mockResolvedValue({ ok: false, reason: 'ZERO_RESULTS' });
    await expect(service.ensureGeocoded('order-0', 'nowhere')).resolves.toEqual({
      ok: false,
      reason: 'ZERO_RESULTS',
    });
    expect(client.geocode).toHaveBeenCalledTimes(1);

    client.geocode.mockClear();
    client.geocode.mockResolvedValue({ ok: false, reason: 'INVALID' });
    await expect(service.ensureGeocoded('order-1', 'bad')).resolves.toEqual({
      ok: false,
      reason: 'INVALID',
    });
    expect(client.geocode).toHaveBeenCalledTimes(1);

    client.geocode.mockClear();
    client.isEnabled.mockReturnValue(false);
    await expect(service.ensureGeocoded('order-2', 'x')).resolves.toEqual({
      ok: false,
      reason: 'DISABLED',
    });
    expect(client.geocode).not.toHaveBeenCalled();
  });

  it('re-geocodes after cache miss (process restart simulation)', async () => {
    client.geocode.mockResolvedValue(success());
    await service.ensureGeocoded('order-1', '台北車站');

    const restarted = new GeocodingService(
      client as unknown as GoogleGeocodingClient,
    );
    await restarted.ensureGeocoded('order-1', '台北車站');
    expect(client.geocode).toHaveBeenCalledTimes(2);
  });

  it('scheduleGeocode does not reject to callers (fire-and-forget)', async () => {
    client.geocode.mockRejectedValue(new Error('boom'));
    expect(() => service.scheduleGeocode('order-1', '地址')).not.toThrow();
    await Promise.resolve();
  });
});
