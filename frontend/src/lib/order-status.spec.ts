import { describe, expect, it } from 'vitest'
import { parseOrderStatus } from './order-status'

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
