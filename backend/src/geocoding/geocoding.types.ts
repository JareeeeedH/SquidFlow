export type PickupCoordinates = {
  latitude: number;
  longitude: number;
};

export type GeocodeFailureReason =
  'DISABLED' | 'ZERO_RESULTS' | 'PROVIDER_ERROR' | 'INVALID';

export type GeocodeSuccess = {
  ok: true;
  coordinates: PickupCoordinates;
};

export type GeocodeFailure = {
  ok: false;
  reason: GeocodeFailureReason;
};

export type GeocodeResult = GeocodeSuccess | GeocodeFailure;

export function isGeocodeSuccess(
  result: GeocodeResult,
): result is GeocodeSuccess {
  return result.ok;
}
