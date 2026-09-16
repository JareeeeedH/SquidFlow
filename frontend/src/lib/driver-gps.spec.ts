import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDriverGpsTracker,
  GPS_UPDATE_INTERVAL_MS,
} from './driver-gps'

describe('createDriverGpsTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('requests the first location immediately on start', async () => {
    const getCurrentPosition = vi.fn().mockResolvedValue({
      latitude: 22.6,
      longitude: 120.3,
    })
    const reportLocation = vi.fn().mockResolvedValue(undefined)
    const tracker = createDriverGpsTracker({
      getCurrentPosition,
      reportLocation,
    })

    await tracker.start()

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(reportLocation).toHaveBeenCalledWith({
      latitude: 22.6,
      longitude: 120.3,
    })
    expect(tracker.isRunning()).toBe(true)
  })

  it('continues updating every 30 seconds while running', async () => {
    const getCurrentPosition = vi.fn().mockResolvedValue({
      latitude: 22.6,
      longitude: 120.3,
    })
    const reportLocation = vi.fn().mockResolvedValue(undefined)
    const tracker = createDriverGpsTracker({
      getCurrentPosition,
      reportLocation,
    })

    await tracker.start()
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(GPS_UPDATE_INTERVAL_MS)
    expect(getCurrentPosition).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(GPS_UPDATE_INTERVAL_MS)
    expect(getCurrentPosition).toHaveBeenCalledTimes(3)
  })

  it('stops updates after stop()', async () => {
    const getCurrentPosition = vi.fn().mockResolvedValue({
      latitude: 22.6,
      longitude: 120.3,
    })
    const reportLocation = vi.fn().mockResolvedValue(undefined)
    const tracker = createDriverGpsTracker({
      getCurrentPosition,
      reportLocation,
    })

    await tracker.start()
    tracker.stop()
    expect(tracker.isRunning()).toBe(false)

    await vi.advanceTimersByTimeAsync(GPS_UPDATE_INTERVAL_MS * 2)
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(reportLocation).toHaveBeenCalledTimes(1)
  })

  it('does not throw when GPS fails and retries on the next cycle', async () => {
    const getCurrentPosition = vi
      .fn()
      .mockRejectedValueOnce(new Error('PERMISSION_DENIED'))
      .mockResolvedValue({ latitude: 22.7, longitude: 120.4 })
    const reportLocation = vi.fn().mockResolvedValue(undefined)
    const tracker = createDriverGpsTracker({
      getCurrentPosition,
      reportLocation,
    })

    await expect(tracker.start()).resolves.toBeUndefined()
    expect(reportLocation).not.toHaveBeenCalled()
    expect(tracker.isRunning()).toBe(true)

    await vi.advanceTimersByTimeAsync(GPS_UPDATE_INTERVAL_MS)
    expect(reportLocation).toHaveBeenCalledWith({
      latitude: 22.7,
      longitude: 120.4,
    })
  })

  it('does not throw when the location API fails and retries next cycle', async () => {
    const getCurrentPosition = vi.fn().mockResolvedValue({
      latitude: 22.6,
      longitude: 120.3,
    })
    const reportLocation = vi
      .fn()
      .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
      .mockResolvedValue(undefined)
    const tracker = createDriverGpsTracker({
      getCurrentPosition,
      reportLocation,
    })

    await expect(tracker.start()).resolves.toBeUndefined()
    expect(tracker.isRunning()).toBe(true)

    await vi.advanceTimersByTimeAsync(GPS_UPDATE_INTERVAL_MS)
    expect(reportLocation).toHaveBeenCalledTimes(2)
  })

  it('does not start a second interval when already running', async () => {
    const getCurrentPosition = vi.fn().mockResolvedValue({
      latitude: 22.6,
      longitude: 120.3,
    })
    const reportLocation = vi.fn().mockResolvedValue(undefined)
    const tracker = createDriverGpsTracker({
      getCurrentPosition,
      reportLocation,
    })

    await tracker.start()
    await tracker.start()

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(GPS_UPDATE_INTERVAL_MS)
    expect(getCurrentPosition).toHaveBeenCalledTimes(2)
  })
})
