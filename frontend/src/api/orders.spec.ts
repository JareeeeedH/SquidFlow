import { afterEach, describe, expect, it, vi } from 'vitest'
import { listOrders, ordersListPath } from './orders'

describe('ordersListPath', () => {
  it('omits empty filters', () => {
    expect(ordersListPath({})).toBe('/orders')
    expect(ordersListPath({ search: '', status: undefined, date: undefined })).toBe(
      '/orders',
    )
  })

  it('combines search, status, and date', () => {
    expect(
      ordersListPath({
        search: 'ORD-20260915',
        status: 'OPEN',
        date: '2026-09-15',
      }),
    ).toBe('/orders?search=ORD-20260915&status=OPEN&date=2026-09-15')
  })
})

describe('listOrders', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requests the existing admin orders API with credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        success: true,
        data: [],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await listOrders({ search: '王先生', status: 'OPEN', date: '2026-09-15' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/orders?search=%E7%8E%8B%E5%85%88%E7%94%9F&status=OPEN&date=2026-09-15',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    )
  })
})
