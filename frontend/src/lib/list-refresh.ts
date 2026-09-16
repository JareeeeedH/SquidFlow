import { computed, onUnmounted, ref } from 'vue'

/** Admin Dashboard / Orders list poll interval (Spec §4.3). */
export const ADMIN_LIST_POLL_INTERVAL_MS = 30_000

/** Manual refresh cooldown after a completed manual request (Spec §4.3). */
export const MANUAL_REFRESH_COOLDOWN_MS = 10_000

export type ListRefreshSource = 'manual' | 'auto'

export type ListRefreshControlOptions = {
  cooldownMs?: number
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
}

/**
 * Shared gate for Admin list refresh: in-flight dedupe and manual cooldown.
 * Manual UI feedback (button label / overlay) is driven by `manualUpdating`.
 */
export function useListRefreshControl(options: ListRefreshControlOptions = {}) {
  const cooldownMs = options.cooldownMs ?? MANUAL_REFRESH_COOLDOWN_MS
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout

  const inFlight = ref(false)
  const coolingDown = ref(false)
  const manualUpdating = ref(false)

  let cooldownTimer: ReturnType<typeof setTimeout> | null = null

  const canManualRefresh = computed(() => !inFlight.value && !coolingDown.value)

  const refreshButtonLabel = computed(() =>
    manualUpdating.value ? '更新中...' : '更新',
  )

  function clearCooldownTimer() {
    if (cooldownTimer !== null) {
      clearTimeoutFn(cooldownTimer)
      cooldownTimer = null
    }
  }

  function beginCooldown() {
    coolingDown.value = true
    clearCooldownTimer()
    cooldownTimer = setTimeoutFn(() => {
      coolingDown.value = false
      cooldownTimer = null
    }, cooldownMs)
  }

  /**
   * @param fetcher return `true` when data was refreshed successfully
   * @returns whether a request ran (`skipped` if in-flight or manual cooldown)
   */
  async function runRefresh(
    source: ListRefreshSource,
    fetcher: () => Promise<boolean>,
  ): Promise<'ran' | 'skipped' | 'failed'> {
    if (inFlight.value) {
      return 'skipped'
    }
    if (source === 'manual' && coolingDown.value) {
      return 'skipped'
    }

    inFlight.value = true
    if (source === 'manual') {
      manualUpdating.value = true
    }

    try {
      const ok = await fetcher()
      if (source === 'manual') {
        beginCooldown()
      }
      return ok ? 'ran' : 'failed'
    } catch (caught) {
      if (source === 'manual') {
        beginCooldown()
      }
      throw caught
    } finally {
      inFlight.value = false
      if (source === 'manual') {
        manualUpdating.value = false
      }
    }
  }

  onUnmounted(() => {
    clearCooldownTimer()
  })

  return {
    inFlight,
    coolingDown,
    manualUpdating,
    canManualRefresh,
    refreshButtonLabel,
    runRefresh,
  }
}
