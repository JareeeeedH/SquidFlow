import { updateDriverLocation } from '../api/driver-location'
import type { OnlineStatus } from '../api/types'

export const GPS_UPDATE_INTERVAL_MS = 30_000

export type GpsCoordinates = {
  latitude: number
  longitude: number
}

export type DriverGpsTracker = {
  start: () => Promise<void>
  stop: () => void
  isRunning: () => boolean
}

export type DriverGpsDeps = {
  getCurrentPosition: () => Promise<GpsCoordinates>
  reportLocation: (coords: GpsCoordinates) => Promise<unknown>
  intervalMs?: number
  setIntervalFn?: typeof setInterval
  clearIntervalFn?: typeof clearInterval
}

export function createDriverGpsTracker(deps: DriverGpsDeps): DriverGpsTracker {
  const intervalMs = deps.intervalMs ?? GPS_UPDATE_INTERVAL_MS
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
    timer = setIntervalFn(() => {
      tickInFlight = tick().finally(() => {
        tickInFlight = null
      })
    }, intervalMs)
  }

  function stop() {
    running = false
    if (timer !== null) {
      clearIntervalFn(timer)
      timer = null
    }
  }

  return {
    start,
    stop,
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

export function syncDriverGpsWithOnlineStatus(status: OnlineStatus | null) {
  if (status === 'ONLINE') {
    void getActiveTracker().start()
  } else {
    getActiveTracker().stop()
  }
}

export function stopDriverGps() {
  if (activeTracker) {
    activeTracker.stop()
  }
}
