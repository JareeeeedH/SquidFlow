import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { DriverOrderDetail } from '../api/types'
import OrderMap from '../components/OrderMap.vue'
import SlideToConfirm from '../components/SlideToConfirm.vue'
import DriverOrderDetailView from './DriverOrderDetailView.vue'

vi.mock('../api/driver-orders', () => ({
  getDriverOrder: vi.fn(),
  acceptDriverOrder: vi.fn(),
  startDriverOrder: vi.fn(),
  completeDriverOrder: vi.fn(),
}))

vi.mock('../api/driver-location', () => ({
  getDriverLocation: vi.fn(),
  updateDriverLocation: vi.fn(),
}))

vi.mock('../lib/driver-gps', () => ({
  syncDriverGps: vi.fn(),
  stopDriverGps: vi.fn(),
}))

import {
  acceptDriverOrder,
  completeDriverOrder,
  getDriverOrder,
  startDriverOrder,
} from '../api/driver-orders'
import { getDriverLocation, updateDriverLocation } from '../api/driver-location'

const openOrder: DriverOrderDetail = {
  id: 'order-1',
  order_no: 'ORD-20260915-002',
  customer_name: '李小姐',
  pickup_location: '左營高鐵站',
  destination: '高雄小港機場',
  created_at: '2026-09-15T07:30:00.000Z',
  price: 1200,
  note: '2件行李',
  status: 'OPEN',
  distance_meters: null,
  trip_distance_meters: null,
  pickup_latitude: null,
  pickup_longitude: null,
}

const ownAccepted: DriverOrderDetail = {
  ...openOrder,
  status: 'ACCEPTED',
}

async function mountDetail(id = 'order-1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
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
      {
        path: '/driver/orders/:id',
        name: 'driver-order-detail',
        component: DriverOrderDetailView,
      },
    ],
  })
  await router.push(`/driver/orders/${id}`)
  await router.isReady()
  const wrapper = mount(DriverOrderDetailView, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper }
}

function bodyText() {
  return document.body.textContent ?? ''
}

async function openDevGpsModal(
  wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper'],
) {
  await wrapper.get('.dev-gps-btn').trigger('click')
  await flushPromises()
}

function coordInputs() {
  return Array.from(
    document.body.querySelectorAll<HTMLInputElement>('.dev-gps-coords input'),
  )
}

function durationInput() {
  const labels = Array.from(document.body.querySelectorAll('label.dev-gps-field'))
  const duration = labels.find((label) =>
    label.textContent?.includes('發送時間'),
  )
  return duration?.querySelector('input') ?? null
}

async function setInputValue(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

async function clickDevGpsButton(label: string) {
  const buttons = Array.from(
    document.body.querySelectorAll<HTMLButtonElement>('.dev-gps-actions button'),
  )
  const target = buttons.find((btn) => btn.textContent?.includes(label))
  expect(target).toBeTruthy()
  target!.click()
  await flushPromises()
}

async function confirmSlide(wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper']) {
  const slide = wrapper.getComponent(SlideToConfirm)
  slide.vm.complete()
  await flushPromises()
}

describe('DriverOrderDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getDriverOrder).mockResolvedValue(openOrder)
    vi.mocked(getDriverLocation).mockResolvedValue({
      latitude: null,
      longitude: null,
      location_updated_at: null,
    })
    vi.mocked(acceptDriverOrder).mockResolvedValue({
      id: 'order-1',
      status: 'ACCEPTED',
      driver_id: 'driver-1',
      accepted_at: '2026-09-15T07:05:00.000Z',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    vi.resetAllMocks()
  })

  it('shows an OPEN order with a slide-to-accept action', async () => {
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('ORD-20260915-002')
    expect(wrapper.text()).toContain('搶單中')
    expect(wrapper.text()).toContain('李小姐')
    expect(wrapper.text()).toContain('左營高鐵站')
    expect(wrapper.text()).toContain('高雄小港機場')
    expect(wrapper.text()).toContain('NT$ 1,200')
    expect(wrapper.text()).toContain('2件行李')
    expect(wrapper.text()).toContain('滑動接單')
    expect(wrapper.text()).not.toContain('滑動開始行程')
    expect(wrapper.text()).not.toContain('滑動完成訂單')
    expect(wrapper.text()).toContain('返回')
    expect(wrapper.find('.compact-summary').exists()).toBe(true)
    expect(wrapper.find('.secondary-fields').exists()).toBe(true)
  })

  it('accepts an OPEN order from the backend response then reloads detail', async () => {
    vi.mocked(getDriverOrder)
      .mockResolvedValueOnce(openOrder)
      .mockResolvedValueOnce(ownAccepted)
    const { wrapper } = await mountDetail()

    await confirmSlide(wrapper)

    expect(acceptDriverOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('接單成功')
    expect(wrapper.text()).toContain('已接單')
    expect(wrapper.text()).not.toContain('滑動接單')
  })

  it('shows the backend error when another driver already accepted', async () => {
    vi.mocked(acceptDriverOrder).mockRejectedValue(
      new ApiClientError(
        'ORDER_ALREADY_ACCEPTED',
        '此訂單已被其他司機接單',
        409,
      ),
    )
    vi.mocked(getDriverOrder)
      .mockResolvedValueOnce(openOrder)
      .mockRejectedValueOnce(
        new ApiClientError('NOT_FOUND', '找不到訂單', 404),
      )
    const { wrapper } = await mountDetail()

    await confirmSlide(wrapper)

    expect(wrapper.text()).toContain('ORDER_ALREADY_ACCEPTED')
    expect(wrapper.text()).toContain('此訂單已被其他司機接單')
  })

  it("shows start on the current driver's accepted order", async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(ownAccepted)
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('已接單')
    expect(wrapper.text()).toContain('李小姐')
    expect(wrapper.text()).toContain('滑動開始行程')
    expect(wrapper.text()).toContain('返回')
    expect(wrapper.text()).not.toContain('滑動接單')
    expect(wrapper.text()).not.toContain('滑動完成訂單')
  })

  it('starts then completes from order detail via slide confirm', async () => {
    vi.mocked(startDriverOrder).mockResolvedValue({
      id: 'order-1',
      status: 'IN_PROGRESS',
      started_at: '2026-09-15T07:40:00.000Z',
    })
    vi.mocked(completeDriverOrder).mockResolvedValue({
      id: 'order-1',
      status: 'COMPLETED',
      completed_at: '2026-09-15T08:20:00.000Z',
      trip_distance_meters: 8400,
      price: 275,
    })
    vi.mocked(getDriverOrder)
      .mockResolvedValueOnce(ownAccepted)
      .mockResolvedValueOnce({
        ...ownAccepted,
        status: 'IN_PROGRESS',
        trip_distance_meters: 3800,
      })
      .mockResolvedValueOnce({
        ...ownAccepted,
        status: 'COMPLETED',
        trip_distance_meters: 8400,
        price: 275,
      })

    const { wrapper } = await mountDetail()
    await confirmSlide(wrapper)

    expect(startDriverOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('行程已開始')
    expect(wrapper.text()).toContain('滑動完成訂單')
    expect(wrapper.text()).toContain('已行駛')
    expect(wrapper.text()).toContain('3.8 km')

    await confirmSlide(wrapper)

    expect(completeDriverOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('訂單已完成')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).toContain('行駛里程')
    expect(wrapper.text()).toContain('8.4 km')
    expect(wrapper.text()).toContain('車資')
    expect(wrapper.text()).toContain('NT$ 275')
    expect(wrapper.text()).not.toContain('滑動開始行程')
    expect(wrapper.text()).not.toContain('滑動完成訂單')
  })

  it('shows in-progress and completed trip fields from backend only', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue({
      ...ownAccepted,
      status: 'IN_PROGRESS',
      trip_distance_meters: 3800,
      distance_meters: 10500,
    })
    const inProgress = await mountDetail()
    expect(inProgress.wrapper.text()).toContain('已行駛')
    expect(inProgress.wrapper.text()).toContain('3.8 km')
    expect(inProgress.wrapper.text()).not.toContain('行駛里程')
    expect(inProgress.wrapper.text()).not.toContain('直線距離')

    vi.mocked(getDriverOrder).mockResolvedValue({
      ...ownAccepted,
      status: 'COMPLETED',
      trip_distance_meters: 8400,
      distance_meters: 10500,
      price: 275,
    })
    const completed = await mountDetail()
    expect(completed.wrapper.text()).toContain('行駛里程')
    expect(completed.wrapper.text()).toContain('8.4 km')
    expect(completed.wrapper.text()).toContain('車資')
    expect(completed.wrapper.text()).toContain('NT$ 275')
    expect(completed.wrapper.text()).not.toContain('已行駛')
    expect(completed.wrapper.text()).not.toContain('直線距離')
  })

  it('shows straight-line distance on OPEN and ACCEPTED only', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue({
      ...openOrder,
      distance_meters: 1200,
    })
    const open = await mountDetail()
    expect(open.wrapper.text()).toContain('直線距離')
    expect(open.wrapper.text()).toContain('1.2 公里')
    expect(open.wrapper.text()).not.toContain('已行駛')

    vi.mocked(getDriverOrder).mockResolvedValue({
      ...ownAccepted,
      distance_meters: 2450.5,
    })
    const accepted = await mountDetail()
    expect(accepted.wrapper.text()).toContain('直線距離')
    expect(accepted.wrapper.text()).toContain('2.5 公里')
    expect(accepted.wrapper.text()).not.toContain('已行駛')
  })

  it('hides straight-line distance on IN_PROGRESS even when API returns distance_meters', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue({
      ...ownAccepted,
      status: 'IN_PROGRESS',
      distance_meters: 10500,
      trip_distance_meters: 9900,
    })
    const { wrapper } = await mountDetail()
    expect(wrapper.text()).toContain('已行駛')
    expect(wrapper.text()).toContain('9.9 km')
    expect(wrapper.text()).not.toContain('直線距離')
    expect(wrapper.text()).not.toContain('10.5 公里')
  })

  it('shows 404 when the order is missing or belongs to another driver', async () => {
    vi.mocked(getDriverOrder).mockRejectedValue(
      new ApiClientError('NOT_FOUND', '找不到訂單', 404),
    )
    const { wrapper } = await mountDetail('missing')

    expect(wrapper.text()).toContain('找不到訂單')
    expect(wrapper.text()).toContain('NOT_FOUND')
    expect(wrapper.text()).not.toContain('李小姐')
  })

  it('shows DEV GPS button in development and opens the modal', async () => {
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('DEV GPS')
    await openDevGpsModal(wrapper)

    expect(bodyText()).toContain('DEV GPS 測試')
    expect(bodyText()).toContain('發送時間')
    expect(bodyText()).toContain('座標 1')
    expect(bodyText()).toContain('開始發送')
    expect(bodyText()).toContain('繼續')
    expect(bodyText()).toContain('停止')
    expect(bodyText()).toContain('關閉')
    expect(coordInputs()).toHaveLength(5)
    expect(coordInputs()[0].value).toBe('22.619396, 120.321416')
  })

  it('can add more coordinate rows', async () => {
    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)

    const add = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button'),
    ).find((btn) => btn.textContent?.includes('新增座標'))
    expect(add).toBeTruthy()
    add!.click()
    await flushPromises()

    expect(coordInputs()).toHaveLength(6)
  })

  it('rejects invalid coordinates and duration before start', async () => {
    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)

    await setInputValue(coordInputs()[0], '91, 120.3')
    await clickDevGpsButton('開始發送')
    expect(updateDriverLocation).not.toHaveBeenCalled()
    expect(bodyText()).toContain('座標 1')

    await setInputValue(coordInputs()[0], '22.6, 120.3')
    const duration = durationInput()
    expect(duration).toBeTruthy()
    await setInputValue(duration!, '0')
    await clickDevGpsButton('開始發送')
    expect(updateDriverLocation).not.toHaveBeenCalled()
    expect(bodyText()).toContain('發送時間必須為正數')
  })

  it('sends the first point immediately and continues by interval', async () => {
    vi.useFakeTimers()
    vi.mocked(updateDriverLocation).mockImplementation(async (lat, lng) => ({
      latitude: lat,
      longitude: lng,
      location_updated_at: '2026-09-25T03:00:00.000Z',
    }))

    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)

    await setInputValue(coordInputs()[0], '22.1, 120.1')
    await setInputValue(coordInputs()[1], '22.2, 120.2')
    await setInputValue(coordInputs()[2], '22.3, 120.3')
    await setInputValue(durationInput()!, '3')

    await clickDevGpsButton('開始發送')
    expect(updateDriverLocation).toHaveBeenCalledTimes(1)
    expect(updateDriverLocation).toHaveBeenNthCalledWith(1, 22.1, 120.1)
    expect(bodyText()).toContain('發送中：1 / 3')

    // 3 points / 3 minutes => 60s interval
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(2)
    expect(updateDriverLocation).toHaveBeenNthCalledWith(2, 22.2, 120.2)

    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(3)
    expect(updateDriverLocation).toHaveBeenNthCalledWith(3, 22.3, 120.3)
    expect(bodyText()).toContain('發送完成')
    expect(bodyText()).toContain('3 / 3')
    expect(bodyText()).toContain('DEV GPS 測試')

    vi.useRealTimers()
  })

  it('pause clears the timer and resume continues from the next point', async () => {
    vi.useFakeTimers()
    vi.mocked(updateDriverLocation).mockImplementation(async (lat, lng) => ({
      latitude: lat,
      longitude: lng,
      location_updated_at: '2026-09-25T03:00:00.000Z',
    }))

    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)
    await setInputValue(coordInputs()[0], '22.1, 120.1')
    await setInputValue(coordInputs()[1], '22.2, 120.2')
    await setInputValue(coordInputs()[2], '22.3, 120.3')
    await setInputValue(durationInput()!, '3')

    await clickDevGpsButton('開始發送')
    expect(updateDriverLocation).toHaveBeenCalledTimes(1)

    await clickDevGpsButton('暫停')
    expect(bodyText()).toContain('已暫停')

    await vi.advanceTimersByTimeAsync(120_000)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(1)

    await clickDevGpsButton('繼續')
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(2)
    expect(updateDriverLocation).toHaveBeenNthCalledWith(2, 22.2, 120.2)

    vi.useRealTimers()
  })

  it('stop clears the timer and does not continue sending', async () => {
    vi.useFakeTimers()
    vi.mocked(updateDriverLocation).mockImplementation(async (lat, lng) => ({
      latitude: lat,
      longitude: lng,
      location_updated_at: '2026-09-25T03:00:00.000Z',
    }))

    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)
    await setInputValue(coordInputs()[0], '22.1, 120.1')
    await setInputValue(coordInputs()[1], '22.2, 120.2')
    await setInputValue(durationInput()!, '2')

    await clickDevGpsButton('開始發送')
    await clickDevGpsButton('停止')
    expect(bodyText()).toContain('已停止')

    await vi.advanceTimersByTimeAsync(120_000)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('API failure stops further sends and shows the error', async () => {
    vi.useFakeTimers()
    vi.mocked(updateDriverLocation)
      .mockResolvedValueOnce({
        latitude: 22.1,
        longitude: 120.1,
        location_updated_at: '2026-09-25T03:00:00.000Z',
      })
      .mockRejectedValueOnce(
        new ApiClientError('VALIDATION_ERROR', '座標無效', 400),
      )

    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)
    await setInputValue(coordInputs()[0], '22.1, 120.1')
    await setInputValue(coordInputs()[1], '22.2, 120.2')
    await setInputValue(durationInput()!, '2')

    await clickDevGpsButton('開始發送')
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()

    expect(updateDriverLocation).toHaveBeenCalledTimes(2)
    expect(bodyText()).toContain('發送失敗')
    expect(bodyText()).toContain('VALIDATION_ERROR')
    expect(bodyText()).toContain('座標無效')

    await vi.advanceTimersByTimeAsync(120_000)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })

  it('updates OrderMap selfLocation after successful DEV GPS send', async () => {
    vi.useFakeTimers()
    vi.mocked(updateDriverLocation).mockImplementation(async (lat, lng) => ({
      latitude: lat,
      longitude: lng,
      location_updated_at: '2026-09-25T03:00:00.000Z',
    }))

    const { wrapper } = await mountDetail()
    expect(wrapper.findComponent(OrderMap).props('selfLocation')).toBeNull()

    await openDevGpsModal(wrapper)
    await setInputValue(coordInputs()[0], '22.1, 120.1')
    await setInputValue(coordInputs()[1], '22.2, 120.2')
    await setInputValue(durationInput()!, '2')

    await clickDevGpsButton('開始發送')
    await flushPromises()

    expect(wrapper.findComponent(OrderMap).props('selfLocation')).toEqual({
      lat: 22.1,
      lng: 120.1,
      label: '我的位置',
    })

    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()

    expect(wrapper.findComponent(OrderMap).props('selfLocation')).toEqual({
      lat: 22.2,
      lng: 120.2,
      label: '我的位置',
    })

    vi.useRealTimers()
  })

  it('keeps previous OrderMap selfLocation when DEV GPS API fails', async () => {
    vi.useFakeTimers()
    vi.mocked(updateDriverLocation)
      .mockResolvedValueOnce({
        latitude: 22.1,
        longitude: 120.1,
        location_updated_at: '2026-09-25T03:00:00.000Z',
      })
      .mockRejectedValueOnce(
        new ApiClientError('VALIDATION_ERROR', '座標無效', 400),
      )

    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)
    await setInputValue(coordInputs()[0], '22.1, 120.1')
    await setInputValue(coordInputs()[1], '22.2, 120.2')
    await setInputValue(durationInput()!, '2')

    await clickDevGpsButton('開始發送')
    await flushPromises()
    expect(wrapper.findComponent(OrderMap).props('selfLocation')).toEqual({
      lat: 22.1,
      lng: 120.1,
      label: '我的位置',
    })

    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()

    expect(bodyText()).toContain('VALIDATION_ERROR')
    expect(wrapper.findComponent(OrderMap).props('selfLocation')).toEqual({
      lat: 22.1,
      lng: 120.1,
      label: '我的位置',
    })

    vi.useRealTimers()
  })
})
