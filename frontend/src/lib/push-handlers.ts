export const PUSH_CLICK_TYPE = 'PUSH_NOTIFICATION_CLICK'

export type PushPayload = {
  title: string
  body: string
  order_id?: string
}

export function driverOrderDetailPath(orderId: string) {
  return `/driver/orders/${orderId}`
}

export function parsePushPayload(raw: unknown): {
  title: string
  body: string
  orderId: string | null
} {
  if (raw === null || typeof raw !== 'object') {
    return { title: '🚕 新派車單', body: '', orderId: null }
  }

  const data = raw as Record<string, unknown>
  const title = typeof data.title === 'string' && data.title.trim() !== ''
    ? data.title
    : '🚕 新派車單'
  const body = typeof data.body === 'string' ? data.body : ''
  const orderId =
    typeof data.order_id === 'string' && data.order_id.trim() !== ''
      ? data.order_id
      : null

  return { title, body, orderId }
}

export function pushClickMessage(orderId: string) {
  return {
    type: PUSH_CLICK_TYPE,
    order_id: orderId,
  }
}

export function orderIdFromPushClickMessage(data: unknown): string | null {
  if (data === null || typeof data !== 'object') {
    return null
  }
  const payload = data as Record<string, unknown>
  if (payload.type !== PUSH_CLICK_TYPE) {
    return null
  }
  if (typeof payload.order_id !== 'string' || payload.order_id.trim() === '') {
    return null
  }
  return payload.order_id
}

export function driverOrderDetailLocation(orderId: string) {
  return {
    name: 'driver-order-detail' as const,
    params: { id: orderId },
  }
}
