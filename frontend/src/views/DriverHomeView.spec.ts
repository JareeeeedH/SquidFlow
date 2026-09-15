import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { CurrentUser } from '../api/types'
import DriverHomeView from './DriverHomeView.vue'

vi.mock('../api/auth', () => ({
  fetchCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('../api/driver-status', () => ({
  updateDriverOnlineStatus: vi.fn(),
}))

import { fetchCurrentUser } from '../api/auth'
import { updateDriverOnlineStatus } from '../api/driver-status'
import { useAuthStore } from '../stores/auth'
import { useDriverStatusStore } from '../stores/driver-status'

const driver: CurrentUser = {
  id: 'user-1',
  username: 'driver01',
  role: 'DRIVER',
  status: 'ACTIVE',
}

async function mountHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/driver', name: 'driver-home', component: DriverHomeView },
      {
        path: '/driver/orders/open',
        name: 'driver-open-orders',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/driver')
  await router.isReady()
  const wrapper = mount(DriverHomeView, {
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('DriverHomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchCurrentUser).mockResolvedValue(driver)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows username and separate account / online status after login', async () => {
    const { wrapper } = await mountHome()

    expect(wrapper.text()).toContain('driver01')
    expect(wrapper.text()).toContain('帳號狀態')
    expect(wrapper.text()).toContain('啟用')
    expect(wrapper.text()).toContain('上線狀態')
    expect(wrapper.text()).toContain('尚未向伺服器確認')
    expect(wrapper.text()).toContain('上線')
    expect(wrapper.text()).toContain('可搶訂單')
  })

  it('switches OFFLINE to ONLINE from the backend response', async () => {
    vi.mocked(updateDriverOnlineStatus).mockResolvedValue({ status: 'ONLINE' })
    const { wrapper } = await mountHome()

    const online = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '上線')
    await online!.trigger('click')
    await flushPromises()

    expect(updateDriverOnlineStatus).toHaveBeenCalledWith('ONLINE')
    expect(useDriverStatusStore().onlineStatus).toBe('ONLINE')
    expect(wrapper.text()).toContain('上線')
    expect(wrapper.text()).toContain('下線')
  })

  it('shows backend ACCOUNT_SUSPENDED without changing local status', async () => {
    vi.mocked(updateDriverOnlineStatus).mockRejectedValue(
      new ApiClientError('ACCOUNT_SUSPENDED', '帳號已停用', 403),
    )
    const { wrapper } = await mountHome()

    const online = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '上線')
    await online!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('ACCOUNT_SUSPENDED')
    expect(wrapper.text()).toContain('帳號已停用')
    expect(useDriverStatusStore().onlineStatus).toBeNull()
  })

  it('shows loading then error on home refresh failure', async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(
      new ApiClientError('NETWORK_ERROR', '無法連線到伺服器', 0),
    )
    const { wrapper } = await mountHome()

    expect(wrapper.text()).toContain('NETWORK_ERROR')
    expect(wrapper.text()).toContain('無法連線到伺服器')
    expect(wrapper.text()).toContain('重試')
  })

  it('opens open orders from home', async () => {
    const { wrapper, router } = await mountHome()
    const push = vi.spyOn(router, 'push')

    const entry = wrapper
      .findAll('button')
      .find((button) => button.text().includes('可搶訂單'))
    await entry!.trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'driver-open-orders' })
  })

  it('keeps auth user after successful home load', async () => {
    await mountHome()
    expect(useAuthStore().currentUser?.username).toBe('driver01')
  })
})
