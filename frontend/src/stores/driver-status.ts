import { defineStore } from 'pinia'
import { ref } from 'vue'
import { updateDriverOnlineStatus } from '../api/driver-status'
import type { OnlineStatus } from '../api/types'

export const useDriverStatusStore = defineStore('driverStatus', () => {
  const onlineStatus = ref<OnlineStatus | null>(null)

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
    setOnlineStatus,
    reset,
  }
})
