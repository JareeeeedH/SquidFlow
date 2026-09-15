import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../api/types'

vi.mock('../api/driver-status', () => ({
  updateDriverOnlineStatus: vi.fn(),
}))

import { updateDriverOnlineStatus } from '../api/driver-status'
import { useDriverStatusStore } from './driver-status'

describe('driver status store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.resetAllMocks()
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
})
