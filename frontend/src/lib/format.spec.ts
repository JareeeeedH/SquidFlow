import { describe, expect, it } from 'vitest'
import {
  formatDateTimeTaipei,
  formatOptionalText,
  formatPrice,
  formatScheduledAt,
  formatTaipeiYmd,
  toScheduledAtIso,
} from './format'

describe('formatTaipeiYmd', () => {
  it('formats a Taipei calendar date as YYYY-MM-DD', () => {
    expect(formatTaipeiYmd(new Date('2026-09-15T00:00:00+08:00'))).toBe(
      '2026-09-15',
    )
  })
})

describe('formatScheduledAt', () => {
  it('shows Asia/Taipei time instead of raw ISO', () => {
    expect(formatScheduledAt('2026-09-15T02:30:00.000Z')).toBe('09/15 10:30')
    expect(formatScheduledAt('2026-09-15T15:30:00+08:00')).toBe('09/15 15:30')
  })
})

describe('formatDateTimeTaipei', () => {
  it('shows a Taipei datetime with year', () => {
    expect(formatDateTimeTaipei('2026-09-15T07:00:00.000Z')).toBe(
      '2026/09/15 15:00',
    )
  })
})

describe('toScheduledAtIso', () => {
  it('sends a Taipei ISO-8601 instant with offset', () => {
    expect(toScheduledAtIso(new Date('2026-09-15T15:30:00+08:00').getTime())).toBe(
      '2026-09-15T15:30:00+08:00',
    )
  })
})

describe('formatPrice', () => {
  it('formats whole and fractional TWD amounts', () => {
    expect(formatPrice(1200)).toBe('NT$ 1,200')
    expect(formatPrice(1200.5)).toBe('NT$ 1,200.50')
    expect(formatPrice(null)).toBe('—')
  })
})

describe('formatOptionalText', () => {
  it('shows an em dash when the value is missing', () => {
    expect(formatOptionalText('王先生')).toBe('王先生')
    expect(formatOptionalText(null)).toBe('—')
    expect(formatOptionalText('')).toBe('—')
  })
})
