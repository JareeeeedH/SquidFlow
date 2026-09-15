import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { DriverOrderDetail } from '../api/types'
import DriverOrderDetailView from './DriverOrderDetailView.vue'

vi.mock('../api/driver-orders', () => ({
  getDriverOrder: vi.fn(),
}))

import { getDriverOrder } from '../api/driver-orders'

const openOrder: DriverOrderDetail = {
  id: 'order-1',
  order_no: 'ORD-20260915-002',
  customer_name: '李小姐',
  pickup_location: '左營高鐵站',
  destination: '高雄小港機場',
  scheduled_at: '2026-09-15T07:30:00.000Z',
  vehicle_type: '5人座',
  price: 1200,
  note: '2件行李',
  status: 'OPEN',
}

const ownAccepted: DriverOrderDetail = {
  ...openOrder,
  status: 'ACCEPTED',
}

async function mountDetail(id = 'order-1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/driver/orders/open',
        name: 'driver-open-orders',
        component: { template: '<div />' },
      },
      {
        path: '/driver/orders/:id',
        name: 'driver-order-detail',
        component: DriverOrderDetailView,
      },
    ],
  })
  await router.push(`/driver/orders/${id}`)
  await router.isReady()
  const wrapper = mount(DriverOrderDetailView, {
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper }
}

describe('DriverOrderDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getDriverOrder).mockResolvedValue(openOrder)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows an OPEN order without accept actions', async () => {
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('ORD-20260915-002')
    expect(wrapper.text()).toContain('搶單中')
    expect(wrapper.text()).toContain('李小姐')
    expect(wrapper.text()).toContain('左營高鐵站')
    expect(wrapper.text()).toContain('高雄小港機場')
    expect(wrapper.text()).toContain('5人座')
    expect(wrapper.text()).toContain('NT$ 1,200')
    expect(wrapper.text()).toContain('2件行李')
    expect(wrapper.text()).not.toContain('我要接單')
    expect(wrapper.text()).not.toContain('開始行程')
    expect(wrapper.text()).not.toContain('完成')
  })

  it('shows the current driver\'s accepted order', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(ownAccepted)
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('已接單')
    expect(wrapper.text()).toContain('李小姐')
  })

  it('shows 404 when the order is missing or belongs to another driver', async () => {
    vi.mocked(getDriverOrder).mockRejectedValue(
      new ApiClientError('NOT_FOUND', '找不到訂單', 404),
    )
    const { wrapper } = await mountDetail('missing')

    expect(wrapper.text()).toContain('找不到訂單')
    expect(wrapper.text()).toContain('NOT_FOUND')
    expect(wrapper.text()).not.toContain('李小姐')
  })
})
