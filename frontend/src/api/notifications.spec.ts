import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPushSubscription, deletePushSubscription } from './notifications'

function ok(data: unknown) {
  return {
    status: 200,
    json: async () => ({ success: true, data }),
  }
}

describe('notifications API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('creates a push subscription', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'sub-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createPushSubscription({
        endpoint: 'https://push.example.test/a',
        p256dh: 'p256dh',
        auth: 'auth',
      }),
    ).resolves.toEqual({ id: 'sub-1' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/notifications/subscription',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          endpoint: 'https://push.example.test/a',
          p256dh: 'p256dh',
          auth: 'auth',
        }),
      }),
    )
  })

  it('deletes a push subscription by endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(null))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      deletePushSubscription('https://push.example.test/a'),
    ).resolves.toBeNull()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/notifications/subscription',
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
        body: JSON.stringify({
          endpoint: 'https://push.example.test/a',
        }),
      }),
    )
  })
})
