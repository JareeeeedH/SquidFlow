import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { DriverOrderDetail } from '../api/types'
import SlideToConfirm from '../components/SlideToConfirm.vue'
import DriverOrderDetailView from './DriverOrderDetailView.vue'

vi.mock('../api/driver-orders', () => ({
  getDriverOrder: vi.fn(),
  acceptDriverOrder: vi.fn(),
  startDriverOrder: vi.fn(),
  completeDriverOrder: vi.fn(),
}))

vi.mock('../api/driver-location', () => ({
  getDriverLocation: vi.fn(),
}))

import {
  acceptDriverOrder,
  completeDriverOrder,
  getDriverOrder,
  startDriverOrder,
} from '../api/driver-orders'
import { getDriverLocation } from '../api/driver-location'

const openOrder: DriverOrderDetail = {
  id: 'order-1',
  order_no: 'ORD-20260915-002',
  customer_name: '李小姐',
  pickup_location: '左營高鐵站',
  destination: '高雄小港機場',
  created_at: '2026-09-15T07:30:00.000Z',
  price: 1200,
  note: '2件行李',
  status: 'OPEN',
  distance_meters: null,
  pickup_latitude: null,
  pickup_longitude: null,
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
        path: '/driver/orders',
        name: 'driver-my-orders',
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

async function confirmSlide(wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper']) {
  const slide = wrapper.getComponent(SlideToConfirm)
  slide.vm.complete()
  await flushPromises()
}

describe('DriverOrderDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getDriverOrder).mockResolvedValue(openOrder)
    vi.mocked(getDriverLocation).mockResolvedValue({
      latitude: null,
      longitude: null,
      location_updated_at: null,
    })
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

  it('shows an OPEN order with a slide-to-accept action', async () => {
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('ORD-20260915-002')
    expect(wrapper.text()).toContain('搶單中')
    expect(wrapper.text()).toContain('李小姐')
    expect(wrapper.text()).toContain('左營高鐵站')
    expect(wrapper.text()).toContain('高雄小港機場')
    expect(wrapper.text()).toContain('NT$ 1,200')
    expect(wrapper.text()).toContain('2件行李')
    expect(wrapper.text()).toContain('滑動接單')
    expect(wrapper.text()).not.toContain('滑動開始行程')
    expect(wrapper.text()).not.toContain('滑動完成訂單')
    expect(wrapper.text()).toContain('返回')
  })

  it('accepts an OPEN order from the backend response then reloads detail', async () => {
    vi.mocked(getDriverOrder)
      .mockResolvedValueOnce(openOrder)
      .mockResolvedValueOnce(ownAccepted)
    const { wrapper } = await mountDetail()

    await confirmSlide(wrapper)

    expect(acceptDriverOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('接單成功')
    expect(wrapper.text()).toContain('已接單')
    expect(wrapper.text()).not.toContain('滑動接單')
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

    await confirmSlide(wrapper)

    expect(wrapper.text()).toContain('ORDER_ALREADY_ACCEPTED')
    expect(wrapper.text()).toContain('此訂單已被其他司機接單')
  })

  it("shows start on the current driver's accepted order", async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(ownAccepted)
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('已接單')
    expect(wrapper.text()).toContain('李小姐')
    expect(wrapper.text()).toContain('滑動開始行程')
    expect(wrapper.text()).toContain('返回')
    expect(wrapper.text()).not.toContain('滑動接單')
    expect(wrapper.text()).not.toContain('滑動完成訂單')
  })

  it('starts then completes from order detail via slide confirm', async () => {
    vi.mocked(startDriverOrder).mockResolvedValue({
      id: 'order-1',
      status: 'IN_PROGRESS',
      started_at: '2026-09-15T07:40:00.000Z',
    })
    vi.mocked(completeDriverOrder).mockResolvedValue({
      id: 'order-1',
      status: 'COMPLETED',
      completed_at: '2026-09-15T08:20:00.000Z',
    })
    vi.mocked(getDriverOrder)
      .mockResolvedValueOnce(ownAccepted)
      .mockResolvedValueOnce({ ...ownAccepted, status: 'IN_PROGRESS' })
      .mockResolvedValueOnce({ ...ownAccepted, status: 'COMPLETED' })

    const { wrapper } = await mountDetail()
    await confirmSlide(wrapper)

    expect(startDriverOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('行程已開始')
    expect(wrapper.text()).toContain('滑動完成訂單')

    await confirmSlide(wrapper)

    expect(completeDriverOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('訂單已完成')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).not.toContain('滑動開始行程')
    expect(wrapper.text()).not.toContain('滑動完成訂單')
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
