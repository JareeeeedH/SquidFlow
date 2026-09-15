import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { navigateFromPushClick } from './push-clicks'
import { pushClickMessage } from './push-handlers'

describe('push notification clicks', () => {
  it('navigates to the matching driver order detail', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'driver-home', component: { template: '<div />' } },
        {
          path: '/driver/orders/:id',
          name: 'driver-order-detail',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push('/')
    await router.isReady()
    const push = vi.spyOn(router, 'push')

    expect(navigateFromPushClick(router, pushClickMessage('order-99'))).toBe(
      true,
    )
    expect(push).toHaveBeenCalledWith({
      name: 'driver-order-detail',
      params: { id: 'order-99' },
    })
  })

  it('ignores unrelated worker messages', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'driver-home', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    const push = vi.spyOn(router, 'push')

    expect(navigateFromPushClick(router, { type: 'ping' })).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })
})
