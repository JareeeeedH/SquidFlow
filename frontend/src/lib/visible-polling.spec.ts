import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ADMIN_LIST_POLL_INTERVAL_MS,
  useVisiblePolling,
  type VisiblePollingReason,
} from './visible-polling'

type FakeDocument = {
  visibilityState: DocumentVisibilityState
  hidden: boolean
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

function createFakeDocument(
  initial: DocumentVisibilityState = 'visible',
): FakeDocument & { emit: (state: DocumentVisibilityState) => void } {
  let visibilityState = initial
  const listeners = new Set<() => void>()

  return {
    get visibilityState() {
      return visibilityState
    },
    get hidden() {
      return visibilityState === 'hidden'
    },
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener)
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener)
    },
    emit(state: DocumentVisibilityState) {
      visibilityState = state
      for (const listener of listeners) {
        listener()
      }
    },
  }
}

function mountPolling(
  tick: (reason: VisiblePollingReason) => void,
  options: Parameters<typeof useVisiblePolling>[1],
) {
  const Host = defineComponent({
    setup() {
      useVisiblePolling(tick, options)
      return () => null
    },
  })
  return mount(Host)
}

describe('useVisiblePolling', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs immediately then on interval while visible', async () => {
    vi.useFakeTimers()
    const tick = vi.fn()
    const doc = createFakeDocument('visible')
    const setIntervalFn = vi.fn((handler: TimerHandler, ms?: number) =>
      setInterval(handler, ms),
    )

    const wrapper = mountPolling(tick, {
      documentRef: doc,
      intervalMs: ADMIN_LIST_POLL_INTERVAL_MS,
      setIntervalFn: setIntervalFn as typeof setInterval,
      clearIntervalFn: clearInterval,
    })

    await flushPromises()
    expect(tick).toHaveBeenCalledTimes(1)
    expect(tick).toHaveBeenLastCalledWith('immediate')
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 30_000)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(tick).toHaveBeenCalledTimes(2)
    expect(tick).toHaveBeenLastCalledWith('interval')

    wrapper.unmount()
  })

  it('stops when hidden and refreshes immediately when visible again', async () => {
    vi.useFakeTimers()
    const tick = vi.fn()
    const doc = createFakeDocument('visible')
    const clearIntervalFn = vi.fn(clearInterval)

    const wrapper = mountPolling(tick, {
      documentRef: doc,
      intervalMs: 30_000,
      setIntervalFn: setInterval,
      clearIntervalFn: clearIntervalFn as typeof clearInterval,
    })

    await flushPromises()
    expect(tick).toHaveBeenCalledWith('immediate')

    doc.emit('hidden')
    await nextTick()
    expect(clearIntervalFn).toHaveBeenCalled()

    const callsBefore = tick.mock.calls.length
    await vi.advanceTimersByTimeAsync(90_000)
    expect(tick).toHaveBeenCalledTimes(callsBefore)

    doc.emit('visible')
    await flushPromises()
    expect(tick).toHaveBeenLastCalledWith('visible')

    await vi.advanceTimersByTimeAsync(30_000)
    expect(tick).toHaveBeenLastCalledWith('interval')

    wrapper.unmount()
  })

  it('does not start while document starts hidden', async () => {
    vi.useFakeTimers()
    const tick = vi.fn()
    const doc = createFakeDocument('hidden')

    const wrapper = mountPolling(tick, {
      documentRef: doc,
      intervalMs: 30_000,
    })

    await flushPromises()
    expect(tick).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(tick).not.toHaveBeenCalled()

    doc.emit('visible')
    await flushPromises()
    expect(tick).toHaveBeenCalledWith('visible')

    wrapper.unmount()
  })

  it('stops on unmount', async () => {
    vi.useFakeTimers()
    const tick = vi.fn()
    const doc = createFakeDocument('visible')
    const clearIntervalFn = vi.fn(clearInterval)

    const wrapper = mountPolling(tick, {
      documentRef: doc,
      intervalMs: 30_000,
      clearIntervalFn: clearIntervalFn as typeof clearInterval,
    })

    await flushPromises()
    wrapper.unmount()
    expect(clearIntervalFn).toHaveBeenCalled()

    const calls = tick.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(tick).toHaveBeenCalledTimes(calls)
  })
})
