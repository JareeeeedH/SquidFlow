import type { CurrentUser } from '../api/types'

export type AuthRedirectTarget = {
  name?: string | symbol | null
  meta: {
    public?: boolean
    requiresAuth?: boolean
    role?: CurrentUser['role']
  }
}

export function homeRouteName(role: CurrentUser['role']) {
  return role === 'DRIVER' ? 'driver-home' : 'dashboard'
}

export function resolveAuthRedirect(
  to: AuthRedirectTarget,
  user: CurrentUser | null,
): { name: string } | true {
  if (to.meta.requiresAuth && !user) {
    return { name: 'login' }
  }

  if (to.name === 'login' && user) {
    return { name: homeRouteName(user.role) }
  }

  if (to.meta.role && user && user.role !== to.meta.role) {
    return { name: homeRouteName(user.role) }
  }

  return true
}