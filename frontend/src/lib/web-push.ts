export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`
  const raw = padded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function vapidPublicKey(): string {
  const value = import.meta.env.VITE_VAPID_PUBLIC_KEY
  return typeof value === 'string' ? value.trim() : ''
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof Notification !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) {
    return 'unsupported'
  }
  return Notification.permission
}

export function subscriptionKeys(subscription: PushSubscription) {
  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return null
  }
  return { endpoint, p256dh, auth }
}

export async function registerPushWorker() {
  return navigator.serviceWorker.register('/sw.js')
}

export async function getPushRegistration() {
  const existing = await navigator.serviceWorker.getRegistration('/sw.js')
  if (existing) {
    return existing
  }
  return registerPushWorker()
}

export async function getExistingSubscription() {
  if (!isPushSupported()) {
    return null
  }
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!registration) {
    return null
  }
  return registration.pushManager.getSubscription()
}

export async function createBrowserSubscription() {
  const key = vapidPublicKey()
  if (!key) {
    throw new Error('MISSING_VAPID_PUBLIC_KEY')
  }
  const registration = await getPushRegistration()
  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    return existing
  }
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  })
}
