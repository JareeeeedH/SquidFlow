<script setup lang="ts">
/* eslint-disable no-undef -- DEV GPS sequencer uses browser timers */
import { ArrowLeft, RotateCcw } from 'lucide-vue-next'
import {
  NButton,
  NInput,
  NModal,
  NResult,
  NSpin,
} from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  acceptDriverOrder,
  completeDriverOrder,
  getDriverOrder,
  startDriverOrder,
} from '../api/driver-orders'
import { getDriverLocation, updateDriverLocation } from '../api/driver-location'
import { ApiClientError } from '../api/types'
import type { DriverOrderDetail } from '../api/types'
import OrderMap from '../components/OrderMap.vue'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import SlideToConfirm from '../components/SlideToConfirm.vue'
import { formatStraightLineDistance, formatTripDistanceKm } from '../lib/format-distance'
import { formatOptionalText, formatPrice, formatScheduledAt } from '../lib/format'
import { openGoogleMapsNavigation } from '../lib/google-maps-nav'
import {
  collectValidGpsPoints,
  computeSendIntervalMs,
  parseDurationMinutes,
  type GpsPoint,
} from '../lib/dev-gps-sequence'
import { useDriverStatusStore } from '../stores/driver-status'

const isDev = import.meta.env.DEV

const route = useRoute()
const router = useRouter()
const driverStatus = useDriverStatusStore()
const order = ref<DriverOrderDetail | null>(null)
const driverLat = ref<number | null>(null)
const driverLng = ref<number | null>(null)
const loading = ref(false)
const accepting = ref(false)
const starting = ref(false)
const completing = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const actionError = ref<{ code: string; message: string } | null>(null)
const successMessage = ref<string | null>(null)
const navHint = ref<string | null>(null)
const notFound = ref(false)
const forbidden = ref(false)

type DevGpsStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'stopped'
  | 'failed'

const DEFAULT_DEV_GPS_ROWS = [
  '22.619396, 120.321416',
  '',
  '',
  '',
  '',
]

const showDevGpsModal = ref(false)
const devGpsDurationMinutes = ref('5')
const devGpsRows = ref<string[]>([...DEFAULT_DEV_GPS_ROWS])
const devGpsStatus = ref<DevGpsStatus>('idle')
const devGpsError = ref<string | null>(null)
const devGpsMessage = ref<string | null>(null)
const devGpsQueue = ref<GpsPoint[]>([])
const devGpsNextIndex = ref(0)
const devGpsSentCount = ref(0)
const devGpsIntervalMs = ref(0)
const devGpsBusy = ref(false)

let devGpsTimer: ReturnType<typeof setTimeout> | null = null

const devGpsStatusLabel = computed(() => {
  switch (devGpsStatus.value) {
    case 'running':
      return '發送中'
    case 'paused':
      return '已暫停'
    case 'completed':
      return '已完成'
    case 'stopped':
      return '已停止'
    case 'failed':
      return '發送失敗'
    default:
      return '尚未開始'
  }
})

const devGpsProgressLabel = computed(() => {
  const total = devGpsQueue.value.length
  if (total === 0) {
    return null
  }
  return `發送中：${devGpsSentCount.value} / ${total}`
})

const canStartDevGps = computed(
  () =>
    !devGpsBusy.value &&
    (devGpsStatus.value === 'idle' ||
      devGpsStatus.value === 'completed' ||
      devGpsStatus.value === 'stopped' ||
      devGpsStatus.value === 'failed'),
)

const canPauseDevGps = computed(
  () => !devGpsBusy.value && devGpsStatus.value === 'running',
)

const canResumeDevGps = computed(
  () =>
    !devGpsBusy.value &&
    (devGpsStatus.value === 'paused' ||
      (devGpsStatus.value === 'failed' &&
        devGpsNextIndex.value < devGpsQueue.value.length)),
)

const canStopDevGps = computed(
  () =>
    !devGpsBusy.value &&
    (devGpsStatus.value === 'running' ||
      devGpsStatus.value === 'paused' ||
      (devGpsStatus.value === 'failed' &&
        devGpsNextIndex.value < devGpsQueue.value.length)),
)

let requestSeq = 0

function captureError(caught: unknown) {
  if (caught instanceof ApiClientError) {
    return { code: caught.code, message: caught.message }
  }
  return { code: 'INTERNAL_ERROR', message: '系統發生錯誤' }
}

async function loadOrder() {
  const id = String(route.params.id ?? '')
  const seq = ++requestSeq
  loading.value = true
  error.value = null
  notFound.value = false
  forbidden.value = false
  navHint.value = null

  try {
    const data = await getDriverOrder(id)
    if (seq !== requestSeq) {
      return
    }
    order.value = data
    driverStatus.syncInProgressFromOrderStatus(data.status)
    try {
      const location = await getDriverLocation()
      if (seq === requestSeq) {
        driverLat.value = location.latitude
        driverLng.value = location.longitude
      }
    } catch {
      if (seq === requestSeq) {
        driverLat.value = null
        driverLng.value = null
      }
    }
  } catch (caught) {
    if (seq !== requestSeq) {
      return
    }
    order.value = null
    if (caught instanceof ApiClientError) {
      if (caught.status === 404 && caught.code === 'NOT_FOUND') {
        notFound.value = true
      } else if (caught.status === 403 && caught.code === 'FORBIDDEN') {
        forbidden.value = true
      }
      error.value = { code: caught.code, message: caught.message }
      return
    }
    error.value = { code: 'INTERNAL_ERROR', message: '系統發生錯誤' }
  } finally {
    if (seq === requestSeq) {
      loading.value = false
    }
  }
}

const acting = computed(
  () => accepting.value || starting.value || completing.value,
)

const backTarget = computed(() =>
  order.value?.status === 'OPEN'
    ? { name: 'driver-open-orders' as const, label: '返回' }
    : { name: 'driver-my-orders' as const, label: '返回' },
)

const hasPrimaryAction = computed(
  () =>
    order.value?.status === 'OPEN' ||
    order.value?.status === 'ACCEPTED' ||
    order.value?.status === 'IN_PROGRESS',
)

const distanceLabel = computed(() => {
  const status = order.value?.status
  // Driver Order Detail: straight-line distance only before trip start.
  if (status !== 'OPEN' && status !== 'ACCEPTED') {
    return null
  }
  return formatStraightLineDistance(order.value?.distance_meters)
})

const tripDistanceKm = computed(() =>
  formatTripDistanceKm(order.value?.trip_distance_meters),
)

const inProgressMileage = computed(() => {
  if (order.value?.status !== 'IN_PROGRESS' || !tripDistanceKm.value) {
    return null
  }
  return `已行駛 ${tripDistanceKm.value}`
})

const completedMileage = computed(() => {
  if (order.value?.status !== 'COMPLETED' || !tripDistanceKm.value) {
    return null
  }
  return tripDistanceKm.value
})

const priceLabel = computed(() =>
  order.value?.status === 'COMPLETED' ? '車資' : '價格',
)

const pickupPoint = computed(() => {
  const lat = order.value?.pickup_latitude
  const lng = order.value?.pickup_longitude
  if (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    typeof lng === 'number' &&
    Number.isFinite(lng)
  ) {
    return { lat, lng, label: '上車點' }
  }
  return null
})

const selfPoint = computed(() => {
  if (
    typeof driverLat.value === 'number' &&
    Number.isFinite(driverLat.value) &&
    typeof driverLng.value === 'number' &&
    Number.isFinite(driverLng.value)
  ) {
    return { lat: driverLat.value, lng: driverLng.value, label: '我的位置' }
  }
  return null
})

const canNavigate = computed(
  () =>
    order.value?.status === 'ACCEPTED' || order.value?.status === 'IN_PROGRESS',
)

function startNavigation() {
  if (!order.value || !canNavigate.value) {
    return
  }
  navHint.value = null
  const ok = openGoogleMapsNavigation({
    latitude: order.value.pickup_latitude,
    longitude: order.value.pickup_longitude,
    address: order.value.pickup_location,
  })
  if (!ok) {
    navHint.value = '無法開啟 Google Maps'
  }
}

async function acceptOrder() {
  if (!order.value || acting.value || order.value.status !== 'OPEN') {
    return
  }

  accepting.value = true
  actionError.value = null
  successMessage.value = null

  try {
    await acceptDriverOrder(order.value.id)
    successMessage.value = '接單成功'
    await loadOrder()
  } catch (caught) {
    actionError.value = captureError(caught)
    if (
      actionError.value.code === 'ORDER_ALREADY_ACCEPTED' ||
      actionError.value.code === 'INVALID_ORDER_STATUS'
    ) {
      await loadOrder()
    }
  } finally {
    accepting.value = false
  }
}

async function startOrder() {
  if (!order.value || acting.value || order.value.status !== 'ACCEPTED') {
    return
  }

  starting.value = true
  actionError.value = null
  successMessage.value = null

  try {
    await startDriverOrder(order.value.id)
    successMessage.value = '行程已開始'
    driverStatus.setInProgressOrder(true)
    await loadOrder()
  } catch (caught) {
    actionError.value = captureError(caught)
    if (actionError.value.code === 'INVALID_ORDER_STATUS') {
      await loadOrder()
    }
  } finally {
    starting.value = false
  }
}

async function completeOrder() {
  if (!order.value || acting.value || order.value.status !== 'IN_PROGRESS') {
    return
  }

  completing.value = true
  actionError.value = null
  successMessage.value = null

  try {
    await completeDriverOrder(order.value.id)
    successMessage.value = '訂單已完成'
    driverStatus.setInProgressOrder(false)
    await loadOrder()
  } catch (caught) {
    actionError.value = captureError(caught)
    if (actionError.value.code === 'INVALID_ORDER_STATUS') {
      await loadOrder()
    }
  } finally {
    completing.value = false
  }
}

function clearDevGpsTimer() {
  if (devGpsTimer !== null) {
    clearTimeout(devGpsTimer)
    devGpsTimer = null
  }
}

function addDevGpsRow() {
  if (devGpsStatus.value === 'running' || devGpsBusy.value) {
    return
  }
  devGpsRows.value.push('')
}

function openDevGpsModal() {
  showDevGpsModal.value = true
  if (devGpsStatus.value === 'idle') {
    devGpsError.value = null
    devGpsMessage.value = null
  }
}

function closeDevGpsModal() {
  if (devGpsStatus.value === 'running') {
    pauseDevGps()
  }
  showDevGpsModal.value = false
}

function onDevGpsModalShow(show: boolean) {
  if (!show) {
    closeDevGpsModal()
    return
  }
  showDevGpsModal.value = true
}

function scheduleNextDevGps() {
  clearDevGpsTimer()
  if (devGpsStatus.value !== 'running') {
    return
  }
  if (devGpsNextIndex.value >= devGpsQueue.value.length) {
    return
  }
  devGpsTimer = setTimeout(() => {
    void sendDevGpsAt(devGpsNextIndex.value)
  }, devGpsIntervalMs.value)
}

async function sendDevGpsAt(index: number) {
  if (devGpsStatus.value !== 'running') {
    return
  }
  const point = devGpsQueue.value[index]
  if (!point) {
    return
  }

  clearDevGpsTimer()
  devGpsBusy.value = true
  devGpsError.value = null
  try {
    const result = await updateDriverLocation(point.latitude, point.longitude)
    // Only after API success: sync map "我" marker via selfPoint.
    driverLat.value =
      typeof result.latitude === 'number' ? result.latitude : point.latitude
    driverLng.value =
      typeof result.longitude === 'number' ? result.longitude : point.longitude
    devGpsSentCount.value = index + 1
    devGpsNextIndex.value = index + 1
    if (devGpsNextIndex.value >= devGpsQueue.value.length) {
      devGpsStatus.value = 'completed'
      devGpsMessage.value = '發送完成'
      return
    }
    if (devGpsStatus.value === 'running') {
      scheduleNextDevGps()
    }
  } catch (caught) {
    const err = captureError(caught)
    devGpsStatus.value = 'failed'
    devGpsError.value = `${err.code} · ${err.message}`
    clearDevGpsTimer()
  } finally {
    devGpsBusy.value = false
  }
}

async function startDevGps() {
  if (!canStartDevGps.value) {
    return
  }

  const duration = parseDurationMinutes(devGpsDurationMinutes.value)
  if (!duration.ok) {
    devGpsError.value = duration.message
    return
  }
  const points = collectValidGpsPoints(devGpsRows.value)
  if (!points.ok) {
    devGpsError.value = points.message
    return
  }

  clearDevGpsTimer()
  devGpsError.value = null
  devGpsMessage.value = null
  devGpsQueue.value = points.value
  devGpsIntervalMs.value = computeSendIntervalMs(
    duration.value,
    points.value.length,
  )
  devGpsNextIndex.value = 0
  devGpsSentCount.value = 0
  devGpsStatus.value = 'running'
  await sendDevGpsAt(0)
}

function pauseDevGps() {
  if (!canPauseDevGps.value) {
    return
  }
  clearDevGpsTimer()
  devGpsStatus.value = 'paused'
}

function resumeDevGps() {
  if (!canResumeDevGps.value) {
    return
  }
  if (devGpsNextIndex.value >= devGpsQueue.value.length) {
    return
  }
  clearDevGpsTimer()
  devGpsError.value = null
  devGpsStatus.value = 'running'
  // Retry / continue the pending point immediately after pause/failure.
  void sendDevGpsAt(devGpsNextIndex.value)
}

function stopDevGps() {
  if (
    devGpsStatus.value !== 'running' &&
    devGpsStatus.value !== 'paused' &&
    !(
      devGpsStatus.value === 'failed' &&
      devGpsNextIndex.value < devGpsQueue.value.length
    )
  ) {
    return
  }
  clearDevGpsTimer()
  devGpsStatus.value = 'stopped'
}

onBeforeUnmount(() => {
  clearDevGpsTimer()
})

watch(
  () => route.params.id,
  () => {
    actionError.value = null
    successMessage.value = null
    void loadOrder()
  },
  { immediate: true },
)
</script>

<template>
  <section class="page">
    <div class="top-actions">
      <NButton
        class="back"
        text
        type="primary"
        size="large"
        @click="router.push({ name: backTarget.name })"
      >
        <template #icon>
          <ArrowLeft :size="18" />
        </template>
        {{ backTarget.label }}
      </NButton>
      <NButton
        v-if="isDev"
        class="dev-gps-btn"
        secondary
        type="warning"
        size="large"
        @click="openDevGpsModal"
      >
        DEV GPS
      </NButton>
    </div>

    <NModal
      :show="showDevGpsModal"
      preset="card"
      title="DEV GPS 測試"
      :mask-closable="false"
      class="dev-gps-modal"
      style="width: min(460px, calc(100vw - 32px))"
      @update:show="onDevGpsModalShow"
    >
      <label class="dev-gps-field">
        <span>發送時間（分鐘）</span>
        <NInput
          v-model:value="devGpsDurationMinutes"
          placeholder="5"
          :disabled="devGpsStatus === 'running' || devGpsBusy"
          inputmode="decimal"
        />
      </label>

      <div class="dev-gps-coords">
        <label
          v-for="(_, index) in devGpsRows"
          :key="index"
          class="dev-gps-field"
        >
          <span>座標 {{ index + 1 }}</span>
          <NInput
            v-model:value="devGpsRows[index]"
            :placeholder="
              index === 0 ? '22.619396, 120.321416' : 'latitude, longitude'
            "
            :disabled="devGpsStatus === 'running' || devGpsBusy"
          />
        </label>
        <NButton
          class="dev-gps-add"
          quaternary
          type="primary"
          :disabled="devGpsStatus === 'running' || devGpsBusy"
          @click="addDevGpsRow"
        >
          ＋ 新增座標
        </NButton>
      </div>

      <p class="dev-gps-status">狀態：{{ devGpsStatusLabel }}</p>
      <p v-if="devGpsProgressLabel" class="dev-gps-progress">
        {{
          devGpsStatus === 'completed'
            ? `${devGpsSentCount} / ${devGpsQueue.length}`
            : devGpsProgressLabel
        }}
      </p>
      <p v-if="devGpsMessage" class="dev-gps-success">{{ devGpsMessage }}</p>
      <p v-if="devGpsError" class="dev-gps-error">{{ devGpsError }}</p>

      <div class="dev-gps-actions">
        <NButton
          type="primary"
          size="large"
          :loading="devGpsBusy && devGpsStatus === 'running'"
          :disabled="!canStartDevGps"
          @click="startDevGps"
        >
          開始發送
        </NButton>
        <NButton
          v-if="devGpsStatus === 'running'"
          size="large"
          :disabled="!canPauseDevGps"
          @click="pauseDevGps"
        >
          暫停
        </NButton>
        <NButton
          v-else
          size="large"
          :disabled="!canResumeDevGps"
          @click="resumeDevGps"
        >
          繼續
        </NButton>
        <NButton
          size="large"
          :disabled="!canStopDevGps"
          @click="stopDevGps"
        >
          停止
        </NButton>
        <NButton size="large" @click="closeDevGpsModal">
          關閉
        </NButton>
      </div>
    </NModal>

    <NSpin :show="loading">
      <NResult
        v-if="forbidden"
        status="403"
        title="沒有權限"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error?.code }} · {{ error?.message }}</p>
        </template>
      </NResult>

      <NResult
        v-else-if="notFound && !actionError"
        status="404"
        title="找不到訂單"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error?.code }} · {{ error?.message }}</p>
        </template>
      </NResult>

      <NResult
        v-else-if="notFound && actionError"
        status="warning"
        title="此訂單已被其他司機接走"
        class="state"
      >
        <template #default>
          <p class="error-detail">
            {{ actionError.code }} · {{ actionError.message }}
          </p>
        </template>
      </NResult>

      <NResult
        v-else-if="error && !order"
        status="error"
        title="無法載入訂單"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error.code }} · {{ error.message }}</p>
        </template>
        <template #footer>
          <NButton size="large" type="primary" block @click="loadOrder">
            <template #icon>
              <RotateCcw :size="18" />
            </template>
            重試
          </NButton>
        </template>
      </NResult>

      <article v-else-if="order" class="card">
        <header class="header">
          <div class="header-copy">
            <p class="order-no">{{ order.order_no }}</p>
            <p class="time">{{ formatScheduledAt(order.created_at) }}</p>
          </div>
          <OrderStatusTag :status="order.status" />
        </header>

        <p class="route">
          <span class="place">{{ order.pickup_location }}</span>
          <span class="arrow" aria-hidden="true">→</span>
          <span class="place">{{ formatOptionalText(order.destination) }}</span>
        </p>

        <OrderMap
          class="map-block"
          :pickup="pickupPoint"
          :self-location="selfPoint"
        />

        <NButton
          v-if="canNavigate"
          class="nav-btn"
          size="large"
          secondary
          block
          @click="startNavigation"
        >
          開始導航
        </NButton>
        <p v-if="navHint" class="nav-hint">{{ navHint }}</p>

        <dl class="compact-summary">
          <div v-if="distanceLabel" class="summary-row">
            <dt>直線距離</dt>
            <dd>{{ distanceLabel }}</dd>
          </div>
          <div v-if="inProgressMileage" class="summary-row">
            <dt>已行駛</dt>
            <dd>{{ tripDistanceKm }}</dd>
          </div>
          <div v-if="completedMileage" class="summary-row">
            <dt>行駛里程</dt>
            <dd>{{ completedMileage }}</dd>
          </div>
          <div class="summary-row">
            <dt>{{ priceLabel }}</dt>
            <dd class="price">{{ formatPrice(order.price) }}</dd>
          </div>
        </dl>

        <dl class="secondary-fields">
          <div class="summary-row">
            <dt>客戶</dt>
            <dd>{{ formatOptionalText(order.customer_name) }}</dd>
          </div>
          <div class="summary-row">
            <dt>備註</dt>
            <dd>{{ formatOptionalText(order.note) }}</dd>
          </div>
        </dl>

        <p v-if="successMessage" class="success">{{ successMessage }}</p>
        <p v-if="actionError" class="action-error">
          {{ actionError.code }} · {{ actionError.message }}
        </p>

        <div v-if="hasPrimaryAction" class="action-dock">
          <SlideToConfirm
            v-if="order.status === 'OPEN'"
            label="滑動接單"
            loading-label="搶單中..."
            :loading="accepting"
            :disabled="acting && !accepting"
            @confirm="acceptOrder"
          />
          <SlideToConfirm
            v-else-if="order.status === 'ACCEPTED'"
            label="滑動開始行程"
            loading-label="開始中..."
            :loading="starting"
            :disabled="acting && !starting"
            @confirm="startOrder"
          />
          <SlideToConfirm
            v-else-if="order.status === 'IN_PROGRESS'"
            label="滑動完成訂單"
            loading-label="完成中..."
            :loading="completing"
            :disabled="acting && !completing"
            @confirm="completeOrder"
          />
        </div>
      </article>
    </NSpin>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.top-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-width: 0;
}

.back {
  align-self: flex-start;
  min-height: 44px;
  transition: color 160ms ease !important;
}

.dev-gps-btn {
  flex-shrink: 0;
  min-height: 44px;
}

.dev-gps-coords {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: var(--space-8);
  max-height: 40vh;
  overflow: auto;
}

.dev-gps-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-12);
  font: var(--font-label);
  color: var(--color-text);
}

.dev-gps-add {
  align-self: flex-start;
  margin-bottom: var(--space-12);
}

.dev-gps-status,
.dev-gps-progress {
  margin: 0 0 var(--space-8);
  color: var(--color-text);
  font: var(--font-caption);
  font-weight: 600;
}

.dev-gps-error {
  margin: 0 0 var(--space-8);
  padding: var(--space-8) var(--space-12);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-danger) 14%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-danger) 28%, transparent);
  color: var(--color-danger);
  font: var(--font-caption);
}

.dev-gps-success {
  margin: 0 0 var(--space-8);
  padding: var(--space-8) var(--space-12);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-success) 14%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-success) 28%, transparent);
  color: var(--color-success);
  font: var(--font-caption);
}

.dev-gps-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
}

.dev-gps-actions :deep(.n-button) {
  min-height: 44px;
}

.card {
  background: var(--driver-surface-card, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: var(--space-16);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    var(--shadow-card, 0 10px 28px rgba(8, 12, 24, 0.28));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-12);
}

.header-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.order-no {
  margin: 0;
  font: var(--font-label);
  font-weight: 700;
  color: #f1f5f9;
  overflow-wrap: anywhere;
}

.time,
.error-detail,
.arrow {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.time {
  font-weight: 600;
  color: rgba(203, 213, 225, 0.85);
}

.route {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: start;
  column-gap: 6px;
  width: 100%;
  min-width: 0;
  margin: var(--space-8) 0;
  padding: 0;
}

.place {
  min-width: 0;
  max-width: 100%;
  margin: 0;
  font: var(--font-label);
  font-weight: 700;
  line-height: 1.35;
  color: #f8fafc;
  overflow-wrap: anywhere;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.arrow {
  margin-top: 1px;
  line-height: 1.35;
  font-weight: 700;
  color: var(--color-primary-muted);
}

.map-block {
  margin: 0 0 var(--space-8);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.nav-btn {
  margin-bottom: var(--space-8);
  min-height: 48px;
  font-weight: 700;
  transition: transform 160ms ease, filter 160ms ease !important;
}

.nav-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.nav-hint {
  margin: 0 0 var(--space-8);
  font: var(--font-caption);
  color: var(--color-muted-text);
}

.compact-summary,
.secondary-fields {
  display: grid;
  margin: 0;
}

.compact-summary {
  margin-top: var(--space-4);
  padding: var(--space-4) 0;
  border-top: 1px solid var(--color-border);
}

.secondary-fields {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.summary-row {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  gap: var(--space-12);
  align-items: start;
  padding: var(--space-8) 0;
}

.summary-row + .summary-row {
  border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
}

.summary-row dt {
  margin: 0;
  font: var(--font-caption);
  font-weight: 600;
  color: rgba(196, 208, 224, 0.78);
  line-height: 1.4;
}

.summary-row dd {
  margin: 0;
  min-width: 0;
  font: var(--font-label);
  color: #f1f5f9;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.price {
  font: var(--font-price);
  font-size: 18px;
  color: #93c5fd;
}

.success,
.action-error {
  margin: var(--space-12) 0 0;
  padding: var(--space-12);
  border-radius: 10px;
  font: var(--font-label);
}

.success {
  background: color-mix(in srgb, var(--color-success) 14%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-success) 28%, transparent);
  color: var(--color-success);
}

.action-error {
  background: color-mix(in srgb, var(--color-danger) 14%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-danger) 28%, transparent);
  color: var(--color-danger);
  font: var(--font-caption);
}

.action-dock {
  position: sticky;
  bottom: 0;
  z-index: 1;
  margin: var(--space-16) calc(-1 * var(--space-16)) calc(-1 * var(--space-16));
  padding: var(--space-16);
  background: linear-gradient(
    180deg,
    rgba(20, 30, 51, 0.55) 0%,
    rgba(28, 38, 62, 0.96) 35%,
    rgba(36, 48, 76, 0.98) 100%
  );
  border-top: 1px solid var(--color-border);
  border-radius: 0 0 14px 14px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.state {
  padding: var(--space-32) 0;
}

.state :deep(.n-button) {
  min-height: 48px;
}

@media (prefers-reduced-motion: reduce) {
  .back,
  .nav-btn {
    transition: none !important;
  }

  .nav-btn:active:not(:disabled) {
    transform: none;
  }
}
</style>
