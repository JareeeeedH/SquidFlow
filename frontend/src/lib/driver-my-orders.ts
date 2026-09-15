import type { DriverMyOrder } from '../api/types'

export function isCurrentDriverOrder(status: DriverMyOrder['status']) {
  return status === 'ACCEPTED' || status === 'IN_PROGRESS'
}

export function splitDriverMyOrders(orders: DriverMyOrder[]) {
  const current: DriverMyOrder[] = []
  const history: DriverMyOrder[] = []

  for (const order of orders) {
    if (isCurrentDriverOrder(order.status)) {
      current.push(order)
    } else {
      history.push(order)
    }
  }

  return { current, history }
}
