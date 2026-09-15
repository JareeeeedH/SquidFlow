import { describe, expect, it } from 'vitest'
import type { CurrentUser } from '../api/types'
import { homeRouteName, resolveAuthRedirect } from './auth-redirect'

const admin: CurrentUser = {
  id: '1',
  username: 'admin01',
  role: 'ADMIN',
  status: 'ACTIVE',
}

const driver: CurrentUser = {
  id: '2',
  username: 'driver01',
  role: 'DRIVER',
  status: 'ACTIVE',
}

describe('auth redirect', () => {
  it('sends each role to its own home', () => {
    expect(homeRouteName('ADMIN')).toBe('dashboard')
    expect(homeRouteName('DRIVER')).toBe('driver-home')
  })

  it('sends unauthenticated users to login', () => {
    expect(
      resolveAuthRedirect({ name: 'orders', meta: { requiresAuth: true, role: 'ADMIN' } }, null),
    ).toEqual({ name: 'login' })
  })

  it('sends authenticated users away from login by role', () => {
    expect(
      resolveAuthRedirect({ name: 'login', meta: { public: true } }, admin),
    ).toEqual({ name: 'dashboard' })
    expect(
      resolveAuthRedirect({ name: 'login', meta: { public: true } }, driver),
    ).toEqual({ name: 'driver-home' })
  })

  it('keeps admin and driver UI separated', () => {
    expect(
      resolveAuthRedirect(
        { name: 'driver-home', meta: { requiresAuth: true, role: 'DRIVER' } },
        admin,
      ),
    ).toEqual({ name: 'dashboard' })
    expect(
      resolveAuthRedirect(
        { name: 'orders', meta: { requiresAuth: true, role: 'ADMIN' } },
        driver,
      ),
    ).toEqual({ name: 'driver-home' })
    expect(
      resolveAuthRedirect(
        { name: 'driver-my-orders', meta: { requiresAuth: true, role: 'DRIVER' } },
        admin,
      ),
    ).toEqual({ name: 'dashboard' })
  })
})
