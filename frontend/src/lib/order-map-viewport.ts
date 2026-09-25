/**
 * Soft cap after fitBounds so nearby self+pickup still show surrounding area
 * (city-block / neighborhood scale, not street-level).
 */
export const MAX_FIT_ZOOM = 13
/** Single valid marker: avoid fitBounds over-zoom. */
export const SINGLE_POINT_ZOOM = 12
/** Keep markers away from map edges (px). */
export const FIT_BOUNDS_PADDING = 48
