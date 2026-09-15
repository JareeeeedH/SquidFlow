import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acceptDriverOrder,
  completeDriverOrder,
  driverMyOrdersPath,
  getDriverOrder,
  listDriverOrders,
  listOpenDriverOrders,
  startDriverOrder,
} from './driver-orders'

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

  it('lists my orders without a status filter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]))
    vi.stubGlobal('fetch', fetchMock)

    await listDriverOrders()

    expect(driverMyOrdersPath()).toBe('/driver/orders')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/driver/orders',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })

  it('lists my orders with a status filter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]))
    vi.stubGlobal('fetch', fetchMock)

    await listDriverOrders({ status: 'ACCEPTED' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/driver/orders?status=ACCEPTED',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
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

  it('accepts an order without a request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'order-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await acceptDriverOrder('order-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/driver/orders/order-1/accept',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: undefined,
      }),
    )
  })

  it('starts and completes an order without a request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'order-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await startDriverOrder('order-1')
    await completeDriverOrder('order-1')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/driver/orders/order-1/start',
      expect.objectContaining({ method: 'POST', body: undefined }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/driver/orders/order-1/complete',
      expect.objectContaining({ method: 'POST', body: undefined }),
    )
  })
})
