<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadGoogleMaps } from '../lib/google-maps-loader'

export type MapPoint = {
  lat: number
  lng: number
  label?: string
}

const props = defineProps<{
  pickup: MapPoint | null
  selfLocation?: MapPoint | null
  drivers?: MapPoint[]
}>()

const host = ref<null | object>(null)
const status = ref<'loading' | 'ready' | 'unavailable'>('loading')
const statusMessage = ref('地圖載入中…')

type MarkerLike = {
  setMap: (m: unknown) => void
  setPosition: (c: { lat: number; lng: number }) => void
}

type MapLike = {
  fitBounds: (bounds: unknown) => void
  setCenter: (c: { lat: number; lng: number }) => void
  setZoom: (z: number) => void
  getZoom: () => number | undefined
  panTo: (c: { lat: number; lng: number }) => void
}

type MapsApi = {
  Map: new (el: object, opts?: Record<string, unknown>) => MapLike
  Marker: new (opts: Record<string, unknown>) => MarkerLike
  LatLngBounds: new () => {
    extend: (c: { lat: number; lng: number }) => void
    isEmpty: () => boolean
  }
}

/** Soft cap so a single nearby pair does not over-zoom. */
const MAX_FIT_ZOOM = 15

let map: MapLike | null = null
let mapsApi: MapsApi | null = null
let pickupMarker: MarkerLike | null = null
let selfMarker: MarkerLike | null = null
let driverMarkers: MarkerLike[] = []
let mapReady = false

type MarkerKind = 'pickup' | 'self' | 'driver'

function markerStyle(kind: MarkerKind): {
  label: { text: string; color: string; fontWeight: string }
} {
  if (kind === 'pickup') {
    return { label: { text: '上', color: '#ffffff', fontWeight: '700' } }
  }
  if (kind === 'self') {
    return { label: { text: '我', color: '#ffffff', fontWeight: '700' } }
  }
  return { label: { text: '司', color: '#ffffff', fontWeight: '700' } }
}

function clearMarker(marker: MarkerLike | null) {
  if (marker) {
    marker.setMap(null)
  }
}

function clearAllMarkers() {
  clearMarker(pickupMarker)
  clearMarker(selfMarker)
  for (const marker of driverMarkers) {
    marker.setMap(null)
  }
  pickupMarker = null
  selfMarker = null
  driverMarkers = []
}

function createMarker(point: MapPoint, title: string, kind: MarkerKind): MarkerLike {
  const style = markerStyle(kind)
  return new mapsApi!.Marker({
    map,
    position: { lat: point.lat, lng: point.lng },
    title: point.label ?? title,
    label: style.label,
  })
}

function syncSelfMarker(point: MapPoint | null, options: { pan: boolean }) {
  if (!map || !mapsApi || !mapReady) {
    return
  }

  if (!point) {
    clearMarker(selfMarker)
    selfMarker = null
    return
  }

  const position = { lat: point.lat, lng: point.lng }
  if (selfMarker) {
    selfMarker.setPosition(position)
  } else {
    selfMarker = createMarker(point, '我的位置', 'self')
  }

  if (options.pan) {
    map.panTo(position)
  }
}

async function renderMap(options: { fitBounds: boolean }) {
  status.value = 'loading'
  statusMessage.value = '地圖載入中…'

  const google = await loadGoogleMaps()
  if (!google?.maps || !host.value) {
    status.value = 'unavailable'
    statusMessage.value = '地圖暫時無法顯示'
    mapReady = false
    return
  }

  mapsApi = google.maps as MapsApi

  await nextTick()
  if (!host.value) {
    return
  }

  if (!map) {
    map = new mapsApi.Map(host.value, {
      zoom: 13,
      center: { lat: 23.5, lng: 121 },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
  }

  clearAllMarkers()
  const bounds = new mapsApi.LatLngBounds()
  let hasPoint = false

  if (props.pickup) {
    pickupMarker = createMarker(props.pickup, '上車點', 'pickup')
    bounds.extend({ lat: props.pickup.lat, lng: props.pickup.lng })
    hasPoint = true
  }

  if (props.selfLocation) {
    selfMarker = createMarker(props.selfLocation, '我的位置', 'self')
    bounds.extend({
      lat: props.selfLocation.lat,
      lng: props.selfLocation.lng,
    })
    hasPoint = true
  }

  for (const driver of props.drivers ?? []) {
    const marker = createMarker(driver, driver.label ?? '司機', 'driver')
    driverMarkers.push(marker)
    bounds.extend({ lat: driver.lat, lng: driver.lng })
    hasPoint = true
  }

  if (!hasPoint || bounds.isEmpty()) {
    status.value = 'unavailable'
    statusMessage.value = '尚無可用座標'
    mapReady = false
    return
  }

  if (options.fitBounds) {
    map.fitBounds(bounds)
    const zoom = map.getZoom()
    if (typeof zoom === 'number' && zoom > MAX_FIT_ZOOM) {
      map.setZoom(MAX_FIT_ZOOM)
    }
  }

  mapReady = true
  status.value = 'ready'
}

onMounted(() => {
  void renderMap({ fitBounds: true }).catch(() => {
    status.value = 'unavailable'
    statusMessage.value = '地圖暫時無法顯示'
    mapReady = false
  })
})

watch(
  () => [props.pickup, props.drivers] as const,
  () => {
    void renderMap({ fitBounds: true }).catch(() => {
      status.value = 'unavailable'
      statusMessage.value = '地圖暫時無法顯示'
      mapReady = false
    })
  },
  { deep: true },
)

watch(
  () => props.selfLocation,
  (next, prev) => {
    const prevKey = prev ? `${prev.lat},${prev.lng}` : ''
    const nextKey = next ? `${next.lat},${next.lng}` : ''
    if (prevKey === nextKey) {
      return
    }

    // Map not ready yet (e.g. previously no points): full render with bounds.
    if (!mapReady) {
      void renderMap({ fitBounds: true }).catch(() => {
        status.value = 'unavailable'
        statusMessage.value = '地圖暫時無法顯示'
        mapReady = false
      })
      return
    }

    // Self-only updates: move marker + pan, never re-fitBounds.
    syncSelfMarker(next ?? null, { pan: Boolean(next) })
  },
  { deep: true },
)

onBeforeUnmount(() => {
  clearAllMarkers()
  map = null
  mapsApi = null
  mapReady = false
})
</script>

<template>
  <div class="order-map">
    <div ref="host" class="canvas" aria-label="訂單地圖" />
    <p v-if="status !== 'ready'" class="overlay">{{ statusMessage }}</p>
  </div>
</template>

<style scoped>
.order-map {
  position: relative;
  width: 100%;
  height: 220px;
  border-radius: var(--radius-12);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted, #f3f5f8);
}

.canvas {
  width: 100%;
  height: 100%;
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  padding: var(--space-12);
  text-align: center;
  color: var(--color-text-secondary);
  background: rgb(255 255 255 / 82%);
  font-size: 0.9rem;
}
</style>
