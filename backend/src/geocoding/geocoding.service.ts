import { Injectable, Logger } from '@nestjs/common';
import { GoogleGeocodingClient } from './google-geocoding.client';
import {
  GeocodeResult,
  PickupCoordinates,
  isGeocodeSuccess,
} from './geocoding.types';

const MAX_PROVIDER_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [150, 300] as const;

function cacheKey(orderId: string, pickupLocation: string): string {
  return `${orderId}\0${pickupLocation}`;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly cache = new Map<string, GeocodeResult>();
  private readonly inflight = new Map<string, Promise<GeocodeResult>>();
  /** Bumped on invalidate so in-flight results for a prior address are discarded. */
  private readonly generation = new Map<string, number>();

  constructor(private readonly client: GoogleGeocodingClient) {}

  /**
   * Fire-and-forget geocode after Order create / pickup_location change.
   * Must not block the Order API response.
   */
  scheduleGeocode(orderId: string, pickupLocation: string): void {
    void this.ensureGeocoded(orderId, pickupLocation).catch(() => {
      // Failures never affect Order flows; ensureGeocoded already swallows provider errors.
    });
  }

  /**
   * Drop all runtime results for an Order so stale coordinates cannot be reused.
   * Call after a successful `pickup_location` change (or Order delete cleanup).
   */
  invalidateOrder(orderId: string): void {
    const next = (this.generation.get(orderId) ?? 0) + 1;
    this.generation.set(orderId, next);

    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(`${orderId}\0`)) {
        this.cache.delete(key);
      }
    }
    for (const key of [...this.inflight.keys()]) {
      if (key.startsWith(`${orderId}\0`)) {
        this.inflight.delete(key);
      }
    }
  }

  /**
   * P2-03 / P2-04 entry point: resolve transient Pickup coordinates.
   * Uses process-local memoization + single-flight; may call Google on cache miss.
   */
  async getPickupCoordinates(
    orderId: string,
    pickupLocation: string,
  ): Promise<PickupCoordinates | null> {
    const result = await this.ensureGeocoded(orderId, pickupLocation);
    return isGeocodeSuccess(result) ? result.coordinates : null;
  }

  /**
   * Ensure a GeocodeResult exists for Order + current pickup_location.
   * Concurrent callers share one in-flight Google request (single-flight).
   */
  async ensureGeocoded(
    orderId: string,
    pickupLocation: string,
  ): Promise<GeocodeResult> {
    const key = cacheKey(orderId, pickupLocation);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    const startedGeneration = this.generation.get(orderId) ?? 0;
    const promise = this.runWithRetries(pickupLocation)
      .then((result) => {
        const currentGeneration = this.generation.get(orderId) ?? 0;
        if (currentGeneration === startedGeneration) {
          this.cache.set(key, result);
        }
        return result;
      })
      .finally(() => {
        if (this.inflight.get(key) === promise) {
          this.inflight.delete(key);
        }
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /** Test / diagnostics: peek cached result without triggering Google. */
  peekCached(
    orderId: string,
    pickupLocation: string,
  ): GeocodeResult | undefined {
    return this.cache.get(cacheKey(orderId, pickupLocation));
  }

  private async runWithRetries(pickupLocation: string): Promise<GeocodeResult> {
    if (!this.client.isEnabled()) {
      return { ok: false, reason: 'DISABLED' };
    }

    let last: GeocodeResult = { ok: false, reason: 'PROVIDER_ERROR' };

    for (let attempt = 0; attempt < MAX_PROVIDER_ATTEMPTS; attempt += 1) {
      last = await this.client.geocode(pickupLocation);

      if (last.ok) {
        return last;
      }

      // Do not spin on unusable / permanent outcomes for the same address.
      if (
        last.reason === 'ZERO_RESULTS' ||
        last.reason === 'INVALID' ||
        last.reason === 'DISABLED'
      ) {
        return last;
      }

      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) {
        await sleep(delay);
      }
    }

    this.logger.warn('Google Geocoding exhausted provider retries');
    return last;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
