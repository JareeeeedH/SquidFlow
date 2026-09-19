import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listDriverOrders } from '../api/driver-orders'
import {
  getDriverOnlineStatus,
  updateDriverOnlineStatus,
} from '../api/driver-status'
import type { DriverMyOrder, OnlineStatus, OrderStatus } from '../api/types'
import { stopDriverGps, syncDriverGps } from '../lib/driver-gps'

export function hasInProgressDriverOrder(
  orders: Array<Pick<DriverMyOrder, 'status'>>,
): boolean {
  return orders.some((order) => order.status === 'IN_PROGRESS')
}

export const useDriverStatusStore = defineStore('driverStatus', () => {
  const onlineStatus = ref<OnlineStatus | null>(null)
  const hasInProgressOrder = ref(false)

  function applyGpsLifecycle() {
    syncDriverGps({
      onlineStatus: onlineStatus.value,
      inProgress: hasInProgressOrder.value,
    })
  }

  function setInProgressOrder(active: boolean) {
    hasInProgressOrder.value = active
    applyGpsLifecycle()
  }

  function syncInProgressFromOrderStatus(status: OrderStatus | null) {
    setInProgressOrder(status === 'IN_PROGRESS')
  }

  function syncInProgressFromOrders(
    orders: Array<Pick<DriverMyOrder, 'status'>>,
  ) {
    setInProgressOrder(hasInProgressDriverOrder(orders))
  }

  async function syncActiveOrder() {
    const orders = await listDriverOrders()
    syncInProgressFromOrders(orders)
    return orders
  }

  async function sync() {
    const result = await getDriverOnlineStatus()
    onlineStatus.value = result.status
    try {
      await syncActiveOrder()
    } catch {
      applyGpsLifecycle()
    }
    return result
  }

  async function setOnlineStatus(status: OnlineStatus) {
    const result = await updateDriverOnlineStatus(status)
    onlineStatus.value = result.status
    applyGpsLifecycle()
    return result
  }

  function reset() {
    onlineStatus.value = null
    hasInProgressOrder.value = false
    stopDriverGps()
  }

  return {
    onlineStatus,
    hasInProgressOrder,
    sync,
    syncActiveOrder,
    setOnlineStatus,
    setInProgressOrder,
    syncInProgressFromOrderStatus,
    syncInProgressFromOrders,
    reset,
  }
})
