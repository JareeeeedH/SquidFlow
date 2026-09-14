import { api } from './client'
import type { CurrentUser, LoginUser } from './types'

export function login(username: string, password: string) {
  return api.post<LoginUser>(
    '/auth/login',
    { username, password },
    { skipUnauthorizedHandler: true },
  )
}

export function fetchCurrentUser() {
  return api.get<CurrentUser>('/auth/me', { skipUnauthorizedHandler: true })
}

export function logout() {
  return api.post<null>('/auth/logout', undefined, {
    skipUnauthorizedHandler: true,
  })
}
