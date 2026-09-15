import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getDriverOnlineStatus,
  updateDriverOnlineStatus,
} from '../api/driver-status'
import type { OnlineStatus } from '../api/types'

export const useDriverStatusStore = defineStore('driverStatus', () => {
  const onlineStatus = ref<OnlineStatus | null>(null)

  async function sync() {
    const result = await getDriverOnlineStatus()
    onlineStatus.value = result.status
    return result
  }

  async function setOnlineStatus(status: OnlineStatus) {
    const result = await updateDriverOnlineStatus(status)
    onlineStatus.value = result.status
    return result
  }

  function reset() {
    onlineStatus.value = null
  }

  return {
    onlineStatus,
    sync,
    setOnlineStatus,
    reset,
  }
})
