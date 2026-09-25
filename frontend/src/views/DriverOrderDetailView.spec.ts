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
  arriveDriverOrder: vi.fn(),
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
  arriveDriverOrder,
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
  arrived_at: null,
  calculated_fare: null,
  final_fare: null,
  pickup_latitude: null,
  pickup_longitude: null,
}

const ownAccepted: DriverOrderDetail = {
  ...openOrder,
  status: 'ACCEPTED',
}

const inProgressDriving: DriverOrderDetail = {
  ...ownAccepted,
  status: 'IN_PROGRESS',
  trip_distance_meters: 3800,
  arrived_at: null,
  calculated_fare: null,
  final_fare: null,
}

const inProgressArrived: DriverOrderDetail = {
  ...inProgressDriving,
  trip_distance_meters: 8400,
  arrived_at: '2026-09-15T08:10:00.000Z',
  calculated_fare: 275,
  final_fare: null,
}

const completedOrder: DriverOrderDetail = {
  ...inProgressArrived,
  status: 'COMPLETED',
  final_fare: 280,
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

async function seedSuccessfulDevGps(
  wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper'],
  lat = 22.5775,
  lng = 120.35,
) {
  vi.mocked(updateDriverLocation).mockResolvedValue({
    latitude: lat,
    longitude: lng,
    location_updated_at: '2026-09-15T08:09:00.000Z',
  })
  await openDevGpsModal(wrapper)
  const duration = durationInput()
  expect(duration).toBeTruthy()
  await setInputValue(duration!, '1')
  await setInputValue(coordInputs()[0], `${lat}, ${lng}`)
  await setInputValue(coordInputs()[1], '')
  await setInputValue(coordInputs()[2], '')
  await setInputValue(coordInputs()[3], '')
  await setInputValue(coordInputs()[4], '')
  vi.useFakeTimers()
  await clickDevGpsButton('開始發送')
  await vi.advanceTimersByTimeAsync(0)
  await flushPromises()
  vi.useRealTimers()
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

  it('IN_PROGRESS shows arrive/complete buttons with complete disabled', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressDriving)
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('抵達')
    expect(wrapper.text()).toContain('完成')
    expect(wrapper.text()).not.toContain('滑動完成訂單')
    const arrive = wrapper.get('[data-testid="arrive-button"]')
    const complete = wrapper.get('[data-testid="complete-button"]')
    expect(arrive.attributes('disabled')).toBeUndefined()
    expect(complete.attributes('disabled')).toBeDefined()
  })

  it('shows estimated fare while driving from trip distance', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressDriving)
    const { wrapper } = await mountDetail()

    expect(wrapper.text()).toContain('已行駛')
    expect(wrapper.text()).toContain('3.8 km')
    expect(wrapper.text()).toContain('預估價格')
    // 3800m → 100 + floor((3800-1250)/200)*5 = 100 + 12*5 = 160
    expect(wrapper.text()).toContain('NT$ 160')
  })

  it('arrives using last successful DEV GPS and shows calculated_fare', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressDriving)
    vi.mocked(arriveDriverOrder).mockResolvedValue({
      id: 'order-1',
      status: 'IN_PROGRESS',
      arrived_at: '2026-09-15T08:10:00.000Z',
      trip_distance_meters: 8400,
      calculated_fare: 275,
      final_fare: null,
    })

    const { wrapper } = await mountDetail()
    await seedSuccessfulDevGps(wrapper, 22.5775, 120.35)

    await wrapper.get('[data-testid="arrive-button"]').trigger('click')
    await flushPromises()

    expect(arriveDriverOrder).toHaveBeenCalledWith('order-1', 22.5775, 120.35)
    expect(wrapper.text()).toContain('已抵達')
    expect(wrapper.text()).toContain('8.4 km')
    expect(wrapper.get('[data-testid="arrive-button"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="complete-button"]').attributes('disabled')).toBeUndefined()

    const fareInput = wrapper.get('[data-testid="final-fare-input"] input')
      .element as HTMLInputElement
    expect(fareInput.value).toBe('275')
  })

  it('allows editing final fare and completes with that value', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressArrived)
    vi.mocked(completeDriverOrder).mockResolvedValue({
      id: 'order-1',
      status: 'COMPLETED',
      completed_at: '2026-09-15T08:20:00.000Z',
      trip_distance_meters: 8400,
      calculated_fare: 275,
      final_fare: 280,
    })

    const { wrapper } = await mountDetail()
    const fareInput = wrapper.get('[data-testid="final-fare-input"] input')
    await fareInput.setValue('280')
    await flushPromises()

    await wrapper.get('[data-testid="complete-button"]').trigger('click')
    await flushPromises()

    expect(completeDriverOrder).toHaveBeenCalledWith('order-1', 280)
    expect(wrapper.text()).toContain('訂單已完成')
    expect(wrapper.text()).toContain('最終價格')
    expect(wrapper.text()).toContain('NT$ 280')
    expect(wrapper.find('[data-testid="arrive-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="complete-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="final-fare-input"]').exists()).toBe(false)
  })

  it('does not submit when final fare is invalid and keeps the input', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressArrived)
    const { wrapper } = await mountDetail()

    const fareInput = wrapper.get('[data-testid="final-fare-input"] input')
    await fareInput.setValue('12.5')
    await flushPromises()
    await wrapper.get('[data-testid="complete-button"]').trigger('click')
    await flushPromises()

    expect(completeDriverOrder).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('請輸入有效的整數價格')
    expect((fareInput.element as HTMLInputElement).value).toBe('12.5')
  })

  it('keeps driving UI when Arrive API fails', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressDriving)
    vi.mocked(arriveDriverOrder).mockRejectedValue(
      new ApiClientError('INTERNAL_ERROR', '抵達失敗', 500),
    )

    const { wrapper } = await mountDetail()
    await seedSuccessfulDevGps(wrapper)

    await wrapper.get('[data-testid="arrive-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('抵達失敗')
    expect(wrapper.get('[data-testid="arrive-button"]').text()).toContain('抵達')
    expect(wrapper.get('[data-testid="complete-button"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="final-fare-input"]').exists()).toBe(false)
  })

  it('keeps user final fare input when Complete API fails', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressArrived)
    vi.mocked(completeDriverOrder).mockRejectedValue(
      new ApiClientError('INTERNAL_ERROR', '完成失敗', 500),
    )

    const { wrapper } = await mountDetail()
    const fareInput = wrapper.get('[data-testid="final-fare-input"] input')
    await fareInput.setValue('299')
    await flushPromises()

    await wrapper.get('[data-testid="complete-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('完成失敗')
    expect((fareInput.element as HTMLInputElement).value).toBe('299')
    expect(wrapper.get('[data-testid="complete-button"]').exists()).toBe(true)
  })

  it('restores driving / arrived / completed UI from backend on load', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressDriving)
    const driving = await mountDetail()
    expect(driving.wrapper.get('[data-testid="arrive-button"]').text()).toContain('抵達')
    expect(driving.wrapper.get('[data-testid="complete-button"]').attributes('disabled')).toBeDefined()
    expect(driving.wrapper.find('[data-testid="final-fare-input"]').exists()).toBe(false)
    driving.wrapper.unmount()

    vi.mocked(getDriverOrder).mockResolvedValue(inProgressArrived)
    const arrived = await mountDetail()
    expect(arrived.wrapper.get('[data-testid="arrive-button"]').text()).toContain('已抵達')
    expect(arrived.wrapper.get('[data-testid="complete-button"]').attributes('disabled')).toBeUndefined()
    const arrivedInput = arrived.wrapper.get('[data-testid="final-fare-input"] input')
      .element as HTMLInputElement
    expect(arrivedInput.value).toBe('275')
    arrived.wrapper.unmount()

    vi.mocked(getDriverOrder).mockResolvedValue(completedOrder)
    const completed = await mountDetail()
    expect(completed.wrapper.text()).toContain('已行駛')
    expect(completed.wrapper.text()).toContain('8.4 km')
    expect(completed.wrapper.text()).toContain('最終價格')
    expect(completed.wrapper.text()).toContain('NT$ 280')
    expect(completed.wrapper.find('[data-testid="arrive-button"]').exists()).toBe(false)
    expect(completed.wrapper.find('[data-testid="final-fare-input"]').exists()).toBe(false)
  })

  it('starts from accepted then shows arrive/complete UI', async () => {
    vi.mocked(startDriverOrder).mockResolvedValue({
      id: 'order-1',
      status: 'IN_PROGRESS',
      started_at: '2026-09-15T07:40:00.000Z',
    })
    vi.mocked(getDriverOrder)
      .mockResolvedValueOnce(ownAccepted)
      .mockResolvedValueOnce(inProgressDriving)

    const { wrapper } = await mountDetail()
    await confirmSlide(wrapper)

    expect(startDriverOrder).toHaveBeenCalledWith('order-1')
    expect(wrapper.text()).toContain('行程已開始')
    expect(wrapper.text()).toContain('抵達')
    expect(wrapper.text()).toContain('已行駛')
    expect(wrapper.text()).toContain('3.8 km')
    expect(wrapper.text()).not.toContain('滑動完成訂單')
  })

  it('shows in-progress and completed trip fields from backend only', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue({
      ...inProgressDriving,
      distance_meters: 10500,
    })
    const inProgress = await mountDetail()
    expect(inProgress.wrapper.text()).toContain('已行駛')
    expect(inProgress.wrapper.text()).toContain('3.8 km')
    expect(inProgress.wrapper.text()).not.toContain('直線距離')
    inProgress.wrapper.unmount()

    vi.mocked(getDriverOrder).mockResolvedValue({
      ...completedOrder,
      distance_meters: 10500,
    })
    const completed = await mountDetail()
    expect(completed.wrapper.text()).toContain('已行駛')
    expect(completed.wrapper.text()).toContain('8.4 km')
    expect(completed.wrapper.text()).toContain('最終價格')
    expect(completed.wrapper.text()).toContain('NT$ 280')
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
    open.wrapper.unmount()

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
      ...inProgressDriving,
      trip_distance_meters: 9900,
      distance_meters: 10500,
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

  it('validates duration and requires at least one coordinate before start', async () => {
    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)

    await setInputValue(durationInput()!, '0')
    await clickDevGpsButton('開始發送')
    expect(bodyText()).toContain('發送時間必須為正數')
    expect(updateDriverLocation).not.toHaveBeenCalled()

    await setInputValue(durationInput()!, '5')
    for (const input of coordInputs()) {
      await setInputValue(input, '')
    }
    await clickDevGpsButton('開始發送')
    expect(bodyText()).toContain('至少需要 1 個有效座標')
    expect(updateDriverLocation).not.toHaveBeenCalled()
  })

  it('sends coordinates sequentially over the configured duration', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressDriving)
    vi.mocked(updateDriverLocation).mockImplementation(async (lat, lng) => ({
      latitude: lat,
      longitude: lng,
      location_updated_at: '2026-09-15T08:00:00.000Z',
    }))

    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)
    await setInputValue(durationInput()!, '1')
    await setInputValue(coordInputs()[0], '22.1, 120.1')
    await setInputValue(coordInputs()[1], '22.2, 120.2')
    await setInputValue(coordInputs()[2], '22.3, 120.3')
    await setInputValue(coordInputs()[3], '')
    await setInputValue(coordInputs()[4], '')

    vi.useFakeTimers()
    await clickDevGpsButton('開始發送')
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(1)
    expect(updateDriverLocation).toHaveBeenNthCalledWith(1, 22.1, 120.1)

    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(2)
    expect(updateDriverLocation).toHaveBeenNthCalledWith(2, 22.2, 120.2)

    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(3)
    expect(updateDriverLocation).toHaveBeenNthCalledWith(3, 22.3, 120.3)
    expect(bodyText()).toContain('發送完成')
    expect(bodyText()).toContain('DEV GPS 測試')
  })

  it('can pause and resume sequential sending', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressDriving)
    vi.mocked(updateDriverLocation).mockImplementation(async (lat, lng) => ({
      latitude: lat,
      longitude: lng,
      location_updated_at: '2026-09-15T08:00:00.000Z',
    }))

    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)
    await setInputValue(durationInput()!, '1')
    await setInputValue(coordInputs()[0], '22.1, 120.1')
    await setInputValue(coordInputs()[1], '22.2, 120.2')
    await setInputValue(coordInputs()[2], '')
    await setInputValue(coordInputs()[3], '')
    await setInputValue(coordInputs()[4], '')

    vi.useFakeTimers()
    await clickDevGpsButton('開始發送')
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(1)

    await clickDevGpsButton('暫停')
    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(1)

    await clickDevGpsButton('繼續')
    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(2)
    expect(updateDriverLocation).toHaveBeenNthCalledWith(2, 22.2, 120.2)
  })

  it('can stop sending and keep the modal open', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressDriving)
    vi.mocked(updateDriverLocation).mockImplementation(async (lat, lng) => ({
      latitude: lat,
      longitude: lng,
      location_updated_at: '2026-09-15T08:00:00.000Z',
    }))

    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)
    await setInputValue(durationInput()!, '1')
    await setInputValue(coordInputs()[0], '22.1, 120.1')
    await setInputValue(coordInputs()[1], '22.2, 120.2')
    await setInputValue(coordInputs()[2], '')
    await setInputValue(coordInputs()[3], '')
    await setInputValue(coordInputs()[4], '')

    vi.useFakeTimers()
    await clickDevGpsButton('開始發送')
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(1)

    await clickDevGpsButton('停止')
    expect(bodyText()).toContain('已停止')
    expect(bodyText()).toContain('DEV GPS 測試')
  })

  it('marks failed send and does not advance the success cursor', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressDriving)
    vi.mocked(updateDriverLocation)
      .mockResolvedValueOnce({
        latitude: 22.1,
        longitude: 120.1,
        location_updated_at: '2026-09-15T08:00:00.000Z',
      })
      .mockRejectedValueOnce(
        new ApiClientError('INTERNAL_ERROR', '定位更新失敗', 500),
      )

    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)
    await setInputValue(durationInput()!, '1')
    await setInputValue(coordInputs()[0], '22.1, 120.1')
    await setInputValue(coordInputs()[1], '22.2, 120.2')
    await setInputValue(coordInputs()[2], '')
    await setInputValue(coordInputs()[3], '')
    await setInputValue(coordInputs()[4], '')

    vi.useFakeTimers()
    await clickDevGpsButton('開始發送')
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()
    expect(updateDriverLocation).toHaveBeenCalledTimes(2)
    expect(bodyText()).toContain('發送失敗')
    expect(bodyText()).toContain('INTERNAL_ERROR')

    // Failed coords must not become arrive GPS: only first success is usable.
    vi.mocked(arriveDriverOrder).mockResolvedValue({
      id: 'order-1',
      status: 'IN_PROGRESS',
      arrived_at: '2026-09-15T08:10:00.000Z',
      trip_distance_meters: 8400,
      calculated_fare: 275,
      final_fare: null,
    })
    await wrapper.get('[data-testid="arrive-button"]').trigger('click')
    await flushPromises()
    expect(arriveDriverOrder).toHaveBeenCalledWith('order-1', 22.1, 120.1)
  })

  it('updates OrderMap selfLocation after successful DEV GPS send', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressDriving)
    vi.mocked(updateDriverLocation).mockImplementation(async (lat, lng) => ({
      latitude: lat,
      longitude: lng,
      location_updated_at: '2026-09-15T08:00:00.000Z',
    }))

    const { wrapper } = await mountDetail()
    await openDevGpsModal(wrapper)
    await setInputValue(durationInput()!, '1')
    await setInputValue(coordInputs()[0], '22.5, 120.5')
    await setInputValue(coordInputs()[1], '')
    await setInputValue(coordInputs()[2], '')
    await setInputValue(coordInputs()[3], '')
    await setInputValue(coordInputs()[4], '')

    vi.useFakeTimers()
    await clickDevGpsButton('開始發送')
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()

    const map = wrapper.getComponent(OrderMap)
    expect(map.props('selfLocation')).toEqual({
      lat: 22.5,
      lng: 120.5,
      label: '我的位置',
    })
  })

  it('keeps previous OrderMap selfLocation when DEV GPS API fails', async () => {
    vi.mocked(getDriverOrder).mockResolvedValue(inProgressDriving)
    vi.mocked(getDriverLocation).mockResolvedValue({
      latitude: 22.0,
      longitude: 120.0,
      location_updated_at: '2026-09-15T07:00:00.000Z',
    })
    vi.mocked(updateDriverLocation).mockRejectedValue(
      new ApiClientError('INTERNAL_ERROR', '定位更新失敗', 500),
    )

    const { wrapper } = await mountDetail()
    const mapBefore = wrapper.getComponent(OrderMap)
    expect(mapBefore.props('selfLocation')).toEqual({
      lat: 22.0,
      lng: 120.0,
      label: '我的位置',
    })

    await openDevGpsModal(wrapper)
    await setInputValue(durationInput()!, '1')
    await setInputValue(coordInputs()[0], '22.9, 120.9')
    await setInputValue(coordInputs()[1], '')
    await setInputValue(coordInputs()[2], '')
    await setInputValue(coordInputs()[3], '')
    await setInputValue(coordInputs()[4], '')

    vi.useFakeTimers()
    await clickDevGpsButton('開始發送')
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()

    const mapAfter = wrapper.getComponent(OrderMap)
    expect(mapAfter.props('selfLocation')).toEqual({
      lat: 22.0,
      lng: 120.0,
      label: '我的位置',
    })
  })
})
