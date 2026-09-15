import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAdminDashboard } from './dashboard'

describe('getAdminDashboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requests GET /admin/dashboard with credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        success: true,
        data: {
          summary: {
            DRAFT: 0,
            OPEN: 0,
            ACCEPTED: 0,
            IN_PROGRESS: 0,
            COMPLETED: 0,
            CANCELLED: 0,
          },
          board_orders: [],
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await getAdminDashboard()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/dashboard',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    )
  })
})
