import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FIT_BOUNDS_PADDING,
  MAX_FIT_ZOOM,
  SINGLE_POINT_ZOOM,
} from '../lib/order-map-viewport'
import OrderMap from './OrderMap.vue'

const fitBounds = vi.fn()
const panTo = vi.fn()
const setZoom = vi.fn()
const getZoom = vi.fn(() => 14)
const setCenter = vi.fn()

type MarkerMock = {
  setMap: ReturnType<typeof vi.fn>
  setPosition: ReturnType<typeof vi.fn>
  opts: Record<string, unknown>
}

const markerInstances: MarkerMock[] = []
const MapCtor = vi.fn()
const MarkerCtor = vi.fn()

vi.mock('../lib/google-maps-loader', () => ({
  loadGoogleMaps: vi.fn(async () => ({
    maps: {
      Map: MapCtor,
      Marker: MarkerCtor,
      LatLngBounds: vi.fn().mockImplementation(() => {
        let empty = true
        return {
          extend: () => {
            empty = false
          },
          isEmpty: () => empty,
        }
      }),
    },
  })),
}))

describe('OrderMap', () => {
  beforeEach(() => {
    fitBounds.mockClear()
    panTo.mockClear()
    setZoom.mockClear()
    getZoom.mockClear()
    setCenter.mockClear()
    MapCtor.mockReset()
    MarkerCtor.mockReset()
    markerInstances.length = 0
    getZoom.mockReturnValue(14)

    MapCtor.mockImplementation(() => ({
      fitBounds,
      setCenter,
      setZoom,
      getZoom,
      panTo,
    }))
    MarkerCtor.mockImplementation((opts: Record<string, unknown>) => {
      const marker: MarkerMock = {
        setMap: vi.fn(),
        setPosition: vi.fn(),
        opts,
      }
      markerInstances.push(marker)
      return marker
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('fitBounds self+pickup with padding and caps zoom', async () => {
    getZoom.mockReturnValue(18)
    mount(OrderMap, {
      props: {
        pickup: { lat: 22.6, lng: 120.3, label: '上車點' },
        selfLocation: { lat: 22.61, lng: 120.31, label: '我的位置' },
      },
    })
    await flushPromises()

    expect(fitBounds).toHaveBeenCalledTimes(1)
    expect(fitBounds).toHaveBeenCalledWith(expect.anything(), FIT_BOUNDS_PADDING)
    expect(setZoom).toHaveBeenCalledWith(MAX_FIT_ZOOM)
    expect(MAX_FIT_ZOOM).toBe(13)
  })

  it('uses fixed zoom for a single marker (no fitBounds over-zoom)', async () => {
    mount(OrderMap, {
      props: {
        pickup: { lat: 22.6, lng: 120.3, label: '上車點' },
        selfLocation: null,
      },
    })
    await flushPromises()

    expect(fitBounds).not.toHaveBeenCalled()
    expect(setCenter).toHaveBeenCalledWith({ lat: 22.6, lng: 120.3 })
    expect(setZoom).toHaveBeenCalledWith(SINGLE_POINT_ZOOM)
    expect(SINGLE_POINT_ZOOM).toBe(12)
  })

  it('fitBounds on initial render, then moves self marker with panTo (no re-fitBounds)', async () => {
    const wrapper = mount(OrderMap, {
      props: {
        pickup: { lat: 22.6, lng: 120.3, label: '上車點' },
        selfLocation: { lat: 22.61, lng: 120.31, label: '我的位置' },
      },
    })
    await flushPromises()

    expect(MapCtor).toHaveBeenCalledTimes(1)
    expect(fitBounds).toHaveBeenCalledTimes(1)
    expect(MarkerCtor).toHaveBeenCalledTimes(2)
    expect(panTo).not.toHaveBeenCalled()

    const selfMarker = markerInstances.find(
      (m) => (m.opts.label as { text?: string } | undefined)?.text === '我',
    )
    expect(selfMarker).toBeTruthy()

    await wrapper.setProps({
      selfLocation: { lat: 22.62, lng: 120.32, label: '我的位置' },
    })
    await flushPromises()

    expect(fitBounds).toHaveBeenCalledTimes(1)
    expect(MapCtor).toHaveBeenCalledTimes(1)
    expect(selfMarker!.setPosition).toHaveBeenCalledWith({
      lat: 22.62,
      lng: 120.32,
    })
    expect(panTo).toHaveBeenCalledTimes(1)
    expect(panTo).toHaveBeenCalledWith({ lat: 22.62, lng: 120.32 })
    // No new markers for self-only update
    expect(MarkerCtor).toHaveBeenCalledTimes(2)
  })

  it('re-fitBounds when pickup changes', async () => {
    const wrapper = mount(OrderMap, {
      props: {
        pickup: { lat: 22.6, lng: 120.3, label: '上車點' },
        selfLocation: { lat: 22.61, lng: 120.31, label: '我的位置' },
      },
    })
    await flushPromises()
    expect(fitBounds).toHaveBeenCalledTimes(1)

    await wrapper.setProps({
      pickup: { lat: 22.7, lng: 120.4, label: '上車點' },
    })
    await flushPromises()

    expect(fitBounds).toHaveBeenCalledTimes(2)
  })

  it('pans to latest selfLocation on successive updates', async () => {
    const wrapper = mount(OrderMap, {
      props: {
        pickup: { lat: 22.6, lng: 120.3 },
        selfLocation: { lat: 22.1, lng: 120.1, label: '我的位置' },
      },
    })
    await flushPromises()

    await wrapper.setProps({
      selfLocation: { lat: 22.2, lng: 120.2, label: '我的位置' },
    })
    await flushPromises()
    await wrapper.setProps({
      selfLocation: { lat: 22.3, lng: 120.3, label: '我的位置' },
    })
    await flushPromises()

    expect(fitBounds).toHaveBeenCalledTimes(1)
    expect(panTo).toHaveBeenNthCalledWith(1, { lat: 22.2, lng: 120.2 })
    expect(panTo).toHaveBeenNthCalledWith(2, { lat: 22.3, lng: 120.3 })
  })
})
