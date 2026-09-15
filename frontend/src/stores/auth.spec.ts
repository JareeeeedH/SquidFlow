import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../api/types'

vi.mock('../api/auth', () => ({
  fetchCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

import { fetchCurrentUser, login, logout } from '../api/auth'
import { useAuthStore } from './auth'
import { usePushNotificationStore } from './push-notification'

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('treats 401 on initialize as logged out', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(
      new ApiClientError('UNAUTHORIZED', '未授權', 401),
    )

    const auth = useAuthStore()
    await auth.initialize()

    expect(auth.authenticated).toBe(false)
    expect(auth.currentUser).toBeNull()
    expect(auth.initialized).toBe(true)
    expect(auth.initError).toBeNull()
  })

  it('logs in then loads current user from /auth/me', async () => {
    vi.mocked(login).mockResolvedValue({
      id: '1',
      username: 'admin01',
      role: 'ADMIN',
    })
    vi.mocked(fetchCurrentUser).mockResolvedValue({
      id: '1',
      username: 'admin01',
      role: 'ADMIN',
      status: 'ACTIVE',
    })

    const auth = useAuthStore()
    await auth.login('admin01', 'secret')

    expect(login).toHaveBeenCalledWith('admin01', 'secret')
    expect(auth.currentUser).toEqual({
      id: '1',
      username: 'admin01',
      role: 'ADMIN',
      status: 'ACTIVE',
    })
    expect(auth.authenticated).toBe(true)
  })

  it('clears auth state even if logout request fails', async () => {
    vi.mocked(logout).mockRejectedValue(
      new ApiClientError('UNAUTHORIZED', '未授權', 401),
    )
    const auth = useAuthStore()
    auth.currentUser = {
      id: '1',
      username: 'admin01',
      role: 'ADMIN',
      status: 'ACTIVE',
    }

    await auth.logout()

    expect(auth.authenticated).toBe(false)
    expect(auth.currentUser).toBeNull()
  })

  it('removes the push subscription before logging out', async () => {
    vi.mocked(logout).mockResolvedValue(null)
    const auth = useAuthStore()
    const push = usePushNotificationStore()
    const teardown = vi.spyOn(push, 'teardownOnLogout').mockResolvedValue()
    auth.currentUser = {
      id: '1',
      username: 'driver01',
      role: 'DRIVER',
      status: 'ACTIVE',
    }

    await auth.logout()

    expect(teardown).toHaveBeenCalled()
    expect(logout).toHaveBeenCalled()
    expect(auth.currentUser).toBeNull()
  })
})
