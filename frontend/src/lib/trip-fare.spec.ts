import { describe, expect, it } from 'vitest'
import { estimateTripFare } from './trip-fare'

describe('estimateTripFare', () => {
  it('returns base fare within 1250m', () => {
    expect(estimateTripFare(0)).toBe(100)
    expect(estimateTripFare(1250)).toBe(100)
  })

  it('adds NT$5 per 200m beyond base', () => {
    expect(estimateTripFare(1251)).toBe(100)
    expect(estimateTripFare(1450)).toBe(105)
    expect(estimateTripFare(8400)).toBe(275)
  })
})
