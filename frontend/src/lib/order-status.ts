import type { OrderStatus } from '../api/types'

export const ORDER_STATUSES: OrderStatus[] = [
  'DRAFT',
  'OPEN',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]

export const DASHBOARD_BOARD_STATUSES = [
  'DRAFT',
  'OPEN',
  'ACCEPTED',
  'IN_PROGRESS',
] as const satisfies readonly OrderStatus[]

export type DashboardBoardStatus = (typeof DASHBOARD_BOARD_STATUSES)[number]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: '草稿',
  OPEN: '搶單中',
  ACCEPTED: '已接單',
  IN_PROGRESS: '行程中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

export const OPERATIONAL_ORDER_STATUSES = [
  'OPEN',
  'ACCEPTED',
  'IN_PROGRESS',
] as const satisfies readonly OrderStatus[]

export function isOperationalStatus(status: OrderStatus) {
  return (OPERATIONAL_ORDER_STATUSES as readonly OrderStatus[]).includes(status)
}

export function parseOrderStatus(raw: unknown): OrderStatus | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') {
    return null
  }
  return ORDER_STATUSES.includes(value as OrderStatus)
    ? (value as OrderStatus)
    : null
}
