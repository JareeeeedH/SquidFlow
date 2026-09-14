import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, apiRequest } from './client'

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends JSON with credentials and returns data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        success: true,
        data: { id: 'user-1' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const data = await api.get<{ id: string }>('/auth/me')

    expect(data).toEqual({ id: 'user-1' })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/me', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      body: undefined,
    })
  })

  it('keeps backend error code and message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401,
      json: async () => ({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '帳號或密碼錯誤',
        },
      }),
    }))

    await expect(api.post('/auth/login', { username: 'x', password: 'y' })).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'INVALID_CREDENTIALS',
      message: '帳號或密碼錯誤',
      status: 401,
    })
  })

  it('maps network failure without retrying', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(apiRequest('GET', '/auth/me')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
