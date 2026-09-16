import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { AdminDashboard, OrderListItem } from '../api/types'
import OrdersView from './OrdersView.vue'

vi.mock('../api/orders', () => ({
  listOrders: vi.fn(),
}))

vi.mock('../api/dashboard', () => ({
  getAdminDashboard: vi.fn(),
}))

import { getAdminDashboard } from '../api/dashboard'
import { listOrders } from '../api/orders'

const sampleOrder: OrderListItem = {
  id: 'order-1',
  order_no: 'ORD-20260915-001',
  customer_name: '王先生',
  pickup_location: '左營高鐵站',
  destination: '高雄小港機場',
  created_at: '2026-09-15T07:00:00.000Z',
  price: 1200,
  note: null,
  status: 'OPEN',
  driver_id: null,
}

const sampleSummary: AdminDashboard = {
  summary: {
    DRAFT: 1,
    OPEN: 2,
    ACCEPTED: 3,
    IN_PROGRESS: 0,
    COMPLETED: 4,
    CANCELLED: 5,
  },
  board_orders: [],
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/orders', name: 'orders', component: OrdersView },
      {
        path: '/orders/:id',
        name: 'order-detail',
        component: { template: '<div />' },
      },
    ],
  })
}

async function mountOrders(path = '/orders') {
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(OrdersView, {
    global: {
      plugins: [router],
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('OrdersView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(listOrders).mockResolvedValue([sampleOrder])
    vi.mocked(getAdminDashboard).mockResolvedValue(sampleSummary)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('loads orders without filters on mount', async () => {
    const { wrapper } = await mountOrders()

    expect(listOrders).toHaveBeenCalledWith({})
    expect(wrapper.text()).toContain('訂單')
    expect(wrapper.text()).not.toContain('訂單列表')
    expect(wrapper.text()).toContain('ORD-20260915-001')
    expect(wrapper.text()).toContain('NT$ 1,200')
    expect(wrapper.text()).toContain('搶單中')
  })

  it('submits search and keeps other filters on the same request', async () => {
    const { wrapper } = await mountOrders()
    vi.mocked(listOrders).mockClear()

    const search = wrapper.get('input[placeholder="搜尋訂單編號或客戶姓名"]')
    await search.setValue('ORD-20260915')
    await search.trigger('keyup.enter')
    await flushPromises()

    expect(listOrders).toHaveBeenLastCalledWith({ search: 'ORD-20260915' })

    await wrapper.findComponent({ name: 'Select' }).vm.$emit('update:value', 'OPEN')
    await flushPromises()

    expect(listOrders).toHaveBeenLastCalledWith({
      search: 'ORD-20260915',
      status: 'OPEN',
    })

    await wrapper.findComponent({ name: 'DatePicker' }).vm.$emit(
      'update:value',
      new Date('2026-09-15T00:00:00+08:00').getTime(),
    )
    await flushPromises()

    expect(listOrders).toHaveBeenLastCalledWith({
      search: 'ORD-20260915',
      status: 'OPEN',
      date: '2026-09-15',
    })
  })

  it('sends YYYY-MM-DD for the selected Taipei date', async () => {
    const { wrapper } = await mountOrders()
    vi.mocked(listOrders).mockClear()

    const datePicker = wrapper.findComponent({ name: 'DatePicker' })
    await datePicker.vm.$emit(
      'update:value',
      new Date('2026-09-15T00:00:00+08:00').getTime(),
    )
    await flushPromises()

    expect(listOrders).toHaveBeenCalledWith({ date: '2026-09-15' })
  })

  it('shows empty state when the API returns no orders', async () => {
    vi.mocked(listOrders).mockResolvedValue([])
    const { wrapper } = await mountOrders()

    expect(wrapper.text()).toContain('目前沒有訂單')
    expect(wrapper.text()).not.toContain('無法載入訂單')
  })

  it('shows error code and retry after API failure', async () => {
    vi.mocked(listOrders).mockRejectedValueOnce(
      new ApiClientError('INTERNAL_ERROR', '系統發生錯誤', 500),
    )
    const { wrapper } = await mountOrders()

    expect(wrapper.text()).toContain('INTERNAL_ERROR')
    expect(wrapper.text()).toContain('系統發生錯誤')
    expect(wrapper.text()).toContain('重試')

    vi.mocked(listOrders).mockResolvedValue([sampleOrder])
    const retry = wrapper.findAll('button').find((button) => button.text().includes('重試'))
    expect(retry).toBeTruthy()
    await retry!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('ORD-20260915-001')
  })

  it('shows forbidden state for 403', async () => {
    vi.mocked(listOrders).mockRejectedValue(
      new ApiClientError('FORBIDDEN', '沒有權限', 403),
    )
    const { wrapper } = await mountOrders()

    expect(wrapper.text()).toContain('沒有權限')
    expect(wrapper.text()).toContain('FORBIDDEN')
  })

  it('applies status from the route query on mount', async () => {
    const { wrapper } = await mountOrders('/orders?status=OPEN')

    expect(listOrders).toHaveBeenCalledWith({ status: 'OPEN' })
    wrapper.unmount()
  })

  it('writes the selected status into the route query', async () => {
    const { wrapper, router } = await mountOrders()
    vi.mocked(listOrders).mockClear()

    await wrapper.findComponent({ name: 'Select' }).vm.$emit('update:value', 'COMPLETED')
    await flushPromises()

    expect(router.currentRoute.value.query.status).toBe('COMPLETED')
    expect(listOrders).toHaveBeenLastCalledWith({ status: 'COMPLETED' })
  })

  it('renders mobile status chips with counts and filters on chip click', async () => {
    const { wrapper, router } = await mountOrders()
    await flushPromises()

    expect(getAdminDashboard).toHaveBeenCalled()
    expect(wrapper.find('.status-chips').exists()).toBe(true)
    expect(wrapper.text()).toContain('全部')
    expect(wrapper.text()).toContain('15')
    expect(wrapper.text()).toContain('搶單中')
    expect(wrapper.text()).toContain('2')
    expect(wrapper.findAll('.status-chip')).toHaveLength(7)
    expect(wrapper.find('.status-chip.is-active').text()).toContain('全部')
    expect(wrapper.text()).not.toContain('篩選訂單')

    const openChip = wrapper
      .findAll('.status-chip')
      .find((chip) => chip.text().includes('搶單中'))
    expect(openChip).toBeTruthy()
    vi.mocked(listOrders).mockClear()
    await openChip!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.status).toBe('OPEN')
    expect(listOrders).toHaveBeenLastCalledWith({ status: 'OPEN' })
    expect(openChip!.classes()).toContain('is-active')
  })

  it('keeps compact card fields for scan reading', async () => {
    const { wrapper } = await mountOrders()
    const card = wrapper.find('.order-card')

    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('ORD-20260915-001')
    expect(card.text()).toContain('王先生')
    expect(card.text()).toContain('左營高鐵站')
    expect(card.text()).toContain('高雄小港機場')
    expect(card.text()).toContain('NT$ 1,200')
    expect(card.text()).toContain('搶單中')
  })
})
