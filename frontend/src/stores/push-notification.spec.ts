import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../api/types'

vi.mock('../api/notifications', () => ({
  createPushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
}))

vi.mock('../lib/web-push', () => ({
  isPushSupported: vi.fn(),
  notificationPermission: vi.fn(),
  getExistingSubscription: vi.fn(),
  createBrowserSubscription: vi.fn(),
  subscriptionKeys: vi.fn(),
}))

import {
  createPushSubscription,
  deletePushSubscription,
} from '../api/notifications'
import {
  createBrowserSubscription,
  getExistingSubscription,
  isPushSupported,
  notificationPermission,
  subscriptionKeys,
} from '../lib/web-push'
import { usePushNotificationStore } from './push-notification'

const keys = {
  endpoint: 'https://push.example.test/a',
  p256dh: 'p256dh',
  auth: 'auth',
}

function fakeSubscription() {
  return {
    endpoint: keys.endpoint,
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: () => keys,
  }
}

describe('push notification store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(isPushSupported).mockReturnValue(true)
    vi.mocked(notificationPermission).mockReturnValue('default')
    vi.mocked(getExistingSubscription).mockResolvedValue(null)
    vi.mocked(subscriptionKeys).mockReturnValue(keys)
    vi.mocked(createPushSubscription).mockResolvedValue({ id: 'sub-1' })
    vi.mocked(deletePushSubscription).mockResolvedValue(null)
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps notifications off when permission is default', async () => {
    const store = usePushNotificationStore()
    await store.sync()

    expect(store.status).toBe('off')
    expect(store.label).toBe('通知未開啟')
    expect(store.canEnable).toBe(true)
    expect(createPushSubscription).not.toHaveBeenCalled()
  })

  it('shows denied without calling subscribe APIs', async () => {
    vi.mocked(notificationPermission).mockReturnValue('denied')
    const store = usePushNotificationStore()
    await store.sync()

    expect(store.status).toBe('denied')
    expect(store.label).toBe('通知未開啟')
    expect(store.canEnable).toBe(false)
    expect(createPushSubscription).not.toHaveBeenCalled()
  })

  it('restores an existing browser subscription after login', async () => {
    vi.mocked(notificationPermission).mockReturnValue('granted')
    vi.mocked(getExistingSubscription).mockResolvedValue(
      fakeSubscription() as never,
    )

    const store = usePushNotificationStore()
    await store.sync()

    expect(createPushSubscription).toHaveBeenCalledWith(keys)
    expect(store.status).toBe('on')
    expect(store.label).toBe('通知已開啟')
    expect(store.canDisable).toBe(true)
  })

  it('subscribes and posts the backend subscription', async () => {
    const subscription = fakeSubscription()
    vi.mocked(createBrowserSubscription).mockResolvedValue(subscription as never)

    const store = usePushNotificationStore()
    await store.enable()

    expect(Notification.requestPermission).toHaveBeenCalled()
    expect(createBrowserSubscription).toHaveBeenCalled()
    expect(createPushSubscription).toHaveBeenCalledWith(keys)
    expect(store.status).toBe('on')
  })

  it('stays off when the browser denies permission', async () => {
    vi.mocked(Notification.requestPermission).mockResolvedValue('denied')
    const store = usePushNotificationStore()
    await store.enable()

    expect(store.status).toBe('denied')
    expect(store.label).toBe('通知未開啟')
    expect(createBrowserSubscription).not.toHaveBeenCalled()
    expect(createPushSubscription).not.toHaveBeenCalled()
  })

  it('unsubscribes locally and deletes the backend subscription', async () => {
    const subscription = fakeSubscription()
    vi.mocked(getExistingSubscription).mockResolvedValue(subscription as never)
    const store = usePushNotificationStore()
    store.status = 'on'

    await store.disable()

    expect(deletePushSubscription).toHaveBeenCalledWith(keys.endpoint)
    expect(subscription.unsubscribe).toHaveBeenCalled()
    expect(store.status).toBe('off')
  })

  it('removes the subscription during logout cleanup', async () => {
    const subscription = fakeSubscription()
    vi.mocked(getExistingSubscription).mockResolvedValue(subscription as never)
    const store = usePushNotificationStore()
    store.status = 'on'

    await store.teardownOnLogout()

    expect(deletePushSubscription).toHaveBeenCalledWith(keys.endpoint)
    expect(subscription.unsubscribe).toHaveBeenCalled()
    expect(store.status).toBe('off')
  })

  it('does not throw when backend unsubscribe fails during logout', async () => {
    vi.mocked(getExistingSubscription).mockResolvedValue(
      fakeSubscription() as never,
    )
    vi.mocked(deletePushSubscription).mockRejectedValue(
      new ApiClientError('NETWORK_ERROR', '無法連線到伺服器', 0),
    )
    const store = usePushNotificationStore()

    await expect(store.teardownOnLogout()).resolves.toBeUndefined()
    expect(store.status).toBe('off')
  })
})
