import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateDriverOnlineStatus } from './driver-status'

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
