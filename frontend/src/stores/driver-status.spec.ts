import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../api/types'

vi.mock('../api/driver-status', () => ({
  getDriverOnlineStatus: vi.fn(),
  updateDriverOnlineStatus: vi.fn(),
}))

import {
  getDriverOnlineStatus,
  updateDriverOnlineStatus,
} from '../api/driver-status'
import { useDriverStatusStore } from './driver-status'

describe('driver status store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('hydrates online status from GET', async () => {
    vi.mocked(getDriverOnlineStatus).mockResolvedValue({ status: 'ONLINE' })
    const store = useDriverStatusStore()

    await store.sync()

    expect(getDriverOnlineStatus).toHaveBeenCalledOnce()
    expect(store.onlineStatus).toBe('ONLINE')
  })

  it('keeps online status from the backend response', async () => {
    vi.mocked(updateDriverOnlineStatus).mockResolvedValue({ status: 'ONLINE' })
    const store = useDriverStatusStore()

    await store.setOnlineStatus('ONLINE')

    expect(updateDriverOnlineStatus).toHaveBeenCalledWith('ONLINE')
    expect(store.onlineStatus).toBe('ONLINE')
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
  })
})
