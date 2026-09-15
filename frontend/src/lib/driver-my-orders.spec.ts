import { describe, expect, it } from 'vitest'
import type { DriverMyOrder } from '../api/types'
import { isCurrentDriverOrder, splitDriverMyOrders } from './driver-my-orders'

const accepted: DriverMyOrder = {
  id: 'a',
  order_no: 'ORD-1',
  scheduled_at: '2026-09-15T07:30:00.000Z',
  pickup_location: '左營高鐵站',
  destination: '小港機場',
  vehicle_type: '5人座',
  price: 1200,
  status: 'ACCEPTED',
}

const inProgress: DriverMyOrder = { ...accepted, id: 'b', status: 'IN_PROGRESS' }
const completed: DriverMyOrder = { ...accepted, id: 'c', status: 'COMPLETED' }
const cancelled: DriverMyOrder = { ...accepted, id: 'd', status: 'CANCELLED' }

describe('splitDriverMyOrders', () => {
  it('puts ACCEPTED and IN_PROGRESS in current, the rest in history', () => {
    const grouped = splitDriverMyOrders([
      completed,
      accepted,
      cancelled,
      inProgress,
    ])

    expect(grouped.current.map((order) => order.id)).toEqual(['a', 'b'])
    expect(grouped.history.map((order) => order.id)).toEqual(['c', 'd'])
  })

  it('treats only ACCEPTED and IN_PROGRESS as current', () => {
    expect(isCurrentDriverOrder('ACCEPTED')).toBe(true)
    expect(isCurrentDriverOrder('IN_PROGRESS')).toBe(true)
    expect(isCurrentDriverOrder('COMPLETED')).toBe(false)
    expect(isCurrentDriverOrder('CANCELLED')).toBe(false)
    expect(isCurrentDriverOrder('OPEN')).toBe(false)
    expect(isCurrentDriverOrder('DRAFT')).toBe(false)
  })
})
