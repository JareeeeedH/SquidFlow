import { api } from './client'
import type {
  CreateOrderInput,
  CreateOrderResult,
  OrderDetail,
  OrderListItem,
  OrderListQuery,
} from './types'

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
  const body: CreateOrderInput = {
    customer_name: input.customer_name,
    pickup_location: input.pickup_location,
    destination: input.destination,
    scheduled_at: input.scheduled_at,
    vehicle_type: input.vehicle_type,
    price: input.price,
  }
  if (input.note) {
    body.note = input.note
  }
  return api.post<CreateOrderResult>('/orders', body)
}
