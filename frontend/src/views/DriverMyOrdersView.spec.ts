import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { DriverMyOrder } from '../api/types'
import SlideToConfirm from '../components/SlideToConfirm.vue'
import DriverMyOrdersView from './DriverMyOrdersView.vue'

vi.mock('../api/driver-orders', () => ({
  listDriverOrders: vi.fn(),
  startDriverOrder: vi.fn(),
  completeDriverOrder: vi.fn(),
}))

import {
  completeDriverOrder,
  listDriverOrders,
  startDriverOrder,
} from '../api/driver-orders'

const accepted: DriverMyOrder = {
  id: 'order-1',
  order_no: 'ORD-20260915-010',
  pickup_location: '左營高鐵站',
  destination: '高雄小港機場',
  created_at: '2026-09-15T07:30:00.000Z',
  price: 1200,
  status: 'ACCEPTED',
  distance_meters: null,
}

const completed: DriverMyOrder = {
  ...accepted,
  id: 'order-2',
  order_no: 'ORD-20260915-009',
  status: 'COMPLETED',
}

async function mountMine() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/driver/orders',
        name: 'driver-my-orders',
        component: DriverMyOrdersView,
      },
      {
        path: '/driver/orders/:id',
        name: 'driver-order-detail',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/driver/orders')
  await router.isReady()
  const wrapper = mount(DriverMyOrdersView, {
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

async function confirmSlide(wrapper: Awaited<ReturnType<typeof mountMine>>['wrapper']) {
  const slide = wrapper.getComponent(SlideToConfirm)
  slide.vm.complete()
  await flushPromises()
}

describe('DriverMyOrdersView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(listDriverOrders).mockResolvedValue([accepted, completed])
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('splits current and history orders', async () => {
    const { wrapper } = await mountMine()

    expect(wrapper.text()).toContain('目前訂單')
    expect(wrapper.text()).toContain('歷史訂單')
    expect(wrapper.text()).toContain('ORD-20260915-010')
    expect(wrapper.text()).toContain('ORD-20260915-009')
    expect(wrapper.text()).toContain('已接單')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).toContain('滑動開始行程')
    expect(wrapper.text()).not.toContain('滑動完成訂單')
    expect(wrapper.text()).not.toContain('滑動接單')
    expect(wrapper.text()).not.toContain('取消訂單')
  })

  it('starts an accepted order then shows complete', async () => {
    vi.mocked(startDriverOrder).mockResolvedValue({
      id: 'order-1',
      status: 'IN_PROGRESS',
      started_at: '2026-09-15T07:40:00.000Z',
    })
    vi.mocked(listDriverOrders)
      .mockResolvedValueOnce([accepted, completed])
      .mockResolvedValueOnce([
        { ...accepted, status: 'IN_PROGRESS' },
        completed,
      ])

    const { wrapper } = await mountMine()
    await confirmSlide(wrapper)

    expect(startDriverOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('行程已開始')
    expect(wrapper.text()).toContain('行程中')
    expect(wrapper.text()).toContain('滑動完成訂單')
    expect(wrapper.text()).not.toContain('滑動開始行程')
  })

  it('completes an in-progress order into history', async () => {
    vi.mocked(completeDriverOrder).mockResolvedValue({
      id: 'order-1',
      status: 'COMPLETED',
      completed_at: '2026-09-15T08:20:00.000Z',
    })
    vi.mocked(listDriverOrders)
      .mockResolvedValueOnce([{ ...accepted, status: 'IN_PROGRESS' }])
      .mockResolvedValueOnce([{ ...accepted, status: 'COMPLETED' }])

    const { wrapper } = await mountMine()
    await confirmSlide(wrapper)

    expect(completeDriverOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('訂單已完成')
    expect(wrapper.text()).toContain('目前沒有進行中的訂單')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).not.toContain('滑動完成訂單')
  })

  it('shows backend errors without inventing a local status', async () => {
    vi.mocked(startDriverOrder).mockRejectedValue(
      new ApiClientError('INVALID_ORDER_STATUS', '訂單狀態不允許此操作', 409),
    )
    vi.mocked(listDriverOrders)
      .mockResolvedValueOnce([accepted])
      .mockResolvedValueOnce([{ ...accepted, status: 'IN_PROGRESS' }])

    const { wrapper } = await mountMine()
    await confirmSlide(wrapper)

    expect(wrapper.text()).toContain('INVALID_ORDER_STATUS')
    expect(wrapper.text()).toContain('訂單狀態不允許此操作')
  })

  it('opens order detail from a current card', async () => {
    const { wrapper, router } = await mountMine()
    const push = vi.spyOn(router, 'push')
    await wrapper.get('.card-main').trigger('click')

    expect(push).toHaveBeenCalledWith({
      name: 'driver-order-detail',
      params: { id: 'order-1' },
    })
  })

  it('keeps history card hierarchy with date above route and order no below', async () => {
    vi.mocked(listDriverOrders).mockResolvedValue([
      {
        ...completed,
        pickup_location:
          '高雄市左營區高鐵路一段非常非常非常非常非常長的上車地址名稱測試用字串',
        destination:
          '高雄市小港區中山四路非常非常非常非常非常長的下車地址名稱測試用字串',
      },
    ])
    const { wrapper } = await mountMine()
    const history = wrapper.get('.history')

    expect(history.find('.history-date').exists()).toBe(true)
    expect(history.find('.history-status').exists()).toBe(true)
    expect(history.findAll('.place')).toHaveLength(2)
    expect(history.text()).toContain('ORD-20260915-009')
    expect(history.text()).toContain('已完成')
  })

  it('shows em dash for null destination on current cards', async () => {
    vi.mocked(listDriverOrders).mockResolvedValue([
      { ...accepted, destination: null },
    ])
    const { wrapper } = await mountMine()
    const places = wrapper.findAll('.current .place')
    expect(places[1].text()).toBe('—')
  })

  it('shows empty groups and load errors', async () => {
    vi.mocked(listDriverOrders).mockResolvedValue([])
    const empty = await mountMine()
    expect(empty.wrapper.text()).toContain('目前沒有進行中的訂單')
    expect(empty.wrapper.text()).toContain('目前沒有歷史訂單')

    vi.mocked(listDriverOrders).mockRejectedValue(
      new ApiClientError('FORBIDDEN', '沒有權限', 403),
    )
    const forbidden = await mountMine()
    expect(forbidden.wrapper.text()).toContain('沒有權限')
    expect(forbidden.wrapper.text()).toContain('FORBIDDEN')
  })
})
