import { haversineMeters } from '../distance/haversine';

/**
 * Phase 3: distance of one GPS billing segment (meters).
 * Reuses the shared Haversine implementation — does not duplicate the formula.
 */
export function segmentDistanceMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  return haversineMeters(latitude1, longitude1, latitude2, longitude2);
}
