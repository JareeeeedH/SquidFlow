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
  getDriverOnlineStatus: vi.fn(),
  updateDriverOnlineStatus: vi.fn(),
}))

vi.mock('../api/notifications', () => ({
  createPushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
}))

vi.mock('../lib/web-push', () => ({
  isPushSupported: vi.fn(() => true),
  notificationPermission: vi.fn(() => 'default'),
  getExistingSubscription: vi.fn(async () => null),
  createBrowserSubscription: vi.fn(),
  subscriptionKeys: vi.fn(() => ({
    endpoint: 'https://push.example.test/a',
    p256dh: 'p256dh',
    auth: 'auth',
  })),
}))

import { fetchCurrentUser } from '../api/auth'
import {
  getDriverOnlineStatus,
  updateDriverOnlineStatus,
} from '../api/driver-status'
import { createPushSubscription } from '../api/notifications'
import {
  createBrowserSubscription,
  notificationPermission,
} from '../lib/web-push'
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
      {
        path: '/driver/orders',
        name: 'driver-my-orders',
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

function switches(
  wrapper: Awaited<ReturnType<typeof mountHome>>['wrapper'],
) {
  const byName = wrapper.findAllComponents({ name: 'Switch' })
  if (byName.length > 0) {
    return byName
  }
  return wrapper.findAllComponents({ name: 'NSwitch' })
}

describe('DriverHomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchCurrentUser).mockResolvedValue(driver)
    vi.mocked(getDriverOnlineStatus).mockResolvedValue({ status: 'OFFLINE' })
    vi.mocked(notificationPermission).mockReturnValue('default')
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows username and compact status switches after login', async () => {
    const { wrapper } = await mountHome()

    expect(wrapper.text()).toContain('driver01')
    expect(wrapper.text()).toContain('帳號狀態')
    expect(wrapper.text()).toContain('啟用')
    expect(wrapper.text()).toContain('上線狀態')
    expect(wrapper.text()).toContain('下線')
    expect(wrapper.text()).toContain('目前無法搶新訂單')
    expect(wrapper.text()).toContain('通知')
    expect(wrapper.text()).toContain('通知未開啟')
    expect(wrapper.text()).not.toContain('查看可搶訂單')
    expect(wrapper.text()).not.toContain('我的訂單')
    expect(getDriverOnlineStatus).toHaveBeenCalled()
    expect(useDriverStatusStore().onlineStatus).toBe('OFFLINE')
    expect(switches(wrapper)).toHaveLength(2)
  })

  it('hydrates ONLINE status from GET on load', async () => {
    vi.mocked(getDriverOnlineStatus).mockResolvedValue({ status: 'ONLINE' })
    const { wrapper } = await mountHome()

    expect(useDriverStatusStore().onlineStatus).toBe('ONLINE')
    expect(wrapper.text()).toContain('上線')
    expect(wrapper.text()).toContain('目前可搶單')
    expect(wrapper.text()).not.toContain('未同步')
  })

  it('switches OFFLINE to ONLINE from the backend response', async () => {
    vi.mocked(updateDriverOnlineStatus).mockResolvedValue({ status: 'ONLINE' })
    const { wrapper } = await mountHome()

    await switches(wrapper)[0].vm.$emit('update:value', true)
    await flushPromises()

    expect(updateDriverOnlineStatus).toHaveBeenCalledWith('ONLINE')
    expect(useDriverStatusStore().onlineStatus).toBe('ONLINE')
    expect(wrapper.text()).toContain('上線')
  })

  it('confirms before going offline', async () => {
    vi.mocked(getDriverOnlineStatus).mockResolvedValue({ status: 'ONLINE' })
    vi.mocked(updateDriverOnlineStatus).mockResolvedValue({ status: 'OFFLINE' })
    const { wrapper } = await mountHome()

    await switches(wrapper)[0].vm.$emit('update:value', false)
    await flushPromises()
    expect(updateDriverOnlineStatus).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('確定要下線嗎')

    const confirm = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '確定下線')
    await confirm!.trigger('click')
    await flushPromises()

    expect(updateDriverOnlineStatus).toHaveBeenCalledWith('OFFLINE')
    expect(useDriverStatusStore().onlineStatus).toBe('OFFLINE')
  })

  it('shows backend ACCOUNT_SUSPENDED without changing local status', async () => {
    vi.mocked(updateDriverOnlineStatus).mockRejectedValue(
      new ApiClientError('ACCOUNT_SUSPENDED', '帳號已停用', 403),
    )
    const { wrapper } = await mountHome()

    await switches(wrapper)[0].vm.$emit('update:value', true)
    await flushPromises()

    expect(wrapper.text()).toContain('ACCOUNT_SUSPENDED')
    expect(wrapper.text()).toContain('帳號已停用')
    expect(useDriverStatusStore().onlineStatus).toBe('OFFLINE')
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

  it('shows error when status sync fails', async () => {
    vi.mocked(getDriverOnlineStatus).mockRejectedValue(
      new ApiClientError('INTERNAL_ERROR', '系統發生錯誤', 500),
    )
    const { wrapper } = await mountHome()

    expect(wrapper.text()).toContain('INTERNAL_ERROR')
    expect(wrapper.text()).toContain('重試')
  })

  it('keeps auth user after successful home load', async () => {
    await mountHome()
    expect(useAuthStore().currentUser?.username).toBe('driver01')
  })

  it('disables the notification switch when permission is denied', async () => {
    vi.mocked(notificationPermission).mockReturnValue('denied')
    const { wrapper } = await mountHome()

    expect(wrapper.text()).toContain('通知未開啟')
    expect(switches(wrapper)[1].props('disabled')).toBe(true)
    expect(wrapper.text()).not.toContain('查看可搶訂單')
  })

  it('creates a backend subscription when notifications are enabled', async () => {
    vi.mocked(createBrowserSubscription).mockResolvedValue({
      endpoint: 'https://push.example.test/a',
      unsubscribe: vi.fn(),
      toJSON: () => ({
        endpoint: 'https://push.example.test/a',
        keys: { p256dh: 'p256dh', auth: 'auth' },
      }),
    } as never)
    vi.mocked(createPushSubscription).mockResolvedValue({ id: 'sub-1' })
    const { wrapper } = await mountHome()

    await switches(wrapper)[1].vm.$emit('update:value', true)
    await flushPromises()

    expect(createPushSubscription).toHaveBeenCalledWith({
      endpoint: 'https://push.example.test/a',
      p256dh: 'p256dh',
      auth: 'auth',
    })
    expect(wrapper.text()).toContain('通知已開啟')
  })
})
