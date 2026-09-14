import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createOrder,
  deleteOrder,
  getOrder,
  listOrders,
  ordersListPath,
  publishOrder,
  updateOrder,
} from './orders'

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

describe('getOrder', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requests GET /orders/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        success: true,
        data: { id: 'order-1' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await getOrder('order-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/orders/order-1',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    )
  })
})

describe('createOrder', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('posts only allowed create fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        success: true,
        data: { id: 'order-1', order_no: 'ORD-20260915-001', status: 'DRAFT' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createOrder({
      customer_name: '王先生',
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      scheduled_at: '2026-09-15T15:30:00+08:00',
      vehicle_type: '5人座',
      price: 1200,
      note: '2件行李',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/orders',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          customer_name: '王先生',
          pickup_location: '左營高鐵站',
          destination: '高雄小港機場',
          scheduled_at: '2026-09-15T15:30:00+08:00',
          vehicle_type: '5人座',
          price: 1200,
          note: '2件行李',
        }),
      }),
    )
  })
})

describe('draft lifecycle APIs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('updates a draft with PUT /orders/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, data: { id: 'order-1', status: 'DRAFT' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await updateOrder('order-1', {
      customer_name: '王先生',
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      scheduled_at: '2026-09-15T15:30:00+08:00',
      vehicle_type: '5人座',
      price: 1300,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/orders/order-1',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"price":1300'),
      }),
    )
  })

  it('deletes a draft with DELETE /orders/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, data: null }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await deleteOrder('order-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/orders/order-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('publishes a draft with POST /orders/:id/publish', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, data: { id: 'order-1', status: 'OPEN' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await publishOrder('order-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/orders/order-1/publish',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
