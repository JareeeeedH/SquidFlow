import { onMounted, onUnmounted } from 'vue'
import { ADMIN_LIST_POLL_INTERVAL_MS } from './list-refresh'

export { ADMIN_LIST_POLL_INTERVAL_MS }

export type VisiblePollingReason = 'immediate' | 'interval' | 'visible'

export type VisiblePollingOptions = {
  intervalMs?: number
  documentRef?: Pick<Document, 'visibilityState' | 'hidden' | 'addEventListener' | 'removeEventListener'>
  setIntervalFn?: typeof setInterval
  clearIntervalFn?: typeof clearInterval
}

/**
 * Polls while the document is visible and the component is mounted.
 * Runs once immediately on start (and again when the tab becomes visible).
 */
export function useVisiblePolling(
  tick: (reason: VisiblePollingReason) => void | Promise<void>,
  options: VisiblePollingOptions = {},
) {
  const intervalMs = options.intervalMs ?? ADMIN_LIST_POLL_INTERVAL_MS
  const setIntervalFn = options.setIntervalFn ?? setInterval
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval

  let timer: ReturnType<typeof setInterval> | null = null
  let stopped = true

  function clearTimer() {
    if (timer !== null) {
      clearIntervalFn(timer)
      timer = null
    }
  }

  function run(reason: VisiblePollingReason) {
    void tick(reason)
  }

  function start(reason: VisiblePollingReason) {
    stopped = false
    clearTimer()
    run(reason)
    timer = setIntervalFn(() => {
      if (!stopped) {
        run('interval')
      }
    }, intervalMs)
  }

  function stop() {
    stopped = true
    clearTimer()
  }

  function onVisibilityChange() {
    const doc = options.documentRef ?? (typeof document !== 'undefined' ? document : null)
    if (!doc) {
      return
    }
    if (doc.hidden || doc.visibilityState === 'hidden') {
      stop()
      return
    }
    start('visible')
  }

  onMounted(() => {
    const doc = options.documentRef ?? (typeof document !== 'undefined' ? document : null)
    if (!doc || doc.hidden || doc.visibilityState === 'hidden') {
      if (doc) {
        doc.addEventListener('visibilitychange', onVisibilityChange)
      }
      return
    }
    start('immediate')
    doc.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    const doc = options.documentRef ?? (typeof document !== 'undefined' ? document : null)
    stop()
    doc?.removeEventListener('visibilitychange', onVisibilityChange)
  })
}
