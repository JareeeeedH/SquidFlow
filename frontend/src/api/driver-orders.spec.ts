import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDriverOrder, listOpenDriverOrders } from './driver-orders'

function ok(data: unknown) {
  return {
    status: 200,
    json: async () => ({ success: true, data }),
  }
}

describe('driver orders API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lists open orders', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]))
    vi.stubGlobal('fetch', fetchMock)

    await listOpenDriverOrders()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/driver/orders/open',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })

  it('gets a driver order by id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'order-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await getDriverOrder('order-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/driver/orders/order-1',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })
})
