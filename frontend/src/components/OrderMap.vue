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

type MarkerLike = { setMap: (m: unknown) => void }
type MapLike = {
  fitBounds: (bounds: unknown) => void
  setCenter: (c: { lat: number; lng: number }) => void
  setZoom: (z: number) => void
  getZoom: () => number | undefined
}

/** Soft cap so a single nearby pair does not over-zoom. */
const MAX_FIT_ZOOM = 15

let map: MapLike | null = null
let markers: MarkerLike[] = []

function clearMarkers() {
  for (const marker of markers) {
    marker.setMap(null)
  }
  markers = []
}

type MarkerKind = 'pickup' | 'self' | 'driver'

function markerStyle(kind: MarkerKind): {
  label: { text: string; color: string; fontWeight: string }
  // Google Maps accepts CSS color strings for default pins via label + title.
} {
  if (kind === 'pickup') {
    return { label: { text: '上', color: '#ffffff', fontWeight: '700' } }
  }
  if (kind === 'self') {
    return { label: { text: '我', color: '#ffffff', fontWeight: '700' } }
  }
  return { label: { text: '司', color: '#ffffff', fontWeight: '700' } }
}

async function renderMap() {
  status.value = 'loading'
  statusMessage.value = '地圖載入中…'

  const google = await loadGoogleMaps()
  if (!google?.maps || !host.value) {
    status.value = 'unavailable'
    statusMessage.value = '地圖暫時無法顯示'
    return
  }

  const mapsApi = google.maps

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

  clearMarkers()
  const bounds = new mapsApi.LatLngBounds()
  let hasPoint = false

  function addMarker(point: MapPoint, title: string, kind: MarkerKind) {
    const style = markerStyle(kind)
    const marker = new mapsApi.Marker({
      map,
      position: { lat: point.lat, lng: point.lng },
      title: point.label ?? title,
      label: style.label,
    })
    markers.push(marker)
    bounds.extend({ lat: point.lat, lng: point.lng })
    hasPoint = true
  }

  if (props.pickup) {
    addMarker(props.pickup, '上車點', 'pickup')
  }
  if (props.selfLocation) {
    addMarker(props.selfLocation, '我的位置', 'self')
  }
  for (const driver of props.drivers ?? []) {
    addMarker(driver, driver.label ?? '司機', 'driver')
  }

  if (!hasPoint) {
    status.value = 'unavailable'
    statusMessage.value = '尚無可用座標'
    return
  }

  if (bounds.isEmpty()) {
    status.value = 'unavailable'
    statusMessage.value = '尚無可用座標'
    return
  }

  map.fitBounds(bounds)
  // Cap zoom after fit for a reasonable visible range (no pixel Spec).
  const zoom = map.getZoom()
  if (typeof zoom === 'number' && zoom > MAX_FIT_ZOOM) {
    map.setZoom(MAX_FIT_ZOOM)
  }
  status.value = 'ready'
}

onMounted(() => {
  void renderMap().catch(() => {
    status.value = 'unavailable'
    statusMessage.value = '地圖暫時無法顯示'
  })
})

watch(
  () => [props.pickup, props.selfLocation, props.drivers] as const,
  () => {
    void renderMap().catch(() => {
      status.value = 'unavailable'
      statusMessage.value = '地圖暫時無法顯示'
    })
  },
  { deep: true },
)

onBeforeUnmount(() => {
  clearMarkers()
  map = null
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
