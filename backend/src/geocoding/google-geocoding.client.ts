import { Injectable, Logger } from '@nestjs/common';
import { GeocodeResult, GeocodeSuccess } from './geocoding.types';

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const REQUEST_TIMEOUT_MS = 10_000;

type GoogleGeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: Array<{
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

@Injectable()
export class GoogleGeocodingClient {
  private readonly logger = new Logger(GoogleGeocodingClient.name);
  private readonly apiKey: string | null;

  constructor() {
    const key = process.env.GOOGLE_GEOCODING_API_KEY?.trim();
    this.apiKey = key && key.length > 0 ? key : null;
  }

  isEnabled(): boolean {
    return this.apiKey !== null;
  }

  async geocode(address: string): Promise<GeocodeResult> {
    if (!this.apiKey) {
      return { ok: false, reason: 'DISABLED' };
    }

    const trimmed = address.trim();
    if (!trimmed) {
      return { ok: false, reason: 'INVALID' };
    }

    const url = new URL(GOOGLE_GEOCODE_URL);
    url.searchParams.set('address', trimmed);
    url.searchParams.set('key', this.apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(
          `Google Geocoding HTTP ${response.status} for address lookup`,
        );
        return { ok: false, reason: 'PROVIDER_ERROR' };
      }

      const body = (await response.json()) as GoogleGeocodeResponse;
      return this.mapResponse(body);
    } catch (error) {
      this.logger.warn(
        `Google Geocoding request failed: ${this.safeErrorMessage(error)}`,
      );
      return { ok: false, reason: 'PROVIDER_ERROR' };
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapResponse(body: GoogleGeocodeResponse): GeocodeResult {
    const status = body.status ?? 'UNKNOWN_ERROR';

    if (status === 'OK') {
      const location = body.results?.[0]?.geometry?.location;
      const latitude = location?.lat;
      const longitude = location?.lng;
      if (
        typeof latitude === 'number' &&
        Number.isFinite(latitude) &&
        typeof longitude === 'number' &&
        Number.isFinite(longitude)
      ) {
        const success: GeocodeSuccess = {
          ok: true,
          coordinates: { latitude, longitude },
        };
        return success;
      }
      return { ok: false, reason: 'ZERO_RESULTS' };
    }

    if (status === 'ZERO_RESULTS') {
      return { ok: false, reason: 'ZERO_RESULTS' };
    }

    if (status === 'INVALID_REQUEST') {
      return { ok: false, reason: 'INVALID' };
    }

    if (
      status === 'REQUEST_DENIED' ||
      status === 'OVER_QUERY_LIMIT' ||
      status === 'UNKNOWN_ERROR' ||
      status === 'ERROR'
    ) {
      this.logger.warn(`Google Geocoding status=${status}`);
      return { ok: false, reason: 'PROVIDER_ERROR' };
    }

    this.logger.warn(`Google Geocoding unexpected status=${status}`);
    return { ok: false, reason: 'PROVIDER_ERROR' };
  }

  private safeErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'unknown error';
    }
    // Never echo URLs that may contain the API key.
    return error.name === 'AbortError' ? 'timeout' : error.name;
  }

  /** Test helper: ensure failure objects never carry the API key. */
  redactForLog(message: string): string {
    if (!this.apiKey) {
      return message;
    }
    return message.split(this.apiKey).join('[REDACTED]');
  }
}
