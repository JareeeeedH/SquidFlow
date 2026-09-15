import { computed, onMounted, onUnmounted } from 'vue'
import type { Router } from 'vue-router'
import {
  driverOrderDetailLocation,
  orderIdFromPushClickMessage,
} from './push-handlers'

export function navigateFromPushClick(router: Router, data: unknown) {
  const orderId = orderIdFromPushClickMessage(data)
  if (!orderId) {
    return false
  }
  void router.push(driverOrderDetailLocation(orderId))
  return true
}

export function usePushNotificationClicks(router: Router) {
  const supported = computed(
    () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  )

  function onMessage(event: MessageEvent) {
    navigateFromPushClick(router, event.data)
  }

  onMounted(() => {
    if (!supported.value) {
      return
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
  })

  onUnmounted(() => {
    if (!supported.value) {
      return
    }
    navigator.serviceWorker.removeEventListener('message', onMessage)
  })
}
