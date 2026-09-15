import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createPushSubscription,
  deletePushSubscription,
} from '../api/notifications'
import { ApiClientError } from '../api/types'
import {
  createBrowserSubscription,
  getExistingSubscription,
  isPushSupported,
  notificationPermission,
  subscriptionKeys,
} from '../lib/web-push'

export type PushUiStatus = 'unsupported' | 'denied' | 'off' | 'on'

export const usePushNotificationStore = defineStore('pushNotification', () => {
  const status = ref<PushUiStatus>('off')
  const updating = ref(false)
  const error = ref<{ code: string; message: string } | null>(null)
  let syncPromise: Promise<void> | null = null

  const enabled = computed(() => status.value === 'on')
  const label = computed(() =>
    status.value === 'on' ? '通知已開啟' : '通知未開啟',
  )
  const canEnable = computed(() => status.value === 'off')
  const canDisable = computed(() => status.value === 'on')

  function reset() {
    status.value = 'off'
    updating.value = false
    error.value = null
  }

  async function sync() {
    if (syncPromise) {
      return syncPromise
    }
    syncPromise = syncNow().finally(() => {
      syncPromise = null
    })
    return syncPromise
  }

  async function syncNow() {
    error.value = null
    const permission = notificationPermission()
    if (permission === 'unsupported') {
      status.value = 'unsupported'
      return
    }
    if (permission === 'denied') {
      status.value = 'denied'
      return
    }
    if (permission !== 'granted') {
      status.value = 'off'
      return
    }

    try {
      const subscription = await getExistingSubscription()
      if (!subscription) {
        status.value = 'off'
        return
      }
      const keys = subscriptionKeys(subscription)
      if (!keys) {
        status.value = 'off'
        return
      }
      await createPushSubscription(keys)
      status.value = 'on'
    } catch {
      status.value = 'off'
    }
  }

  async function enable() {
    if (updating.value || status.value === 'denied' || status.value === 'on') {
      return
    }

    updating.value = true
    error.value = null

    try {
      if (!isPushSupported()) {
        status.value = 'unsupported'
        return
      }

      const permission = await Notification.requestPermission()
      if (permission === 'denied') {
        status.value = 'denied'
        return
      }
      if (permission !== 'granted') {
        status.value = 'off'
        return
      }

      const subscription = await createBrowserSubscription()
      const keys = subscriptionKeys(subscription)
      if (!keys) {
        status.value = 'off'
        error.value = {
          code: 'VALIDATION_ERROR',
          message: '無法建立通知訂閱',
        }
        return
      }
      await createPushSubscription(keys)
      status.value = 'on'
    } catch (caught) {
      status.value = 'off'
      if (caught instanceof Error && caught.message === 'MISSING_VAPID_PUBLIC_KEY') {
        error.value = {
          code: 'VALIDATION_ERROR',
          message: '尚未設定通知金鑰',
        }
        return
      }
      if (caught instanceof ApiClientError) {
        error.value = {
          code: caught.code,
          message: caught.message,
        }
        return
      }
      error.value = {
        code: 'INTERNAL_ERROR',
        message: '無法開啟通知',
      }
    } finally {
      updating.value = false
    }
  }

  async function disable() {
    if (updating.value || status.value !== 'on') {
      return
    }

    updating.value = true
    error.value = null

    try {
      await removeCurrentSubscription()
      status.value = 'off'
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        error.value = {
          code: caught.code,
          message: caught.message,
        }
        return
      }
      error.value = {
        code: 'INTERNAL_ERROR',
        message: '無法關閉通知',
      }
    } finally {
      updating.value = false
    }
  }

  async function teardownOnLogout() {
    try {
      await removeCurrentSubscription()
    } catch {
      // Logout must still continue.
    } finally {
      reset()
    }
  }

  async function removeCurrentSubscription() {
    const subscription = await getExistingSubscription()
    if (!subscription) {
      return
    }
    const keys = subscriptionKeys(subscription)
    if (keys) {
      await deletePushSubscription(keys.endpoint)
    }
    await subscription.unsubscribe()
  }

  return {
    status,
    enabled,
    label,
    canEnable,
    canDisable,
    updating,
    error,
    sync,
    enable,
    disable,
    teardownOnLogout,
    reset,
  }
})
