import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acceptDriverOrder,
  arriveDriverOrder,
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

  it('starts an order without a request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'order-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await startDriverOrder('order-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/driver/orders/order-1/start',
      expect.objectContaining({ method: 'POST', body: undefined }),
    )
  })

  it('arrives with latitude and longitude', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok({
        id: 'order-1',
        status: 'IN_PROGRESS',
        arrived_at: '2026-09-15T08:10:00.000Z',
        trip_distance_meters: 8400,
        calculated_fare: 275,
        final_fare: null,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await arriveDriverOrder('order-1', 22.5775, 120.35)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/driver/orders/order-1/arrive',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ latitude: 22.5775, longitude: 120.35 }),
      }),
    )
  })

  it('completes an order with final_fare', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok({
        id: 'order-1',
        status: 'COMPLETED',
        completed_at: '2026-09-15T08:20:00.000Z',
        trip_distance_meters: 8400,
        calculated_fare: 275,
        final_fare: 280,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await completeDriverOrder('order-1', 280)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/driver/orders/order-1/complete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ final_fare: 280 }),
      }),
    )
  })
})
