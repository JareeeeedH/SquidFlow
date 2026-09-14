import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { DriverItem } from '../api/types'
import DriversView from './DriversView.vue'

vi.mock('../api/drivers', () => ({
  listDrivers: vi.fn(),
}))

import { listDrivers } from '../api/drivers'

const sampleDriver: DriverItem = {
  id: 'driver-1',
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

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/drivers', name: 'drivers', component: DriversView },
      {
        path: '/drivers/new',
        name: 'driver-create',
        component: { template: '<div />' },
      },
      {
        path: '/drivers/:id',
        name: 'driver-detail',
        component: { template: '<div />' },
      },
    ],
  })
}

async function mountDrivers() {
  const router = makeRouter()
  await router.push('/drivers')
  await router.isReady()
  const wrapper = mount(DriversView, {
    global: {
      plugins: [router],
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('DriversView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(listDrivers).mockResolvedValue([sampleDriver])
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('loads drivers on mount', async () => {
    const { wrapper } = await mountDrivers()

    expect(listDrivers).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Drivers')
    expect(wrapper.text()).toContain('driver01')
    expect(wrapper.text()).toContain('ABC-1234')
    expect(wrapper.text()).toContain('Toyota Camry')
    expect(wrapper.text()).toContain('黑色')
    expect(wrapper.text()).toContain('2024')
    expect(wrapper.text()).toContain('啟用')
    expect(wrapper.text()).toContain('離線')
  })

  it('shows loading while the list request is in flight', async () => {
    let resolveList!: (value: DriverItem[]) => void
    vi.mocked(listDrivers).mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve
      }),
    )

    const router = makeRouter()
    await router.push('/drivers')
    await router.isReady()
    const wrapper = mount(DriversView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(wrapper.findComponent({ name: 'DataTable' }).props('loading')).toBe(
      true,
    )

    resolveList([sampleDriver])
    await flushPromises()
    expect(wrapper.findComponent({ name: 'DataTable' }).props('loading')).toBe(
      false,
    )
  })

  it('shows empty state when the API returns no drivers', async () => {
    vi.mocked(listDrivers).mockResolvedValue([])
    const { wrapper } = await mountDrivers()

    expect(wrapper.text()).toContain('目前沒有司機')
    expect(wrapper.text()).not.toContain('無法載入司機')
  })

  it('shows error code and retry after API failure', async () => {
    vi.mocked(listDrivers).mockRejectedValueOnce(
      new ApiClientError('INTERNAL_ERROR', '系統發生錯誤', 500),
    )
    const { wrapper } = await mountDrivers()

    expect(wrapper.text()).toContain('INTERNAL_ERROR')
    expect(wrapper.text()).toContain('系統發生錯誤')
    expect(wrapper.text()).toContain('重試')

    vi.mocked(listDrivers).mockResolvedValue([sampleDriver])
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text().includes('重試'))
    expect(retry).toBeTruthy()
    await retry!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('driver01')
  })

  it('navigates to driver detail from view', async () => {
    const { wrapper, router } = await mountDrivers()
    const push = vi.spyOn(router, 'push')

    const view = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '查看')
    expect(view).toBeTruthy()
    await view!.trigger('click')

    expect(push).toHaveBeenCalledWith({
      name: 'driver-detail',
      params: { id: 'driver-1' },
    })
  })
})
