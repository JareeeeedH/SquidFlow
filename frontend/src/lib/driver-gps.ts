import { updateDriverLocation } from '../api/driver-location'
import type { OnlineStatus } from '../api/types'

export const GPS_ONLINE_INTERVAL_MS = 30_000
export const GPS_IN_PROGRESS_INTERVAL_MS = 10_000

export type GpsCoordinates = {
  latitude: number
  longitude: number
}

export type DriverGpsTracker = {
  start: () => Promise<void>
  stop: () => void
  setIntervalMs: (intervalMs: number) => void
  isRunning: () => boolean
}

export type DriverGpsDeps = {
  getCurrentPosition: () => Promise<GpsCoordinates>
  reportLocation: (coords: GpsCoordinates) => Promise<unknown>
  intervalMs?: number
  setIntervalFn?: typeof setInterval
  clearIntervalFn?: typeof clearInterval
}

export function resolveDriverGpsIntervalMs(inProgress: boolean): number {
  return inProgress ? GPS_IN_PROGRESS_INTERVAL_MS : GPS_ONLINE_INTERVAL_MS
}

export function createDriverGpsTracker(deps: DriverGpsDeps): DriverGpsTracker {
  let intervalMs = deps.intervalMs ?? GPS_ONLINE_INTERVAL_MS
  const setIntervalFn = deps.setIntervalFn ?? setInterval
  const clearIntervalFn = deps.clearIntervalFn ?? clearInterval

  let running = false
  let timer: ReturnType<typeof setInterval> | null = null
  let tickInFlight: Promise<void> | null = null

  async function tick() {
    if (!running) {
      return
    }

    try {
      const coords = await deps.getCurrentPosition()
      if (!running) {
        return
      }
      await deps.reportLocation(coords)
    } catch {
      // GPS or API failure: keep last valid location; retry next cycle.
      // Must not affect ONLINE / OFFLINE status.
    }
  }

  function clearTimer() {
    if (timer !== null) {
      clearIntervalFn(timer)
      timer = null
    }
  }

  function scheduleTimer() {
    clearTimer()
    if (!running) {
      return
    }
    timer = setIntervalFn(() => {
      tickInFlight = tick().finally(() => {
        tickInFlight = null
      })
    }, intervalMs)
  }

  async function start() {
    if (running) {
      return
    }
    running = true
    tickInFlight = tick()
    await tickInFlight
    tickInFlight = null
    if (!running) {
      return
    }
    scheduleTimer()
  }

  function stop() {
    running = false
    clearTimer()
  }

  function setIntervalMs(nextIntervalMs: number) {
    if (nextIntervalMs === intervalMs) {
      return
    }
    intervalMs = nextIntervalMs
    if (running) {
      // Reschedule next ticks only; do not interrupt an in-flight tick.
      scheduleTimer()
    }
  }

  return {
    start,
    stop,
    setIntervalMs,
    isRunning: () => running,
  }
}

function browserGetCurrentPosition(): Promise<GpsCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GEOLOCATION_UNAVAILABLE'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15_000,
      },
    )
  })
}

let activeTracker: DriverGpsTracker | null = null

/** Test-only override: `null` uses `import.meta.env.DEV`. */
let browserGpsAutoReportOverrideForTests: boolean | null = null

/**
 * Real browser GPS auto-report is disabled in Vite DEV so Local can rely on
 * the DEV GPS Simulator without fighting navigator.geolocation.
 * Production keeps the existing ONLINE 30s / IN_PROGRESS 10s tracker.
 */
export function isBrowserGpsAutoReportEnabled(): boolean {
  if (browserGpsAutoReportOverrideForTests !== null) {
    return browserGpsAutoReportOverrideForTests
  }
  return import.meta.env.DEV !== true
}

function getActiveTracker(): DriverGpsTracker {
  if (!activeTracker) {
    activeTracker = createDriverGpsTracker({
      getCurrentPosition: browserGetCurrentPosition,
      reportLocation: (coords) =>
        updateDriverLocation(coords.latitude, coords.longitude),
    })
  }
  return activeTracker
}

/** Test helper: replace or clear the module-level tracker. */
export function setActiveDriverGpsTrackerForTests(
  tracker: DriverGpsTracker | null,
) {
  activeTracker = tracker
}

/** Test helper: force real GPS on/off regardless of `import.meta.env.DEV`. */
export function setBrowserGpsAutoReportEnabledForTests(
  enabled: boolean | null,
) {
  browserGpsAutoReportOverrideForTests = enabled
}

export function syncDriverGps(options: {
  onlineStatus: OnlineStatus | null
  inProgress: boolean
}) {
  // DEV / Local: do not create or run the real browser GPS tracker.
  // DEV GPS Simulator still calls updateDriverLocation() directly.
  if (!isBrowserGpsAutoReportEnabled()) {
    stopDriverGps()
    return
  }

  const tracker = getActiveTracker()
  if (options.onlineStatus === 'ONLINE') {
    tracker.setIntervalMs(resolveDriverGpsIntervalMs(options.inProgress))
    void tracker.start()
    return
  }
  tracker.stop()
}

export function stopDriverGps() {
  if (activeTracker) {
    activeTracker.stop()
  }
}
