import { api } from './client'
import type {
  CancelOrderResult,
  CreateOrderInput,
  CreateOrderResult,
  OnlineDriverDistanceItem,
  OrderDetail,
  OrderListItem,
  OrderListQuery,
  PublishOrderResult,
} from './types'
import { toOrderWriteBody } from '../lib/order-form'

export function ordersListPath(query: OrderListQuery = {}): string {
  const params = new URLSearchParams()
  if (query.search) {
    params.set('search', query.search)
  }
  if (query.status) {
    params.set('status', query.status)
  }
  if (query.date) {
    params.set('date', query.date)
  }

  const qs = params.toString()
  return qs ? `/orders?${qs}` : '/orders'
}

export function listOrders(query: OrderListQuery = {}) {
  return api.get<OrderListItem[]>(ordersListPath(query))
}

export function getOrder(id: string) {
  return api.get<OrderDetail>(`/orders/${id}`)
}

export function createOrder(input: CreateOrderInput) {
  return api.post<CreateOrderResult>('/orders', toOrderWriteBody(input))
}

export function updateOrder(id: string, input: CreateOrderInput) {
  return api.put<OrderDetail>(`/orders/${id}`, toOrderWriteBody(input))
}

export function deleteOrder(id: string) {
  return api.delete<null>(`/orders/${id}`)
}

export function publishOrder(id: string) {
  return api.post<PublishOrderResult>(`/orders/${id}/publish`)
}

export function cancelOrder(id: string) {
  return api.post<CancelOrderResult>(`/orders/${id}/cancel`)
}

export function listOnlineDriverDistances(orderId: string) {
  return api.get<OnlineDriverDistanceItem[]>(
    `/orders/${orderId}/online-driver-distances`,
  )
}
