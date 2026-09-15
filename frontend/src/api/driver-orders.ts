import { api } from './client'
import type {
  AcceptOrderResult,
  CompleteOrderResult,
  DriverMyOrder,
  DriverOpenOrder,
  DriverOrderDetail,
  OrderStatus,
  StartOrderResult,
} from './types'

export type DriverMyOrdersQuery = {
  status?: OrderStatus
}

export function driverMyOrdersPath(query: DriverMyOrdersQuery = {}): string {
  const params = new URLSearchParams()
  if (query.status) {
    params.set('status', query.status)
  }
  const qs = params.toString()
  return qs ? `/driver/orders?${qs}` : '/driver/orders'
}

export function listDriverOrders(query: DriverMyOrdersQuery = {}) {
  return api.get<DriverMyOrder[]>(driverMyOrdersPath(query))
}

export function listOpenDriverOrders() {
  return api.get<DriverOpenOrder[]>('/driver/orders/open')
}

export function getDriverOrder(id: string) {
  return api.get<DriverOrderDetail>(`/driver/orders/${id}`)
}

export function acceptDriverOrder(id: string) {
  return api.post<AcceptOrderResult>(`/driver/orders/${id}/accept`)
}

export function startDriverOrder(id: string) {
  return api.post<StartOrderResult>(`/driver/orders/${id}/start`)
}

export function completeDriverOrder(id: string) {
  return api.post<CompleteOrderResult>(`/driver/orders/${id}/complete`)
}
