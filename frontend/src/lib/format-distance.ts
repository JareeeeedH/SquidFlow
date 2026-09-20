/**
 * Format P2-03 straight-line distance for UI.
 * Confirmed: < 1 km → integer meters; >= 1 km → 1 decimal km; label 直線距離 in UI.
 */
export function formatStraightLineDistance(
  distanceMeters: number | null | undefined,
): string | null {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) {
    return null
  }
  if (distanceMeters < 0) {
    return null
  }
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} 公尺`
  }
  const km = distanceMeters / 1000
  const rounded = Math.round(km * 10) / 10
  return `${rounded} 公里`
}

/**
 * Format Phase 3 trip mileage (meters → km) for Driver UI.
 * Returns null when missing so callers hide the mileage block (never invent 0 km from null).
 */
export function formatTripDistanceKm(
  distanceMeters: number | null | undefined,
): string | null {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) {
    return null
  }
  if (distanceMeters < 0) {
    return null
  }
  const km = Math.round((distanceMeters / 1000) * 10) / 10
  return `${km.toFixed(1)} km`
}
