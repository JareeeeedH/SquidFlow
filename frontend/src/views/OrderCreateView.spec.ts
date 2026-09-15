import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import OrderCreateView from './OrderCreateView.vue'

vi.mock('../api/orders', () => ({
  createOrder: vi.fn(),
}))

import { createOrder } from '../api/orders'

async function mountCreate() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/orders', name: 'orders', component: { template: '<div />' } },
      { path: '/orders/new', name: 'order-create', component: OrderCreateView },
      { path: '/orders/:id', name: 'order-detail', component: { template: '<div />' } },
    ],
  })
  await router.push('/orders/new')
  await router.isReady()
  const wrapper = mount(OrderCreateView, {
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('OrderCreateView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(createOrder).mockResolvedValue({
      id: 'order-new',
      order_no: 'ORD-20260915-010',
      status: 'DRAFT',
      dispatch_mode: 'OPEN',
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders create draft fields without publish', async () => {
    const { wrapper } = await mountCreate()

    expect(wrapper.text()).toContain('建立派車單')
    expect(wrapper.text()).toContain('行程資訊')
    expect(wrapper.text()).not.toContain('上車地點為必填，其餘可留空。')
    expect(wrapper.text()).not.toContain('費用與備註')
    expect(wrapper.text()).not.toContain('價格與備註皆為選填。')
    expect(wrapper.text()).toContain('客戶姓名')
    expect(wrapper.text()).toContain('上車地點')
    expect(wrapper.text()).toContain('目的地')
    expect(wrapper.text()).not.toContain('預約時間')
    expect(wrapper.text()).not.toContain('車型')
    expect(wrapper.text()).toContain('價格')
    expect(wrapper.text()).toContain('備註')
    expect(wrapper.text()).toContain('儲存草稿')
    expect(wrapper.text()).not.toContain('發布搶單')
  })

  it('blocks submit when required fields are empty', async () => {
    const { wrapper } = await mountCreate()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createOrder).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('請輸入上車地點')
  })

  it('creates a draft and navigates to detail', async () => {
    const { wrapper, router } = await mountCreate()
    const push = vi.spyOn(router, 'push')

    await wrapper.get('input[placeholder="例如 王先生"]').setValue('王先生')
    await wrapper.get('input[placeholder="例如 左營高鐵站"]').setValue('左營高鐵站')
    await wrapper.get('input[placeholder="例如 高雄小港機場"]').setValue('高雄小港機場')
    await wrapper.findComponent({ name: 'InputNumber' }).vm.$emit('update:value', 1200)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createOrder).toHaveBeenCalledTimes(1)
    expect(createOrder).toHaveBeenCalledWith({
      customer_name: '王先生',
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      price: 1200,
      note: null,
    })
    expect(push).toHaveBeenCalledWith({
      name: 'order-detail',
      params: { id: 'order-new' },
    })
  })

  it('does not send a second request while submitting', async () => {
    let finish!: (value: {
      id: string
      order_no: string
      status: 'DRAFT'
      dispatch_mode: 'OPEN'
    }) => void
    vi.mocked(createOrder).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )

    const { wrapper } = await mountCreate()
    await wrapper.get('input[placeholder="例如 王先生"]').setValue('王先生')
    await wrapper.get('input[placeholder="例如 左營高鐵站"]').setValue('左營高鐵站')
    await wrapper.get('input[placeholder="例如 高雄小港機場"]').setValue('高雄小港機場')
    await wrapper.findComponent({ name: 'InputNumber' }).vm.$emit('update:value', 1200)

    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createOrder).toHaveBeenCalledTimes(1)
    finish({
      id: 'order-new',
      order_no: 'ORD-20260915-010',
      status: 'DRAFT',
      dispatch_mode: 'OPEN',
    })
    await flushPromises()
  })

  it('shows backend error code and message on failure', async () => {
    vi.mocked(createOrder).mockRejectedValue(
      new ApiClientError('VALIDATION_ERROR', 'price 格式不正確', 400),
    )
    const { wrapper } = await mountCreate()

    await wrapper.get('input[placeholder="例如 王先生"]').setValue('王先生')
    await wrapper.get('input[placeholder="例如 左營高鐵站"]').setValue('左營高鐵站')
    await wrapper.get('input[placeholder="例如 高雄小港機場"]').setValue('高雄小港機場')
    await wrapper.findComponent({ name: 'InputNumber' }).vm.$emit('update:value', 1200)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('VALIDATION_ERROR')
    expect(wrapper.text()).toContain('price 格式不正確')
  })
})
