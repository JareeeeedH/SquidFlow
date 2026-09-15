import { api } from './client'
import type { DriverOnlineStatusResult, OnlineStatus } from './types'

export function updateDriverOnlineStatus(status: OnlineStatus) {
  return api.patch<DriverOnlineStatusResult>('/driver/status', { status })
}
