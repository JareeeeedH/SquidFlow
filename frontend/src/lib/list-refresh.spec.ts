import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import {
  MANUAL_REFRESH_COOLDOWN_MS,
  useListRefreshControl,
} from './list-refresh'

function mountControl(options?: Parameters<typeof useListRefreshControl>[0]) {
  let api!: ReturnType<typeof useListRefreshControl>
  const Host = defineComponent({
    setup() {
      api = useListRefreshControl(options)
      return () => null
    },
  })
  const wrapper = mount(Host)
  return { api, wrapper }
}

describe('useListRefreshControl', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs manual refresh with updating label and cooldown', async () => {
    vi.useFakeTimers()
    const { api, wrapper } = mountControl()

    let release!: (value: boolean) => void
    const fetcher = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        }),
    )
    expect(api.canManualRefresh.value).toBe(true)
    expect(api.refreshButtonLabel.value).toBe('更新')

    const pending = api.runRefresh('manual', fetcher)
    await nextTick()
    expect(api.manualUpdating.value).toBe(true)
    expect(api.refreshButtonLabel.value).toBe('更新中...')
    expect(api.canManualRefresh.value).toBe(false)

    release(true)
    await pending
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(api.manualUpdating.value).toBe(false)
    expect(api.refreshButtonLabel.value).toBe('更新')
    expect(api.coolingDown.value).toBe(true)
    expect(api.canManualRefresh.value).toBe(false)

    expect(await api.runRefresh('manual', fetcher)).toBe('skipped')
    expect(fetcher).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(MANUAL_REFRESH_COOLDOWN_MS)
    expect(api.coolingDown.value).toBe(false)
    expect(api.canManualRefresh.value).toBe(true)

    wrapper.unmount()
  })

  it('skips auto refresh while a request is in flight', async () => {
    const { api, wrapper } = mountControl()
    let release!: (value: boolean) => void
    const blocker = new Promise<boolean>((resolve) => {
      release = resolve
    })

    const first = api.runRefresh('manual', () => blocker)
    await nextTick()
    expect(await api.runRefresh('auto', async () => true)).toBe('skipped')

    release(true)
    await first
    expect(await api.runRefresh('auto', async () => true)).toBe('ran')

    wrapper.unmount()
  })

  it('lets auto refresh run during manual cooldown', async () => {
    vi.useFakeTimers()
    const { api, wrapper } = mountControl()

    await api.runRefresh('manual', async () => true)
    expect(api.coolingDown.value).toBe(true)

    const autoFetcher = vi.fn().mockResolvedValue(true)
    expect(await api.runRefresh('auto', autoFetcher)).toBe('ran')
    expect(autoFetcher).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('does not leave manualUpdating stuck on failure', async () => {
    const { api, wrapper } = mountControl()
    expect(await api.runRefresh('auto', async () => false)).toBe('failed')
    expect(api.manualUpdating.value).toBe(false)
    wrapper.unmount()
  })
})
