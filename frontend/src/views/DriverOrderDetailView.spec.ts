import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { DriverOrderDetail } from '../api/types'
import DriverOrderDetailView from './DriverOrderDetailView.vue'

vi.mock('../api/driver-orders', () => ({
  getDriverOrder: vi.fn(),
  acceptDriverOrder: vi.fn(),
}))

import { acceptDriverOrder, getDriverOrder } from '../api/driver-orders'

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
    vi.mocked(acceptDriverOrder).mockResolvedValue({
      id: 'order-1',
      status: 'ACCEPTED',
      driver_id: 'driver-1',
      accepted_at: '2026-09-15T07:05:00.000Z',
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows an OPEN order with an accept action', async () => {
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('ORD-20260915-002')
    expect(wrapper.text()).toContain('搶單中')
    expect(wrapper.text()).toContain('李小姐')
    expect(wrapper.text()).toContain('左營高鐵站')
    expect(wrapper.text()).toContain('高雄小港機場')
    expect(wrapper.text()).toContain('5人座')
    expect(wrapper.text()).toContain('NT$ 1,200')
    expect(wrapper.text()).toContain('2件行李')
    expect(wrapper.text()).toContain('我要接單')
    expect(wrapper.text()).not.toContain('開始行程')
    expect(wrapper.text()).not.toContain('完成')
  })

  it('accepts an OPEN order from the backend response then reloads detail', async () => {
    vi.mocked(getDriverOrder)
      .mockResolvedValueOnce(openOrder)
      .mockResolvedValueOnce(ownAccepted)
    const { wrapper } = await mountDetail()

    const accept = wrapper
      .findAll('button')
      .find((button) => button.text().includes('我要接單'))
    await accept!.trigger('click')
    await flushPromises()

    expect(acceptDriverOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('接單成功')
    expect(wrapper.text()).toContain('已接單')
    expect(wrapper.text()).not.toContain('我要接單')
  })

  it('shows the backend error when another driver already accepted', async () => {
    vi.mocked(acceptDriverOrder).mockRejectedValue(
      new ApiClientError(
        'ORDER_ALREADY_ACCEPTED',
        '此訂單已被其他司機接單',
        409,
      ),
    )
    vi.mocked(getDriverOrder)
      .mockResolvedValueOnce(openOrder)
      .mockRejectedValueOnce(
        new ApiClientError('NOT_FOUND', '找不到訂單', 404),
      )
    const { wrapper } = await mountDetail()

    const accept = wrapper
      .findAll('button')
      .find((button) => button.text().includes('我要接單'))
    await accept!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('ORDER_ALREADY_ACCEPTED')
    expect(wrapper.text()).toContain('此訂單已被其他司機接單')
  })

  it("shows the current driver's accepted order", async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(ownAccepted)
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('已接單')
    expect(wrapper.text()).toContain('李小姐')
    expect(wrapper.text()).not.toContain('我要接單')
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
