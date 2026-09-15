import { api } from './client'
import type {
  AcceptOrderResult,
  DriverOpenOrder,
  DriverOrderDetail,
} from './types'

export function listOpenDriverOrders() {
  return api.get<DriverOpenOrder[]>('/driver/orders/open')
}

export function getDriverOrder(id: string) {
  return api.get<DriverOrderDetail>(`/driver/orders/${id}`)
}

export function acceptDriverOrder(id: string) {
  return api.post<AcceptOrderResult>(`/driver/orders/${id}/accept`)
}
