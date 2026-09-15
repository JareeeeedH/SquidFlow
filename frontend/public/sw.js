/* Driver Web Push service worker. Keep click URL in sync with
 * frontend/src/lib/push-handlers.ts */

const PUSH_CLICK_TYPE = 'PUSH_NOTIFICATION_CLICK'

function parsePushPayload(raw) {
  if (raw === null || typeof raw !== 'object') {
    return { title: '🚕 新派車單', body: '', orderId: null }
  }
  const title =
    typeof raw.title === 'string' && raw.title.trim() !== ''
      ? raw.title
      : '🚕 新派車單'
  const body = typeof raw.body === 'string' ? raw.body : ''
  const orderId =
    typeof raw.order_id === 'string' && raw.order_id.trim() !== ''
      ? raw.order_id
      : null
  return { title, body, orderId }
}

function driverOrderDetailPath(orderId) {
  return `/driver/orders/${orderId}`
}

self.addEventListener('push', (event) => {
  let payload = { title: '🚕 新派車單', body: '', orderId: null }
  try {
    payload = parsePushPayload(event.data ? event.data.json() : null)
  } catch {
    payload = parsePushPayload(null)
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { order_id: payload.orderId },
      actions: payload.orderId
        ? [{ action: 'open', title: '查看訂單' }]
        : [],
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const orderId = event.notification.data && event.notification.data.order_id
  if (typeof orderId !== 'string' || orderId.trim() === '') {
    return
  }

  const path = driverOrderDetailPath(orderId)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(
      async (windowClients) => {
        for (const client of windowClients) {
          if ('focus' in client) {
            await client.focus()
          }
          client.postMessage({
            type: PUSH_CLICK_TYPE,
            order_id: orderId,
          })
          return
        }
        if (self.clients.openWindow) {
          await self.clients.openWindow(path)
        }
      },
    ),
  )
})
