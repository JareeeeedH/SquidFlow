import { api } from './client'

export type PushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
}

export type PushSubscriptionResult = {
  id: string
}

export function createPushSubscription(input: PushSubscriptionInput) {
  return api.post<PushSubscriptionResult>('/notifications/subscription', input)
}

export function deletePushSubscription(endpoint: string) {
  return api.delete<null>('/notifications/subscription', { endpoint })
}
