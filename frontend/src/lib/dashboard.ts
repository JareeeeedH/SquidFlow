import type { DashboardBoardOrder } from '../api/types'
import {
  DASHBOARD_BOARD_STATUSES,
  type DashboardBoardStatus,
} from './order-status'

export function groupBoardOrders(orders: DashboardBoardOrder[]) {
  const groups = Object.fromEntries(
    DASHBOARD_BOARD_STATUSES.map((status) => [status, [] as DashboardBoardOrder[]]),
  ) as Record<DashboardBoardStatus, DashboardBoardOrder[]>

  for (const order of orders) {
    if ((DASHBOARD_BOARD_STATUSES as readonly string[]).includes(order.status)) {
      groups[order.status as DashboardBoardStatus].push(order)
    }
  }

  return groups
}
