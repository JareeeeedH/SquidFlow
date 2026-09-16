import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { DriverOpenOrder } from '../api/types'
import DriverOpenOrdersView from './DriverOpenOrdersView.vue'

vi.mock('../api/driver-orders', () => ({
  listOpenDriverOrders: vi.fn(),
}))

import { listOpenDriverOrders } from '../api/driver-orders'

const sample: DriverOpenOrder = {
  id: 'order-1',
  order_no: 'ORD-20260915-002',
  pickup_location: '左營高鐵站',
  destination: '高雄小港機場',
  created_at: '2026-09-15T07:30:00.000Z',
  price: 1200,
  note: '2件行李',
  distance_meters: null,
}

async function mountOpen() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/driver/orders/open',
        name: 'driver-open-orders',
        component: DriverOpenOrdersView,
      },
      {
        path: '/driver/orders/:id',
        name: 'driver-order-detail',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/driver/orders/open')
  await router.isReady()
  const wrapper = mount(DriverOpenOrdersView, {
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('DriverOpenOrdersView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(listOpenDriverOrders).mockResolvedValue([sample])
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('loads open orders as cards', async () => {
    const { wrapper } = await mountOpen()

    expect(wrapper.text()).toContain('ORD-20260915-002')
    expect(wrapper.text()).toContain('左營高鐵站')
    expect(wrapper.text()).toContain('高雄小港機場')
    expect(wrapper.text()).toContain('NT$ 1,200')
    expect(wrapper.text()).toContain('搶單中')
    expect(wrapper.text()).toContain('查看 →')
    expect(wrapper.text()).not.toContain('2件行李')
  })

  it('shows empty state when there are no open orders', async () => {
    vi.mocked(listOpenDriverOrders).mockResolvedValue([])
    const { wrapper } = await mountOpen()

    expect(wrapper.text()).toContain('目前沒有可搶訂單')
  })

  it('shows error and retry', async () => {
    vi.mocked(listOpenDriverOrders).mockRejectedValueOnce(
      new ApiClientError('INTERNAL_ERROR', '系統發生錯誤', 500),
    )
    const { wrapper } = await mountOpen()

    expect(wrapper.text()).toContain('INTERNAL_ERROR')
    expect(wrapper.text()).toContain('重試')

    vi.mocked(listOpenDriverOrders).mockResolvedValue([sample])
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text().includes('重試'))
    await retry!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('ORD-20260915-002')
  })

  it('opens detail from a card', async () => {
    const { wrapper, router } = await mountOpen()
    const push = vi.spyOn(router, 'push')

    await wrapper.get('button.card').trigger('click')

    expect(push).toHaveBeenCalledWith({
      name: 'driver-order-detail',
      params: { id: 'order-1' },
    })
  })
})
