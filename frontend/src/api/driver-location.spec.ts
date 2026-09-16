import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getDriverLocation,
  listOnlineDriverLocations,
  updateDriverLocation,
} from './driver-location'

function ok(data: unknown) {
  return {
    status: 200,
    json: async () => ({ success: true, data }),
  }
}

describe('driver location API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('patches the authenticated driver location', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok({
        latitude: 22.6,
        longitude: 120.3,
        location_updated_at: '2026-09-16T00:30:00.000Z',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateDriverLocation(22.6, 120.3)

    expect(result.latitude).toBe(22.6)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/driver/location',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({ latitude: 22.6, longitude: 120.3 }),
      }),
    )
  })

  it('gets the authenticated driver location', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok({
        latitude: null,
        longitude: null,
        location_updated_at: null,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getDriverLocation()

    expect(result).toEqual({
      latitude: null,
      longitude: null,
      location_updated_at: null,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/driver/location',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    )
  })

  it('lists online driver locations for admin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]))
    vi.stubGlobal('fetch', fetchMock)

    await listOnlineDriverLocations()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/drivers/online-locations',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    )
  })
})
