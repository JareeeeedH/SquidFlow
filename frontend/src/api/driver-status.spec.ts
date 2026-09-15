import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDriverOnlineStatus, updateDriverOnlineStatus } from './driver-status'

function ok(data: unknown) {
  return {
    status: 200,
    json: async () => ({ success: true, data }),
  }
}

describe('driver status API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('gets current ONLINE or OFFLINE status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ status: 'ONLINE' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getDriverOnlineStatus()

    expect(result).toEqual({ status: 'ONLINE' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/driver/status',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    )
  })

  it('patches only ONLINE or OFFLINE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ status: 'ONLINE' }))
    vi.stubGlobal('fetch', fetchMock)

    await updateDriverOnlineStatus('ONLINE')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/driver/status',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({ status: 'ONLINE' }),
      }),
    )
  })
})
