import { segmentDistanceMeters } from './segment-distance';

export type TripCoordinates = {
  latitude: number;
  longitude: number;
};

export type TripTrackingState = {
  distanceMeters: number;
  lastLatitude: number | null;
  lastLongitude: number | null;
};

/**
 * Phase 3 pure trip-mileage tracking step.
 *
 * - First valid GPS (no last point): set last point only; distance unchanged.
 * - Later GPS: add Haversine segment via `segmentDistanceMeters`, then move last point.
 *
 * Assumes coordinates were already validated by the API layer (−90..90 / −180..180).
 * Does not calculate fare, persist state, or mutate the input `state`.
 */
export function recordTripLocation(
  state: TripTrackingState,
  current: TripCoordinates,
): TripTrackingState {
  const lastLatitude = state.lastLatitude;
  const lastLongitude = state.lastLongitude;
  const hasLastPoint = lastLatitude != null && lastLongitude != null;

  if (!hasLastPoint) {
    return {
      distanceMeters: state.distanceMeters,
      lastLatitude: current.latitude,
      lastLongitude: current.longitude,
    };
  }

  const segmentMeters = segmentDistanceMeters(
    lastLatitude,
    lastLongitude,
    current.latitude,
    current.longitude,
  );

  return {
    distanceMeters: state.distanceMeters + segmentMeters,
    lastLatitude: current.latitude,
    lastLongitude: current.longitude,
  };
}
