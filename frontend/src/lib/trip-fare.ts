/** Phase 3 fare constants — PHASE-3-SPEC.md §8.1 (Frontend estimate only). */
export const TRIP_FARE_BASE_DISTANCE_METERS = 1250
export const TRIP_FARE_BASE_AMOUNT = 100
export const TRIP_FARE_INCREMENT_DISTANCE_METERS = 200
export const TRIP_FARE_INCREMENT_AMOUNT = 5

/**
 * Frontend-only trip fare estimate from current trip distance (meters).
 * Final calculated_fare is still owned by Backend Arrive.
 *
 * ```
 * distance <= 1250 → 100
 * else → 100 + floor((distance - 1250) / 200) × 5
 * ```
 */
export function estimateTripFare(distanceMeters: number): number {
  if (distanceMeters <= TRIP_FARE_BASE_DISTANCE_METERS) {
    return TRIP_FARE_BASE_AMOUNT
  }

  return (
    TRIP_FARE_BASE_AMOUNT +
    Math.floor(
      (distanceMeters - TRIP_FARE_BASE_DISTANCE_METERS) /
        TRIP_FARE_INCREMENT_DISTANCE_METERS,
    ) *
      TRIP_FARE_INCREMENT_AMOUNT
  )
}
