import { describe, expect, it } from 'vitest'
import {
  collectValidGpsPoints,
  computeSendIntervalMs,
  parseDurationMinutes,
  parseLatLngPair,
} from './dev-gps-sequence'

describe('parseLatLngPair', () => {
  it('parses latitude, longitude without rounding', () => {
    expect(parseLatLngPair('22.619396, 120.321416')).toEqual({
      ok: true,
      value: { latitude: 22.619396, longitude: 120.321416 },
    })
  })

  it('rejects invalid latitude', () => {
    const result = parseLatLngPair('91, 120.3')
    expect(result.ok).toBe(false)
  })

  it('rejects invalid longitude', () => {
    const result = parseLatLngPair('22.6, -181')
    expect(result.ok).toBe(false)
  })
})

describe('collectValidGpsPoints', () => {
  it('skips blank rows and keeps valid points', () => {
    expect(
      collectValidGpsPoints([
        '22.619396, 120.321416',
        '  ',
        '22.62, 120.32',
        '',
      ]),
    ).toEqual({
      ok: true,
      value: [
        { latitude: 22.619396, longitude: 120.321416 },
        { latitude: 22.62, longitude: 120.32 },
      ],
    })
  })

  it('requires at least one valid point', () => {
    const result = collectValidGpsPoints(['', '  '])
    expect(result.ok).toBe(false)
  })
})

describe('parseDurationMinutes', () => {
  it('accepts positive minutes', () => {
    expect(parseDurationMinutes('5')).toEqual({ ok: true, value: 5 })
  })

  it('rejects non-positive values', () => {
    expect(parseDurationMinutes('0').ok).toBe(false)
    expect(parseDurationMinutes('-1').ok).toBe(false)
  })
})

describe('computeSendIntervalMs', () => {
  it('splits total time evenly across points', () => {
    expect(computeSendIntervalMs(5, 5)).toBe(60_000)
    expect(computeSendIntervalMs(10, 5)).toBe(120_000)
    expect(computeSendIntervalMs(3, 6)).toBe(30_000)
  })
})
