import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getDriverOnlineStatus,
  updateDriverOnlineStatus,
} from '../api/driver-status'
import type { OnlineStatus } from '../api/types'
import {
  stopDriverGps,
  syncDriverGpsWithOnlineStatus,
} from '../lib/driver-gps'

export const useDriverStatusStore = defineStore('driverStatus', () => {
  const onlineStatus = ref<OnlineStatus | null>(null)

  async function sync() {
    const result = await getDriverOnlineStatus()
    onlineStatus.value = result.status
    syncDriverGpsWithOnlineStatus(result.status)
    return result
  }

  async function setOnlineStatus(status: OnlineStatus) {
    const result = await updateDriverOnlineStatus(status)
    onlineStatus.value = result.status
    syncDriverGpsWithOnlineStatus(result.status)
    return result
  }

  function reset() {
    onlineStatus.value = null
    stopDriverGps()
  }

  return {
    onlineStatus,
    sync,
    setOnlineStatus,
    reset,
  }
})
