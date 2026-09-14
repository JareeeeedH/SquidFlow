import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { DriverItem } from '../api/types'
import DriverCreateView from './DriverCreateView.vue'

vi.mock('../api/drivers', () => ({
  createDriver: vi.fn(),
}))

import { createDriver } from '../api/drivers'

const created: DriverItem = {
  id: 'driver-new',
  username: 'driver01',
  vehicle_type: '5人座',
  license_plate: 'ABC-1234',
  vehicle_brand: 'Toyota',
  vehicle_model: 'Camry',
  vehicle_color: '黑色',
  vehicle_year: 2024,
  online_status: 'OFFLINE',
  status: 'ACTIVE',
}

async function mountCreate() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/drivers', name: 'drivers', component: { template: '<div />' } },
      {
        path: '/drivers/new',
        name: 'driver-create',
        component: DriverCreateView,
      },
      {
        path: '/drivers/:id',
        name: 'driver-detail',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/drivers/new')
  await router.isReady()
  const wrapper = mount(DriverCreateView, {
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

async function fillValidForm(
  wrapper: Awaited<ReturnType<typeof mountCreate>>['wrapper'],
) {
  await wrapper.get('input[placeholder="例如 driver01"]').setValue('driver01')
  await wrapper.get('input[placeholder="請輸入密碼"]').setValue('Secret123!')
  await wrapper.get('input[placeholder="例如 5人座"]').setValue('5人座')
  await wrapper.get('input[placeholder="例如 ABC-1234"]').setValue('ABC-1234')
  await wrapper.get('input[placeholder="例如 Toyota"]').setValue('Toyota')
  await wrapper.get('input[placeholder="例如 Camry"]').setValue('Camry')
  await wrapper.get('input[placeholder="例如 黑色"]').setValue('黑色')
  await wrapper
    .findComponent({ name: 'InputNumber' })
    .vm.$emit('update:value', 2024)
}

describe('DriverCreateView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(createDriver).mockResolvedValue(created)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders create fields without role or online status controls', async () => {
    const { wrapper } = await mountCreate()

    expect(wrapper.text()).toContain('新增司機')
    expect(wrapper.text()).toContain('帳號')
    expect(wrapper.text()).toContain('密碼')
    expect(wrapper.text()).toContain('車型')
    expect(wrapper.text()).toContain('車牌')
    expect(wrapper.text()).toContain('品牌')
    expect(wrapper.text()).toContain('型號')
    expect(wrapper.text()).toContain('車色')
    expect(wrapper.text()).toContain('年份')
    expect(wrapper.text()).toContain('建立司機')
    expect(wrapper.text()).not.toContain('role')
    expect(wrapper.html()).not.toContain('online_status')
  })

  it('blocks submit when required fields are empty', async () => {
    const { wrapper } = await mountCreate()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createDriver).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('請輸入帳號')
  })

  it('creates a driver and navigates to detail', async () => {
    const { wrapper, router } = await mountCreate()
    const push = vi.spyOn(router, 'push')

    await fillValidForm(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createDriver).toHaveBeenCalledTimes(1)
    expect(createDriver).toHaveBeenCalledWith({
      username: 'driver01',
      password: 'Secret123!',
      vehicle_type: '5人座',
      license_plate: 'ABC-1234',
      vehicle_brand: 'Toyota',
      vehicle_model: 'Camry',
      vehicle_color: '黑色',
      vehicle_year: 2024,
    })
    expect(push).toHaveBeenCalledWith({
      name: 'driver-detail',
      params: { id: 'driver-new' },
    })
  })

  it('does not send a second request while submitting', async () => {
    let finish!: (value: DriverItem) => void
    vi.mocked(createDriver).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )

    const { wrapper } = await mountCreate()
    await fillValidForm(wrapper)

    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createDriver).toHaveBeenCalledTimes(1)
    finish(created)
    await flushPromises()
  })

  it('shows backend error code and message on failure', async () => {
    vi.mocked(createDriver).mockRejectedValue(
      new ApiClientError('USERNAME_ALREADY_EXISTS', '帳號已存在', 409),
    )
    const { wrapper } = await mountCreate()

    await fillValidForm(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('USERNAME_ALREADY_EXISTS')
    expect(wrapper.text()).toContain('帳號已存在')
  })
})
