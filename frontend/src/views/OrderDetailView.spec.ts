import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { OrderDetail } from '../api/types'
import OrderDetailView from './OrderDetailView.vue'

vi.mock('../api/orders', () => ({
  getOrder: vi.fn(),
}))

import { getOrder } from '../api/orders'

const sample: OrderDetail = {
  id: 'order-1',
  order_no: 'ORD-20260915-001',
  customer_name: '王先生',
  pickup_location: '左營高鐵站',
  destination: '高雄小港機場',
  scheduled_at: '2026-09-15T07:30:00.000Z',
  vehicle_type: '5人座',
  price: 1200,
  note: '2件行李',
  status: 'DRAFT',
  dispatch_mode: 'OPEN',
  driver_id: null,
  created_by: 'admin-1',
  accepted_at: null,
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  created_at: '2026-09-15T07:00:00.000Z',
  updated_at: '2026-09-15T07:00:00.000Z',
}

async function mountDetail(id = 'order-1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/orders', name: 'orders', component: { template: '<div />' } },
      { path: '/orders/:id', name: 'order-detail', component: OrderDetailView },
    ],
  })
  await router.push(`/orders/${id}`)
  await router.isReady()
  const wrapper = mount(OrderDetailView, {
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('OrderDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getOrder).mockResolvedValue(sample)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('loads and displays order detail as read-only', async () => {
    const { wrapper } = await mountDetail()

    expect(getOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('ORD-20260915-001')
    expect(wrapper.text()).toContain('王先生')
    expect(wrapper.text()).toContain('左營高鐵站')
    expect(wrapper.text()).toContain('高雄小港機場')
    expect(wrapper.text()).toContain('5人座')
    expect(wrapper.text()).toContain('NT$ 1,200')
    expect(wrapper.text()).toContain('2件行李')
    expect(wrapper.text()).toContain('草稿')
    expect(wrapper.text()).toContain('目前僅供查看')
    expect(wrapper.text()).toContain('尚無')
    expect(wrapper.text()).not.toContain('編輯')
    expect(wrapper.text()).not.toContain('發布')
    expect(wrapper.text()).not.toContain('刪除')
    expect(wrapper.text()).not.toContain('取消訂單')
  })

  it('shows 404 when the order does not exist', async () => {
    vi.mocked(getOrder).mockRejectedValue(
      new ApiClientError('NOT_FOUND', '找不到訂單', 404),
    )
    const { wrapper } = await mountDetail('missing')

    expect(wrapper.text()).toContain('找不到訂單')
    expect(wrapper.text()).toContain('NOT_FOUND')
  })

  it('shows error code and retry after failure', async () => {
    vi.mocked(getOrder).mockRejectedValueOnce(
      new ApiClientError('INTERNAL_ERROR', '系統發生錯誤', 500),
    )
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('INTERNAL_ERROR')
    expect(wrapper.text()).toContain('重試')

    vi.mocked(getOrder).mockResolvedValue(sample)
    const retry = wrapper.findAll('button').find((button) => button.text().includes('重試'))
    await retry!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('ORD-20260915-001')
  })
})
