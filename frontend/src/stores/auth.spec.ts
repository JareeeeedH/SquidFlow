import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../api/types'
import { useAuthStore } from './auth'

vi.mock('../api/auth', () => ({
  fetchCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

import { fetchCurrentUser, login, logout } from '../api/auth'

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
})
