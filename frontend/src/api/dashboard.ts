import { api } from './client'
import type { AdminDashboard } from './types'

export function getAdminDashboard() {
  return api.get<AdminDashboard>('/admin/dashboard')
}
