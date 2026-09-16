/**
 * Format P2-03 straight-line distance for UI.
 * Rounding precision remains open in Spec; use simple whole meters / 1-decimal km.
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
