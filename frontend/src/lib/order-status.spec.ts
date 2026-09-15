import { describe, expect, it } from 'vitest'
import { isOperationalStatus, parseOrderStatus } from './order-status'

describe('parseOrderStatus', () => {
  it('accepts a valid status string', () => {
    expect(parseOrderStatus('OPEN')).toBe('OPEN')
  })

  it('rejects unknown or empty values', () => {
    expect(parseOrderStatus('FOO')).toBeNull()
    expect(parseOrderStatus(undefined)).toBeNull()
    expect(parseOrderStatus(['OPEN', 'DRAFT'])).toBe('OPEN')
  })
})

describe('isOperationalStatus', () => {
  it('marks OPEN, ACCEPTED, and IN_PROGRESS as operational', () => {
    expect(isOperationalStatus('OPEN')).toBe(true)
    expect(isOperationalStatus('ACCEPTED')).toBe(true)
    expect(isOperationalStatus('IN_PROGRESS')).toBe(true)
    expect(isOperationalStatus('DRAFT')).toBe(false)
    expect(isOperationalStatus('COMPLETED')).toBe(false)
    expect(isOperationalStatus('CANCELLED')).toBe(false)
  })
})
