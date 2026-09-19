import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../api/types'

vi.mock('../api/driver-status', () => ({
  getDriverOnlineStatus: vi.fn(),
  updateDriverOnlineStatus: vi.fn(),
}))

vi.mock('../api/driver-orders', () => ({
  listDriverOrders: vi.fn(),
}))

vi.mock('../lib/driver-gps', () => ({
  syncDriverGps: vi.fn(),
  stopDriverGps: vi.fn(),
}))

import { listDriverOrders } from '../api/driver-orders'
import {
  getDriverOnlineStatus,
  updateDriverOnlineStatus,
} from '../api/driver-status'
import { stopDriverGps, syncDriverGps } from '../lib/driver-gps'
import {
  hasInProgressDriverOrder,
  useDriverStatusStore,
} from './driver-status'

describe('driver status store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(listDriverOrders).mockResolvedValue([])
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('hydrates online status and starts GPS at 30s when ONLINE with no trip', async () => {
    vi.mocked(getDriverOnlineStatus).mockResolvedValue({ status: 'ONLINE' })
    vi.mocked(listDriverOrders).mockResolvedValue([
      {
        id: '1',
        order_no: 'ORD-1',
        pickup_location: 'A',
        destination: null,
        created_at: '2026-09-15T07:00:00.000Z',
        price: null,
        status: 'ACCEPTED',
        distance_meters: null,
      },
    ])
    const store = useDriverStatusStore()

    await store.sync()

    expect(store.onlineStatus).toBe('ONLINE')
    expect(store.hasInProgressOrder).toBe(false)
    expect(syncDriverGps).toHaveBeenCalledWith({
      onlineStatus: 'ONLINE',
      inProgress: false,
    })
  })

  it('uses 10s GPS when ONLINE with an IN_PROGRESS order', async () => {
    vi.mocked(getDriverOnlineStatus).mockResolvedValue({ status: 'ONLINE' })
    vi.mocked(listDriverOrders).mockResolvedValue([
      {
        id: '1',
        order_no: 'ORD-1',
        pickup_location: 'A',
        destination: null,
        created_at: '2026-09-15T07:00:00.000Z',
        price: null,
        status: 'IN_PROGRESS',
        distance_meters: null,
      },
    ])
    const store = useDriverStatusStore()

    await store.sync()

    expect(store.hasInProgressOrder).toBe(true)
    expect(syncDriverGps).toHaveBeenCalledWith({
      onlineStatus: 'ONLINE',
      inProgress: true,
    })
  })

  it('keeps online status from the backend response and syncs GPS', async () => {
    vi.mocked(updateDriverOnlineStatus).mockResolvedValue({ status: 'ONLINE' })
    const store = useDriverStatusStore()
    store.hasInProgressOrder = true

    await store.setOnlineStatus('ONLINE')

    expect(updateDriverOnlineStatus).toHaveBeenCalledWith('ONLINE')
    expect(store.onlineStatus).toBe('ONLINE')
    expect(syncDriverGps).toHaveBeenCalledWith({
      onlineStatus: 'ONLINE',
      inProgress: true,
    })
  })

  it('stops GPS when switching to OFFLINE', async () => {
    vi.mocked(updateDriverOnlineStatus).mockResolvedValue({ status: 'OFFLINE' })
    const store = useDriverStatusStore()
    store.hasInProgressOrder = true

    await store.setOnlineStatus('OFFLINE')

    expect(store.onlineStatus).toBe('OFFLINE')
    expect(syncDriverGps).toHaveBeenCalledWith({
      onlineStatus: 'OFFLINE',
      inProgress: true,
    })
  })

  it('switches GPS interval when start/complete updates in-progress flag', () => {
    const store = useDriverStatusStore()
    store.onlineStatus = 'ONLINE'

    store.setInProgressOrder(true)
    expect(syncDriverGps).toHaveBeenCalledWith({
      onlineStatus: 'ONLINE',
      inProgress: true,
    })

    store.setInProgressOrder(false)
    expect(syncDriverGps).toHaveBeenCalledWith({
      onlineStatus: 'ONLINE',
      inProgress: false,
    })
  })

  it('does not change local status when backend rejects', async () => {
    vi.mocked(updateDriverOnlineStatus).mockRejectedValue(
      new ApiClientError('ACCOUNT_SUSPENDED', '帳號已停用', 403),
    )
    const store = useDriverStatusStore()

    await expect(store.setOnlineStatus('ONLINE')).rejects.toMatchObject({
      code: 'ACCOUNT_SUSPENDED',
    })
    expect(store.onlineStatus).toBeNull()
    expect(syncDriverGps).not.toHaveBeenCalled()
  })

  it('does not change local status when sync fails', async () => {
    vi.mocked(getDriverOnlineStatus).mockRejectedValue(
      new ApiClientError('NETWORK_ERROR', '無法連線到伺服器', 0),
    )
    const store = useDriverStatusStore()
    store.onlineStatus = 'ONLINE'

    await expect(store.sync()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
    expect(store.onlineStatus).toBe('ONLINE')
    expect(syncDriverGps).not.toHaveBeenCalled()
  })

  it('still applies GPS when active-order sync fails after online sync', async () => {
    vi.mocked(getDriverOnlineStatus).mockResolvedValue({ status: 'ONLINE' })
    vi.mocked(listDriverOrders).mockRejectedValue(
      new ApiClientError('NETWORK_ERROR', '無法連線到伺服器', 0),
    )
    const store = useDriverStatusStore()

    await store.sync()

    expect(store.onlineStatus).toBe('ONLINE')
    expect(syncDriverGps).toHaveBeenCalledWith({
      onlineStatus: 'ONLINE',
      inProgress: false,
    })
  })

  it('stops GPS on reset without changing remote online status', () => {
    const store = useDriverStatusStore()
    store.onlineStatus = 'ONLINE'
    store.hasInProgressOrder = true

    store.reset()

    expect(store.onlineStatus).toBeNull()
    expect(store.hasInProgressOrder).toBe(false)
    expect(stopDriverGps).toHaveBeenCalledOnce()
    expect(updateDriverOnlineStatus).not.toHaveBeenCalled()
  })

  it('detects IN_PROGRESS orders for GPS interval', () => {
    expect(
      hasInProgressDriverOrder([{ status: 'ACCEPTED' }, { status: 'COMPLETED' }]),
    ).toBe(false)
    expect(hasInProgressDriverOrder([{ status: 'IN_PROGRESS' }])).toBe(true)
  })
})
