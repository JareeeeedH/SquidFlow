import { afterEach, describe, expect, it, vi } from 'vitest'
import { urlBase64ToUint8Array, vapidPublicKey } from './web-push'

describe('web push helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('decodes a URL-safe VAPID public key', () => {
    const bytes = urlBase64ToUint8Array('AQ')
    expect(Array.from(bytes)).toEqual([1])
  })

  it('reads the public VAPID key from Vite env', () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', ' public-key ')
    expect(vapidPublicKey()).toBe('public-key')
  })
})
