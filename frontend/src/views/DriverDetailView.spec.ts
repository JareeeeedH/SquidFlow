import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { DriverItem } from '../api/types'
import DriverDetailView from './DriverDetailView.vue'

vi.mock('../api/drivers', () => ({
  getDriver: vi.fn(),
  updateDriver: vi.fn(),
  updateDriverStatus: vi.fn(),
}))

import { getDriver, updateDriver, updateDriverStatus } from '../api/drivers'

const activeDriver: DriverItem = {
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

const suspendedDriver: DriverItem = {
  ...activeDriver,
  status: 'SUSPENDED',
}

async function mountDetail(id = 'driver-1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/drivers', name: 'drivers', component: { template: '<div />' } },
      {
        path: '/drivers/:id',
        name: 'driver-detail',
        component: DriverDetailView,
      },
    ],
  })
  await router.push(`/drivers/${id}`)
  await router.isReady()
  const wrapper = mount(DriverDetailView, {
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

describe('DriverDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getDriver).mockResolvedValue(activeDriver)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows account, vehicle, and separate statuses', async () => {
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('driver01')
    expect(wrapper.text()).toContain('帳號資訊')
    expect(wrapper.text()).toContain('車輛資訊')
    expect(wrapper.text()).toContain('ABC-1234')
    expect(wrapper.text()).toContain('Toyota')
    expect(wrapper.text()).toContain('Camry')
    expect(wrapper.text()).toContain('黑色')
    expect(wrapper.text()).toContain('2024')
    expect(wrapper.text()).toContain('帳號狀態')
    expect(wrapper.text()).toContain('上線狀態')
    expect(wrapper.text()).toContain('啟用')
    expect(wrapper.text()).toContain('離線')
    expect(wrapper.text()).toContain('編輯')
    expect(wrapper.text()).toContain('停用')
    expect(wrapper.text()).not.toContain('刪除')
  })

  it('edits a driver and uses the API response', async () => {
    vi.mocked(updateDriver).mockResolvedValue({
      ...activeDriver,
      vehicle_color: '白色',
      vehicle_year: 2025,
    })
    const { wrapper } = await mountDetail()

    await clickNamed(wrapper, '編輯')
    await flushPromises()
    await wrapper.get('input[placeholder="例如 黑色"]').setValue('白色')
    await wrapper
      .findComponent({ name: 'InputNumber' })
      .vm.$emit('update:value', 2025)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateDriver).toHaveBeenCalledWith(
      'driver-1',
      expect.objectContaining({
        username: 'driver01',
        vehicle_color: '白色',
        vehicle_year: 2025,
      }),
    )
    expect(updateDriver.mock.calls[0][1]).not.toHaveProperty('password')
    expect(wrapper.text()).toContain('白色')
    expect(wrapper.text()).toContain('2025')
  })

  it('omits blank password on edit', async () => {
    vi.mocked(updateDriver).mockResolvedValue(activeDriver)
    const { wrapper } = await mountDetail()

    await clickNamed(wrapper, '編輯')
    await flushPromises()
    expect(wrapper.text()).toContain('空白則不修改密碼')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(updateDriver).toHaveBeenCalledWith(
      'driver-1',
      expect.not.objectContaining({ password: expect.anything() }),
    )
  })

  it('shows edit validation and API errors', async () => {
    vi.mocked(updateDriver).mockRejectedValue(
      new ApiClientError('LICENSE_PLATE_ALREADY_EXISTS', '車牌已被使用', 409),
    )
    const { wrapper } = await mountDetail()

    await clickNamed(wrapper, '編輯')
    await flushPromises()
    await wrapper.get('input[placeholder="例如 driver01"]').setValue('')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(updateDriver).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('請輸入帳號')

    await wrapper.get('input[placeholder="例如 driver01"]').setValue('driver01')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('LICENSE_PLATE_ALREADY_EXISTS')
    expect(wrapper.text()).toContain('車牌已被使用')
  })

  it('suspends an active driver and reloads detail', async () => {
    vi.mocked(updateDriverStatus).mockResolvedValue({
      id: 'driver-1',
      status: 'SUSPENDED',
    })
    vi.mocked(getDriver)
      .mockResolvedValueOnce(activeDriver)
      .mockResolvedValueOnce(suspendedDriver)

    const { wrapper } = await mountDetail()
    await clickNamed(wrapper, '停用')
    await flushPromises()
    expect(wrapper.text()).toContain('確定停用此司機帳號')
    expect(updateDriverStatus).not.toHaveBeenCalled()

    await clickNamed(wrapper, '確認停用')
    await flushPromises()

    expect(updateDriverStatus).toHaveBeenCalledWith('driver-1', 'SUSPENDED')
    expect(getDriver).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('停用')
    expect(wrapper.text()).toContain('啟用')
  })

  it('activates a suspended driver and reloads detail', async () => {
    vi.mocked(getDriver)
      .mockResolvedValueOnce(suspendedDriver)
      .mockResolvedValueOnce(activeDriver)
    vi.mocked(updateDriverStatus).mockResolvedValue({
      id: 'driver-1',
      status: 'ACTIVE',
    })

    const { wrapper } = await mountDetail()
    expect(wrapper.text()).toContain('啟用')
    await clickNamed(wrapper, '啟用')
    await flushPromises()
    await clickNamed(wrapper, '確認啟用')
    await flushPromises()

    expect(updateDriverStatus).toHaveBeenCalledWith('driver-1', 'ACTIVE')
    expect(getDriver).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('停用')
  })

  it('shows status errors from the backend', async () => {
    vi.mocked(updateDriverStatus).mockRejectedValue(
      new ApiClientError('VALIDATION_ERROR', 'status 必須為 ACTIVE 或 SUSPENDED', 400),
    )
    const { wrapper } = await mountDetail()

    await clickNamed(wrapper, '停用')
    await flushPromises()
    await clickNamed(wrapper, '確認停用')
    await flushPromises()

    expect(wrapper.text()).toContain('VALIDATION_ERROR')
    expect(wrapper.text()).toContain('status 必須為 ACTIVE 或 SUSPENDED')
  })

  it('shows 404 when the driver does not exist', async () => {
    vi.mocked(getDriver).mockRejectedValue(
      new ApiClientError('NOT_FOUND', '找不到司機', 404),
    )
    const { wrapper } = await mountDetail('missing')

    expect(wrapper.text()).toContain('找不到司機')
    expect(wrapper.text()).toContain('NOT_FOUND')
  })
})
