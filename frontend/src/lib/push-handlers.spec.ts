import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  driverOrderDetailLocation,
  driverOrderDetailPath,
  orderIdFromPushClickMessage,
  parsePushPayload,
  pushClickMessage,
} from './push-handlers'

describe('push handlers', () => {
  it('parses the backend Web Push payload', () => {
    expect(
      parsePushPayload({
        title: '🚕 新派車單',
        body: '左營高鐵站 → 小港機場\n$1,200',
        order_id: 'order-1',
      }),
    ).toEqual({
      title: '🚕 新派車單',
      body: '左營高鐵站 → 小港機場\n$1,200',
      orderId: 'order-1',
    })
  })

  it('falls back when the payload is missing', () => {
    expect(parsePushPayload(null)).toEqual({
      title: '🚕 新派車單',
      body: '',
      orderId: null,
    })
  })

  it('builds the driver order detail path used by the service worker', () => {
    expect(driverOrderDetailPath('order-1')).toBe('/driver/orders/order-1')
  })

  it('routes a notification click to driver order detail', () => {
    expect(driverOrderDetailLocation('order-1')).toEqual({
      name: 'driver-order-detail',
      params: { id: 'order-1' },
    })
    expect(orderIdFromPushClickMessage(pushClickMessage('order-1'))).toBe(
      'order-1',
    )
    expect(orderIdFromPushClickMessage({ type: 'OTHER' })).toBeNull()
  })
})

describe('service worker contract', () => {
  it('shows the payload and opens the matching order detail', () => {
    const sw = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../public/sw.js'),
      'utf8',
    )
    expect(sw).toContain('showNotification')
    expect(sw).toContain('/driver/orders/')
    expect(sw).toContain('PUSH_NOTIFICATION_CLICK')
    expect(sw).toContain('order_id')
    expect(sw).toContain('查看訂單')
  })
})
