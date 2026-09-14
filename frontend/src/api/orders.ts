import { api } from './client'
import type { OrderListItem, OrderListQuery } from './types'

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
