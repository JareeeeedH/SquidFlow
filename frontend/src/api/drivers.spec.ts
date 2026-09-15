import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createDriver,
  getDriver,
  listDrivers,
  updateDriver,
  updateDriverStatus,
} from './drivers'

function ok(data: unknown) {
  return {
    status: 200,
    json: async () => ({ success: true, data }),
  }
}

describe('drivers API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lists drivers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]))
    vi.stubGlobal('fetch', fetchMock)

    await listDrivers()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/drivers',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })

  it('creates a driver without role or online_status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'd1' }))
    vi.stubGlobal('fetch', fetchMock)

    await createDriver({
      username: 'driver01',
      password: 'Secret123!',
      license_plate: 'ABC-1234',
      vehicle_brand: 'Toyota',
      vehicle_model: 'Camry',
      vehicle_color: '黑色',
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body).toEqual({
      username: 'driver01',
      password: 'Secret123!',
      license_plate: 'ABC-1234',
      vehicle_brand: 'Toyota',
      vehicle_model: 'Camry',
      vehicle_color: '黑色',
    })
    expect(body).not.toHaveProperty('vehicle_type')
    expect(body).not.toHaveProperty('vehicle_year')
    expect(body).not.toHaveProperty('role')
    expect(body).not.toHaveProperty('online_status')
    expect(body).not.toHaveProperty('status')
  })

  it('omits blank password on update', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'd1' }))
    vi.stubGlobal('fetch', fetchMock)

    await updateDriver('d1', {
      username: 'driver01',
      license_plate: 'ABC-1234',
      vehicle_brand: 'Toyota',
      vehicle_model: 'Camry',
      vehicle_color: '黑色',
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body).not.toHaveProperty('password')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/drivers/d1',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('gets a driver and patches account status only', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ id: 'd1' }))
      .mockResolvedValueOnce(ok({ id: 'd1', status: 'SUSPENDED' }))
    vi.stubGlobal('fetch', fetchMock)

    await getDriver('d1')
    await updateDriverStatus('d1', 'SUSPENDED')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/drivers/d1',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/drivers/d1/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'SUSPENDED' }),
      }),
    )
  })
})
