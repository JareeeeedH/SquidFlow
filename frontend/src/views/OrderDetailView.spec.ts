import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { OrderDetail } from '../api/types'
import OrderDetailView from './OrderDetailView.vue'

vi.mock('../api/orders', () => ({
  getOrder: vi.fn(),
  updateOrder: vi.fn(),
  deleteOrder: vi.fn(),
  publishOrder: vi.fn(),
  cancelOrder: vi.fn(),
}))

import { cancelOrder, deleteOrder, getOrder, publishOrder, updateOrder } from '../api/orders'

const draft: OrderDetail = {
  id: 'order-1',
  order_no: 'ORD-20260915-001',
  customer_name: '王先生',
  pickup_location: '左營高鐵站',
  destination: '高雄小港機場',
  price: 1200,
  note: '2件行李',
  status: 'DRAFT',
  dispatch_mode: 'OPEN',
  driver_id: null,
  driver: null,
  created_by: 'admin-1',
  accepted_at: null,
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  created_at: '2026-09-15T07:00:00.000Z',
  updated_at: '2026-09-15T07:00:00.000Z',
}

const openOrder: OrderDetail = {
  ...draft,
  status: 'OPEN',
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

function namedButtons(
  wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper'],
  name: string,
) {
  return wrapper.findAll('button').filter((item) => item.text().trim() === name)
}

function clickNamed(
  wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper'],
  name: string,
  index = 0,
) {
  const button = namedButtons(wrapper, name)[index]
  if (!button) {
    throw new Error(`button ${name}[${index}] not found`)
  }
  return button.trigger('click')
}

describe('OrderDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getOrder).mockResolvedValue(draft)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows draft actions only for DRAFT', async () => {
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('編輯')
    expect(wrapper.text()).toContain('發布')
    expect(wrapper.text()).toContain('刪除')
    expect(wrapper.text()).not.toContain('草稿可編輯、刪除或發布')
    expect(wrapper.text()).not.toContain('取消訂單')
    expect(wrapper.text()).toContain('尚無')
  })

  it('shows assigned driver vehicle information from the order detail payload', async () => {
    vi.mocked(getOrder).mockResolvedValue({
      ...openOrder,
      status: 'ACCEPTED',
      driver_id: 'driver-1',
      driver: {
        username: 'driver01',
        license_plate: 'ABC-1234',
        vehicle_brand: 'Toyota',
        vehicle_model: 'Sienta',
        vehicle_color: '白色',
      },
    })
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('driver01')
    expect(wrapper.text()).toContain('ABC-1234')
    expect(wrapper.text()).toContain('Toyota')
    expect(wrapper.text()).toContain('Sienta')
    expect(wrapper.text()).toContain('白色')
    expect(wrapper.text()).not.toContain('尚無')
    expect(wrapper.text()).not.toContain('已指派')
  })

  it('hides draft actions after the order is OPEN', async () => {
    vi.mocked(getOrder).mockResolvedValue(openOrder)
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('搶單中')
    expect(wrapper.text()).not.toContain('編輯')
    expect(wrapper.text()).not.toContain('發布')
    expect(wrapper.text()).not.toContain('刪除')
    expect(wrapper.text()).toContain('取消訂單')
    expect(wrapper.text()).toContain('可取消此訂單')
  })

  it('hides cancel on IN_PROGRESS, COMPLETED, and CANCELLED', async () => {
    vi.mocked(getOrder).mockResolvedValue({ ...openOrder, status: 'IN_PROGRESS' })
    const inProgress = await mountDetail()
    expect(inProgress.wrapper.text()).toContain('此訂單為唯讀')
    expect(namedButtons(inProgress.wrapper, '取消訂單')).toHaveLength(0)
    expect(inProgress.wrapper.text()).not.toContain('編輯')

    vi.mocked(getOrder).mockResolvedValue({ ...openOrder, status: 'COMPLETED' })
    const completed = await mountDetail()
    expect(namedButtons(completed.wrapper, '取消訂單')).toHaveLength(0)

    vi.mocked(getOrder).mockResolvedValue({ ...openOrder, status: 'CANCELLED' })
    const cancelled = await mountDetail()
    expect(namedButtons(cancelled.wrapper, '取消訂單')).toHaveLength(0)
  })

  it('edits a draft and reloads detail from the API response', async () => {
    vi.mocked(updateOrder).mockResolvedValue({
      ...draft,
      customer_name: '林小姐',
      price: 1600,
    })
    const { wrapper } = await mountDetail()

    await clickNamed(wrapper, '編輯')
    await flushPromises()
    await wrapper.get('input[placeholder="例如 王先生"]').setValue('林小姐')
    await wrapper.findComponent({ name: 'InputNumber' }).vm.$emit('update:value', 1600)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateOrder).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        customer_name: '林小姐',
        price: 1600,
      }),
    )
    expect(wrapper.text()).toContain('林小姐')
    expect(wrapper.text()).toContain('NT$ 1,600')
  })

  it('shows edit validation and API errors', async () => {
    vi.mocked(updateOrder).mockRejectedValue(
      new ApiClientError('VALIDATION_ERROR', 'price 格式不正確', 400),
    )
    const { wrapper } = await mountDetail()

    await clickNamed(wrapper, '編輯')
    await flushPromises()
    await wrapper.get('input[placeholder="例如 左營高鐵站"]').setValue('')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(updateOrder).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('請輸入上車地點')

    await wrapper.get('input[placeholder="例如 左營高鐵站"]').setValue('左營高鐵站')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('VALIDATION_ERROR')
    expect(wrapper.text()).toContain('price 格式不正確')
  })

  it('deletes a draft after confirmation and returns to the list', async () => {
    vi.mocked(deleteOrder).mockResolvedValue(null)
    const { wrapper, router } = await mountDetail()
    const push = vi.spyOn(router, 'push')

    await clickNamed(wrapper, '刪除')
    await flushPromises()
    expect(wrapper.text()).toContain('確定刪除此草稿')
    expect(deleteOrder).not.toHaveBeenCalled()

    await clickNamed(wrapper, '確認刪除')
    await flushPromises()

    expect(deleteOrder).toHaveBeenCalledWith('order-1')
    expect(push).toHaveBeenCalledWith({ name: 'orders' })
  })

  it('publishes a draft after confirmation and hides actions when OPEN', async () => {
    vi.mocked(publishOrder).mockResolvedValue({ id: 'order-1', status: 'OPEN' })
    vi.mocked(getOrder)
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(openOrder)

    const { wrapper } = await mountDetail()
    await clickNamed(wrapper, '發布')
    await flushPromises()
    expect(wrapper.text()).toContain('確定發布這張草稿')
    expect(publishOrder).not.toHaveBeenCalled()

    await clickNamed(wrapper, '確認發布')
    await flushPromises()

    expect(publishOrder).toHaveBeenCalledWith('order-1')
    expect(getOrder).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('搶單中')
    expect(wrapper.text()).not.toContain('編輯')
    expect(wrapper.text()).not.toContain('刪除')
  })

  it('shows publish errors from the backend', async () => {
    vi.mocked(publishOrder).mockRejectedValue(
      new ApiClientError('INVALID_ORDER_STATUS', '訂單狀態不允許此操作', 409),
    )
    const { wrapper } = await mountDetail()

    await clickNamed(wrapper, '發布')
    await flushPromises()
    await clickNamed(wrapper, '確認發布')
    await flushPromises()

    expect(wrapper.text()).toContain('INVALID_ORDER_STATUS')
    expect(wrapper.text()).toContain('訂單狀態不允許此操作')
  })

  it('cancels an OPEN order after confirmation', async () => {
    vi.mocked(getOrder).mockResolvedValue(openOrder)
    vi.mocked(cancelOrder).mockResolvedValue({ id: 'order-1', status: 'CANCELLED' })
    vi.mocked(getOrder)
      .mockResolvedValueOnce(openOrder)
      .mockResolvedValueOnce({ ...openOrder, status: 'CANCELLED' })

    const { wrapper } = await mountDetail()
    await clickNamed(wrapper, '取消訂單')
    await flushPromises()
    expect(wrapper.text()).toContain('確定取消此訂單')
    expect(cancelOrder).not.toHaveBeenCalled()

    await clickNamed(wrapper, '確認取消')
    await flushPromises()

    expect(cancelOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('已取消')
    expect(namedButtons(wrapper, '取消訂單')).toHaveLength(0)
  })

  it('shows cancel errors from the backend', async () => {
    vi.mocked(getOrder).mockResolvedValue({ ...openOrder, status: 'ACCEPTED' })
    vi.mocked(cancelOrder).mockRejectedValue(
      new ApiClientError('INVALID_ORDER_STATUS', '訂單狀態不允許此操作', 409),
    )
    const { wrapper } = await mountDetail()

    await clickNamed(wrapper, '取消訂單')
    await flushPromises()
    await clickNamed(wrapper, '確認取消')
    await flushPromises()

    expect(wrapper.text()).toContain('INVALID_ORDER_STATUS')
    expect(wrapper.text()).toContain('訂單狀態不允許此操作')
  })

  it('shows 404 when the order does not exist', async () => {
    vi.mocked(getOrder).mockRejectedValue(
      new ApiClientError('NOT_FOUND', '找不到訂單', 404),
    )
    const { wrapper } = await mountDetail('missing')

    expect(wrapper.text()).toContain('找不到訂單')
    expect(wrapper.text()).toContain('NOT_FOUND')
  })
})
