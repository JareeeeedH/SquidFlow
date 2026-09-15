import { describe, expect, it } from 'vitest'
import type { DashboardBoardOrder } from '../api/types'
import { groupBoardOrders } from './dashboard'

function boardOrder(
  overrides: Partial<DashboardBoardOrder> = {},
): DashboardBoardOrder {
  return {
    id: 'order-1',
    order_no: 'ORD-20260915-001',
    customer_name: '王先生',
    pickup_location: '左營高鐵站',
    destination: '高雄小港機場',
    created_at: '2026-09-15T07:00:00.000Z',
    price: 1200,
    status: 'OPEN',
    driver: null,
    ...overrides,
  }
}

describe('groupBoardOrders', () => {
  it('groups board cards by status and ignores completed orders', () => {
    const grouped = groupBoardOrders([
      boardOrder({ id: 'draft-1', status: 'DRAFT' }),
      boardOrder({ id: 'open-1', status: 'OPEN' }),
      boardOrder({ id: 'done-1', status: 'COMPLETED' }),
    ])

    expect(grouped.DRAFT.map((order) => order.id)).toEqual(['draft-1'])
    expect(grouped.OPEN.map((order) => order.id)).toEqual(['open-1'])
    expect(grouped.ACCEPTED).toEqual([])
    expect(grouped.IN_PROGRESS).toEqual([])
    expect(Object.keys(grouped).sort()).toEqual([
      'ACCEPTED',
      'DRAFT',
      'IN_PROGRESS',
      'OPEN',
    ])
  })
})
