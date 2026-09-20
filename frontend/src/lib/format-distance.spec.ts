import { describe, expect, it } from 'vitest'
import {
  formatStraightLineDistance,
  formatTripDistanceKm,
} from './format-distance'

describe('formatStraightLineDistance', () => {
  it('returns null for missing values', () => {
    expect(formatStraightLineDistance(null)).toBeNull()
    expect(formatStraightLineDistance(undefined)).toBeNull()
  })

  it('formats integer meters under 1 km', () => {
    expect(formatStraightLineDistance(0)).toBe('0 公尺')
    expect(formatStraightLineDistance(245.4)).toBe('245 公尺')
    expect(formatStraightLineDistance(999)).toBe('999 公尺')
  })

  it('formats 1-decimal kilometers at or above 1 km', () => {
    expect(formatStraightLineDistance(1000)).toBe('1 公里')
    expect(formatStraightLineDistance(1100)).toBe('1.1 公里')
    expect(formatStraightLineDistance(2450.5)).toBe('2.5 公里')
    expect(formatStraightLineDistance(1999)).toBe('2 公里')
  })
})

describe('formatTripDistanceKm', () => {
  it('returns null for missing values so UI can hide mileage', () => {
    expect(formatTripDistanceKm(null)).toBeNull()
    expect(formatTripDistanceKm(undefined)).toBeNull()
  })

  it('formats meters as 1-decimal kilometers including zero', () => {
    expect(formatTripDistanceKm(0)).toBe('0.0 km')
    expect(formatTripDistanceKm(3800)).toBe('3.8 km')
    expect(formatTripDistanceKm(8400)).toBe('8.4 km')
  })
})
