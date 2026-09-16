import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { AdminDashboard } from '../api/types'
import DashboardView from './DashboardView.vue'

vi.mock('../api/dashboard', () => ({
  getAdminDashboard: vi.fn(),
}))

import { getAdminDashboard } from '../api/dashboard'

const sampleDashboard: AdminDashboard = {
  summary: {
    DRAFT: 1,
    OPEN: 2,
    ACCEPTED: 1,
    IN_PROGRESS: 0,
    COMPLETED: 4,
    CANCELLED: 3,
  },
  board_orders: [
    {
      id: 'draft-1',
      order_no: 'ORD-20260915-001',
      customer_name: '王先生',
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      created_at: '2026-09-15T07:30:00.000Z',
      price: 1200,
      status: 'DRAFT',
      driver: null,
    },
    {
      id: 'open-1',
      order_no: 'ORD-20260915-003',
      customer_name: null,
      pickup_location: '左營高鐵站',
      destination: null,
      created_at: '2026-09-15T09:00:00.000Z',
      price: null,
      status: 'OPEN',
      driver: null,
    },
    {
      id: 'accepted-1',
      order_no: 'ORD-20260915-002',
      customer_name: '李小姐',
      pickup_location: '高雄車站',
      destination: '小港機場',
      created_at: '2026-09-15T08:00:00.000Z',
      price: 900,
      status: 'ACCEPTED',
      driver: { username: 'driver01' },
    },
  ],
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: DashboardView },
      { path: '/orders', name: 'orders', component: { template: '<div />' } },
      {
        path: '/orders/:id',
        name: 'order-detail',
        component: { template: '<div />' },
      },
    ],
  })
}

async function mountDashboard() {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  const wrapper = mount(DashboardView, {
    global: {
      plugins: [router],
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('DashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getAdminDashboard).mockResolvedValue(sampleDashboard)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders backend summary counts and does not add a total', async () => {
    const { wrapper } = await mountDashboard()

    expect(getAdminDashboard).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('草稿')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).toContain('已取消')
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).not.toContain('全部')
  })

  it('sends status filter to the order list from summary cards', async () => {
    const { wrapper, router } = await mountDashboard()
    const push = vi.spyOn(router, 'push')

    const buttons = wrapper.findAll('.summary-card')
    const completed = buttons.find((button) => button.text().includes('已完成'))
    expect(completed).toBeTruthy()
    await completed!.trigger('click')

    expect(push).toHaveBeenCalledWith({
      name: 'orders',
      query: { status: 'COMPLETED' },
    })
  })

  it('shows board cards with assigned and unassigned drivers', async () => {
    const { wrapper } = await mountDashboard()

    expect(wrapper.text()).toContain('ORD-20260915-001')
    expect(wrapper.text()).toContain('王先生')
    expect(wrapper.text()).toContain('左營高鐵站')
    expect(wrapper.text()).toContain('高雄小港機場')
    expect(wrapper.text()).toContain('未指派')
    expect(wrapper.text()).toContain('driver01')
    expect(wrapper.text()).toContain('NT$ 1,200')
    expect(wrapper.text()).not.toContain('ORD-COMPLETED')

    const named = wrapper
      .findAll('.order-card')
      .find((button) => button.text().includes('ORD-20260915-001'))
    expect(named?.get('.identity').text()).toBe('ORD-20260915-001 · 王先生')
  })

  it('keeps compact board cards and omits a missing customer name', async () => {
    const { wrapper } = await mountDashboard()
    const card = wrapper
      .findAll('.order-card')
      .find((button) => button.text().includes('ORD-20260915-003'))
    expect(card).toBeTruthy()

    const identity = card!.get('.identity').text()
    expect(identity).toBe('ORD-20260915-003')
    expect(identity).not.toContain('·')
    expect(card!.get('.price').text()).toBe('—')
    expect(card!.get('.route').text()).toContain('→')
    expect(card!.get('.route').text()).toContain('—')
    expect(card!.get('.meta').text()).toContain('未指派')
  })

  it('emphasizes operational statuses in the summary', async () => {
    const { wrapper } = await mountDashboard()
    const cards = wrapper.findAll('.summary-card')
    const open = cards.find((button) => button.text().includes('搶單中'))
    const accepted = cards.find((button) => button.text().includes('已接單'))
    const inProgress = cards.find((button) => button.text().includes('行程中'))
    const draft = cards.find((button) => button.text().includes('草稿'))

    expect(open?.classes()).toContain('is-operational')
    expect(accepted?.classes()).toContain('is-operational')
    expect(inProgress?.classes()).toContain('is-operational')
    expect(draft?.classes()).not.toContain('is-operational')
  })

  it('shows a compact empty state for board columns without orders', async () => {
    const { wrapper } = await mountDashboard()

    expect(wrapper.text()).toContain('目前沒有訂單')
    expect(wrapper.find('.column-empty').exists()).toBe(true)
  })

  it('opens order detail from a board card', async () => {
    const { wrapper, router } = await mountDashboard()
    const push = vi.spyOn(router, 'push')

    const card = wrapper
      .findAll('.order-card')
      .find((button) => button.text().includes('ORD-20260915-002'))
    expect(card).toBeTruthy()
    await card!.trigger('click')

    expect(push).toHaveBeenCalledWith({
      name: 'order-detail',
      params: { id: 'accepted-1' },
    })
  })

  it('shows error code and retry after API failure', async () => {
    vi.mocked(getAdminDashboard).mockRejectedValueOnce(
      new ApiClientError('INTERNAL_ERROR', '系統發生錯誤', 500),
    )
    const { wrapper } = await mountDashboard()

    expect(wrapper.text()).toContain('INTERNAL_ERROR')
    expect(wrapper.text()).toContain('無法載入 Dashboard')

    vi.mocked(getAdminDashboard).mockResolvedValue(sampleDashboard)
    const retry = wrapper.findAll('button').find((button) => button.text().includes('重試'))
    expect(retry).toBeTruthy()
    await retry!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('ORD-20260915-001')
  })

  it('shows mobile focus board entry for full orders list', async () => {
    const { wrapper } = await mountDashboard()

    expect(wrapper.text()).toContain('重點訂單')
    expect(wrapper.text()).toContain('完整訂單')
    expect(wrapper.find('.board-mobile').exists()).toBe(true)
    expect(wrapper.find('.board-desktop').exists()).toBe(true)
  })
})
