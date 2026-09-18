<script setup lang="ts">
import { ArrowLeft, RotateCcw } from 'lucide-vue-next'
import { NButton, NResult, NSpin } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  cancelOrder,
  deleteOrder,
  getOrder,
  listOnlineDriverDistances,
  publishOrder,
  updateOrder,
} from '../api/orders'
import { ApiClientError } from '../api/types'
import type {
  CreateOrderInput,
  OnlineDriverDistanceItem,
  OrderDetail,
} from '../api/types'
import OrderForm from '../components/OrderForm.vue'
import OrderMap from '../components/OrderMap.vue'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import { formatStraightLineDistance } from '../lib/format-distance'
import { formatDateTimeTaipei, formatOptionalText, formatPrice } from '../lib/format'
import { orderDetailToFormValues, type OrderFormValues } from '../lib/order-form'

const route = useRoute()
const router = useRouter()
const order = ref<OrderDetail | null>(null)
const onlineDrivers = ref<OnlineDriverDistanceItem[]>([])
const loading = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const actionError = ref<{ code: string; message: string } | null>(null)
const notFound = ref(false)
const forbidden = ref(false)
const editing = ref(false)
const editValues = ref<OrderFormValues | null>(null)
const saving = ref(false)
const deleting = ref(false)
const publishing = ref(false)
const cancelling = ref(false)
const confirmDelete = ref(false)
const confirmPublish = ref(false)
const confirmCancel = ref(false)

let requestSeq = 0

const isDraft = computed(() => order.value?.status === 'DRAFT')
const canCancel = computed(
  () => order.value?.status === 'OPEN' || order.value?.status === 'ACCEPTED',
)
const busy = computed(
  () => saving.value || deleting.value || publishing.value || cancelling.value,
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

function driverDistanceLabel(distanceMeters: number | null): string | null {
  const label = formatStraightLineDistance(distanceMeters)
  return label ? `直線距離：${label}` : null
}

const driverPoints = computed(() =>
  onlineDrivers.value
    .filter(
      (d) =>
        typeof d.latitude === 'number' &&
        Number.isFinite(d.latitude) &&
        typeof d.longitude === 'number' &&
        Number.isFinite(d.longitude),
    )
    .map((d) => ({
      lat: d.latitude as number,
      lng: d.longitude as number,
      label: d.username,
    })),
)

const onlineDriverDistanceRows = computed(() =>
  onlineDrivers.value.map((d) => ({
    id: d.id,
    username: d.username,
    license_plate: d.license_plate,
    distanceLabel: driverDistanceLabel(d.distance_meters),
  })),
)

const showDispatchMap = computed(
  () =>
    order.value != null &&
    order.value.status !== 'DRAFT' &&
    (pickupPoint.value != null || driverPoints.value.length > 0),
)

const showMobileActionBar = computed(
  () =>
    order.value != null &&
    !editing.value &&
    (isDraft.value || canCancel.value),
)

const timestamps = computed(() => {
  if (!order.value) {
    return []
  }

  const rows = [
    { label: '建立時間', value: order.value.created_at },
    { label: '更新時間', value: order.value.updated_at },
    { label: '接單時間', value: order.value.accepted_at },
    { label: '開始時間', value: order.value.started_at },
    { label: '完成時間', value: order.value.completed_at },
    { label: '取消時間', value: order.value.cancelled_at },
  ]

  return rows.filter((row) => row.value)
})

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
  actionError.value = null
  notFound.value = false
  forbidden.value = false
  editing.value = false
  confirmDelete.value = false
  confirmPublish.value = false
  confirmCancel.value = false
  order.value = null

  try {
    const data = await getOrder(id)
    if (seq !== requestSeq) {
      return
    }
    order.value = data
    try {
      const distances = await listOnlineDriverDistances(id)
      if (seq === requestSeq) {
        onlineDrivers.value = distances
      }
    } catch {
      if (seq === requestSeq) {
        onlineDrivers.value = []
      }
    }
  } catch (caught) {
    if (seq !== requestSeq) {
      return
    }
    onlineDrivers.value = []
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

async function refreshOrder() {
  const id = String(route.params.id ?? '')
  const data = await getOrder(id)
  order.value = data
}

function startEdit() {
  if (!order.value || !isDraft.value || busy.value) {
    return
  }
  actionError.value = null
  editValues.value = orderDetailToFormValues(order.value)
  editing.value = true
}

function cancelEdit() {
  if (saving.value) {
    return
  }
  editing.value = false
  editValues.value = null
  actionError.value = null
}

async function onSave(input: CreateOrderInput) {
  if (!order.value || saving.value) {
    return
  }

  saving.value = true
  actionError.value = null

  try {
    order.value = await updateOrder(order.value.id, input)
    editing.value = false
    editValues.value = null
  } catch (caught) {
    actionError.value = captureError(caught)
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!order.value || deleting.value) {
    return false
  }

  deleting.value = true
  actionError.value = null

  try {
    await deleteOrder(order.value.id)
    confirmDelete.value = false
    await router.push({ name: 'orders' })
    return true
  } catch (caught) {
    actionError.value = captureError(caught)
    return false
  } finally {
    deleting.value = false
  }
}

async function onPublish() {
  if (!order.value || publishing.value) {
    return false
  }

  publishing.value = true
  actionError.value = null

  try {
    await publishOrder(order.value.id)
    confirmPublish.value = false
    await refreshOrder()
    return true
  } catch (caught) {
    actionError.value = captureError(caught)
    return false
  } finally {
    publishing.value = false
  }
}

async function onCancel() {
  if (!order.value || cancelling.value || !canCancel.value) {
    return false
  }

  cancelling.value = true
  actionError.value = null

  try {
    await cancelOrder(order.value.id)
    confirmCancel.value = false
    await refreshOrder()
    return true
  } catch (caught) {
    actionError.value = captureError(caught)
    return false
  } finally {
    cancelling.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    void loadOrder()
  },
  { immediate: true },
)
</script>

<template>
  <section class="page">
    <NButton class="back" text type="primary" @click="router.push({ name: 'orders' })">
      <template #icon>
        <ArrowLeft :size="16" />
      </template>
      返回訂單
    </NButton>

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
        v-else-if="notFound"
        status="404"
        title="找不到訂單"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error?.code }} · {{ error?.message }}</p>
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
          <NButton type="primary" @click="loadOrder">
            <template #icon>
              <RotateCcw :size="16" />
            </template>
            重試
          </NButton>
        </template>
      </NResult>

      <template v-else-if="order">
        <header class="page-header">
          <div>
            <p class="kicker">訂單詳情</p>
            <h1>{{ order.order_no }}</h1>
          </div>
          <OrderStatusTag :status="order.status" />
        </header>

        <p v-if="actionError && !editing" class="action-error">
          {{ actionError.code }} · {{ actionError.message }}
        </p>

        <div class="desktop-layout">
          <div class="main">
            <article class="panel">
              <h2>{{ editing ? '編輯草稿' : '訂單資訊' }}</h2>
              <OrderForm
                v-if="editing && editValues"
                submit-label="儲存變更"
                :initial-values="editValues"
                :submitting="saving"
                :error="actionError"
                show-cancel
                @submit="onSave"
                @cancel="cancelEdit"
              />
              <dl v-else class="fields">
                <div>
                  <dt>客戶</dt>
                  <dd>{{ formatOptionalText(order.customer_name) }}</dd>
                </div>
                <div class="emphasis">
                  <dt>行程</dt>
                  <dd class="route">
                    <span>{{ order.pickup_location }}</span>
                    <span class="route-arrow">→</span>
                    <span>{{ formatOptionalText(order.destination) }}</span>
                  </dd>
                </div>
                <div class="emphasis">
                  <dt>價格</dt>
                  <dd class="price">{{ formatPrice(order.price) }}</dd>
                </div>
                <div>
                  <dt>備註</dt>
                  <dd>{{ formatOptionalText(order.note) }}</dd>
                </div>
              </dl>
            </article>

            <article v-if="showDispatchMap" class="panel">
              <h2>地圖</h2>
              <OrderMap :pickup="pickupPoint" :drivers="driverPoints" />
              <ul v-if="onlineDriverDistanceRows.length" class="driver-distances">
                <li v-for="d in onlineDriverDistanceRows" :key="d.id">
                  <span>{{ d.username }} · {{ d.license_plate }}</span>
                  <span v-if="d.distanceLabel">{{ d.distanceLabel }}</span>
                </li>
              </ul>
            </article>

            <article class="panel">
              <h2>接單司機</h2>
              <RouterLink
                v-if="order.driver && order.driver_id"
                class="driver-link"
                :to="{ name: 'driver-detail', params: { id: order.driver_id } }"
              >
                {{ order.driver.username }}
              </RouterLink>
              <p v-else class="driver-empty">尚無</p>
            </article>
          </div>

          <aside class="panel status-panel">
            <h2>訂單狀態</h2>
            <div class="status-block">
              <OrderStatusTag :status="order.status" />
            </div>
            <div v-if="isDraft && !editing" class="draft-actions">
              <template v-if="confirmDelete">
                <p class="confirm-copy">確定刪除此草稿？刪除後無法復原。</p>
                <NButton block :disabled="deleting" @click="confirmDelete = false">
                  取消
                </NButton>
                <NButton
                  type="error"
                  block
                  :loading="deleting"
                  :disabled="deleting"
                  @click="onDelete"
                >
                  確認刪除
                </NButton>
              </template>
              <template v-else-if="confirmPublish">
                <p class="confirm-copy">確定發布這張草稿？發布後會進入搶單中，無法再編輯或刪除。</p>
                <NButton block :disabled="publishing" @click="confirmPublish = false">
                  取消
                </NButton>
                <NButton
                  type="warning"
                  block
                  :loading="publishing"
                  :disabled="publishing"
                  @click="onPublish"
                >
                  確認發布
                </NButton>
              </template>
              <template v-else>
                <NButton type="primary" block :disabled="busy" @click="startEdit">
                  編輯
                </NButton>
                <NButton
                  type="warning"
                  block
                  :disabled="busy"
                  @click="confirmPublish = true"
                >
                  發布
                </NButton>
                <NButton
                  type="error"
                  ghost
                  block
                  :disabled="busy"
                  @click="confirmDelete = true"
                >
                  刪除
                </NButton>
              </template>
            </div>
            <div v-else-if="canCancel && !editing" class="draft-actions">
              <template v-if="confirmCancel">
                <p class="confirm-copy">確定取消此訂單？取消後無法再搶單或接單。</p>
                <NButton block :disabled="cancelling" @click="confirmCancel = false">
                  返回
                </NButton>
                <NButton
                  type="error"
                  block
                  :loading="cancelling"
                  :disabled="cancelling"
                  @click="onCancel"
                >
                  確認取消
                </NButton>
              </template>
              <NButton
                v-else
                type="error"
                ghost
                block
                :disabled="busy"
                @click="confirmCancel = true"
              >
                取消訂單
              </NButton>
            </div>
            <dl v-if="timestamps.length" class="meta">
              <div v-for="row in timestamps" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ formatDateTimeTaipei(row.value as string) }}</dd>
              </div>
            </dl>
          </aside>
        </div>

        <div
          class="mobile-layout"
          :class="{ 'has-action-bar': showMobileActionBar }"
        >
          <div class="sheet">
            <template v-if="editing && editValues">
              <section class="section">
                <h2>編輯草稿</h2>
                <OrderForm
                  submit-label="儲存變更"
                  :initial-values="editValues"
                  :submitting="saving"
                  :error="actionError"
                  show-cancel
                  @submit="onSave"
                  @cancel="cancelEdit"
                />
              </section>
            </template>
            <template v-else>
              <dl class="compact-summary">
                <div class="summary-row">
                  <dt>客戶</dt>
                  <dd>{{ formatOptionalText(order.customer_name) }}</dd>
                </div>
                <div class="summary-row">
                  <dt>行程</dt>
                  <dd class="route">
                    <span>{{ order.pickup_location }}</span>
                    <span class="route-arrow">→</span>
                    <span>{{ formatOptionalText(order.destination) }}</span>
                  </dd>
                </div>
                <div class="summary-row">
                  <dt>價格</dt>
                  <dd class="price">{{ formatPrice(order.price) }}</dd>
                </div>
                <div class="summary-row">
                  <dt>備註</dt>
                  <dd>{{ formatOptionalText(order.note) }}</dd>
                </div>
                <div class="summary-row">
                  <dt>接單司機</dt>
                  <dd>
                    <RouterLink
                      v-if="order.driver && order.driver_id"
                      class="driver-link"
                      :to="{
                        name: 'driver-detail',
                        params: { id: order.driver_id },
                      }"
                    >
                      {{ order.driver.username }}
                    </RouterLink>
                    <span v-else class="driver-empty">尚無</span>
                  </dd>
                </div>
              </dl>
              <section v-if="showDispatchMap" class="section map-section">
                <OrderMap :pickup="pickupPoint" :drivers="driverPoints" />
                <ul
                  v-if="onlineDriverDistanceRows.length"
                  class="driver-distances"
                >
                  <li v-for="d in onlineDriverDistanceRows" :key="d.id">
                    <span>{{ d.username }} · {{ d.license_plate }}</span>
                    <span v-if="d.distanceLabel">{{ d.distanceLabel }}</span>
                  </li>
                </ul>
              </section>
              <section v-if="timestamps.length" class="section meta-section">
                <dl class="mobile-meta">
                  <div v-for="row in timestamps" :key="row.label">
                    <dt>{{ row.label }}</dt>
                    <dd>{{ formatDateTimeTaipei(row.value as string) }}</dd>
                  </div>
                </dl>
              </section>
            </template>
          </div>

          <div v-if="showMobileActionBar" class="mobile-action-bar">
            <template v-if="isDraft">
              <template v-if="confirmDelete">
                <p class="confirm-copy">確定刪除此草稿？刪除後無法復原。</p>
                <div class="mobile-action-row">
                  <NButton
                    secondary
                    block
                    :disabled="deleting"
                    @click="confirmDelete = false"
                  >
                    取消
                  </NButton>
                  <NButton
                    type="error"
                    block
                    :loading="deleting"
                    :disabled="deleting"
                    @click="onDelete"
                  >
                    確認刪除
                  </NButton>
                </div>
              </template>
              <template v-else-if="confirmPublish">
                <p class="confirm-copy">
                  確定發布這張草稿？發布後會進入搶單中，無法再編輯或刪除。
                </p>
                <div class="mobile-action-row">
                  <NButton
                    secondary
                    block
                    :disabled="publishing"
                    @click="confirmPublish = false"
                  >
                    取消
                  </NButton>
                  <NButton
                    type="warning"
                    block
                    :loading="publishing"
                    :disabled="publishing"
                    @click="onPublish"
                  >
                    確認發布
                  </NButton>
                </div>
              </template>
              <template v-else>
                <div class="mobile-action-row">
                  <NButton
                    type="primary"
                    block
                    :disabled="busy"
                    @click="startEdit"
                  >
                    編輯
                  </NButton>
                  <NButton
                    type="warning"
                    block
                    :disabled="busy"
                    @click="confirmPublish = true"
                  >
                    發布
                  </NButton>
                </div>
                <NButton
                  class="delete-secondary"
                  text
                  type="error"
                  block
                  :disabled="busy"
                  @click="confirmDelete = true"
                >
                  刪除
                </NButton>
              </template>
            </template>
            <template v-else-if="canCancel">
              <template v-if="confirmCancel">
                <p class="confirm-copy">確定取消此訂單？取消後無法再搶單或接單。</p>
                <div class="mobile-action-row">
                  <NButton
                    secondary
                    block
                    :disabled="cancelling"
                    @click="confirmCancel = false"
                  >
                    返回
                  </NButton>
                  <NButton
                    type="error"
                    block
                    :loading="cancelling"
                    :disabled="cancelling"
                    @click="onCancel"
                  >
                    確認取消
                  </NButton>
                </div>
              </template>
              <NButton
                v-else
                type="error"
                ghost
                block
                :disabled="busy"
                @click="confirmCancel = true"
              >
                取消訂單
              </NButton>
            </template>
          </div>
        </div>
      </template>
    </NSpin>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  min-width: 0;
}

.back {
  align-self: flex-start;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-16);
}

.kicker,
.error-detail {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.action-error {
  margin: 0;
  color: var(--color-danger);
  font: var(--font-caption);
}

h1 {
  margin: var(--space-4) 0 0;
  font: var(--font-page-title);
}

.desktop-layout {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(240px, 3fr);
  gap: var(--space-16);
  align-items: start;
}

.mobile-layout {
  display: none;
}

.main {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  min-width: 0;
}

.panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  padding: var(--space-24);
}

h2 {
  margin: 0 0 var(--space-12);
  padding-bottom: var(--space-12);
  border-bottom: 1px solid var(--color-border);
  font: var(--font-section-title);
}

.fields,
.meta {
  display: grid;
  gap: var(--space-16);
  margin: 0;
}

.fields > div,
.meta > div {
  display: grid;
  gap: var(--space-4);
}

dt {
  font: var(--font-label);
  color: var(--color-muted-text);
}

dd {
  margin: 0;
}

.emphasis .route,
.emphasis .price {
  color: var(--color-text);
}

.route {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-8);
  font: var(--font-section-title);
}

.route-arrow {
  color: var(--color-muted-text);
  font: var(--font-label);
}

.price {
  font: var(--font-price);
}

.driver-link {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  color: var(--color-primary);
  font: var(--font-label);
  font-weight: 600;
  text-decoration: none;
}

.driver-link:hover,
.driver-link:focus-visible {
  text-decoration: underline;
}

.driver-empty {
  margin: 0;
  color: var(--color-muted-text);
}

.status-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: var(--space-16);
}

.draft-actions {
  display: grid;
  gap: var(--space-8);
  margin-bottom: var(--space-16);
}

.confirm-copy {
  margin: 0 0 var(--space-4);
  color: var(--color-text);
  font: var(--font-caption);
}

.meta {
  padding-top: var(--space-16);
  border-top: 1px solid var(--color-border);
}

.sheet {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  overflow: hidden;
}

.compact-summary {
  display: grid;
  margin: 0;
  padding: var(--space-4) var(--space-16);
}

.summary-row {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  gap: var(--space-12);
  align-items: start;
  padding: var(--space-8) 0;
  border-bottom: 1px solid var(--color-border);
}

.summary-row:last-child {
  border-bottom: 0;
}

.summary-row dt {
  margin: 0;
  font: var(--font-caption);
  color: var(--color-muted-text);
  font-weight: 600;
  line-height: 1.4;
}

.summary-row dd {
  margin: 0;
  min-width: 0;
  font: var(--font-label);
  color: var(--color-text);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.summary-row .route {
  font: var(--font-label);
  font-weight: 600;
}

.summary-row .price {
  font: var(--font-price);
  font-size: 16px;
}

.summary-row .driver-link {
  min-height: 0;
}

.section {
  padding: var(--space-12) var(--space-16);
}

.section + .section,
.compact-summary + .section {
  border-top: 1px solid var(--color-border);
}

.section h2 {
  margin: 0 0 var(--space-4);
  padding: 0;
  border: none;
  font: var(--font-caption);
  color: var(--color-muted-text);
  font-weight: 600;
}

.map-section {
  padding-top: var(--space-12);
  padding-bottom: var(--space-12);
}

.meta-section {
  background: color-mix(in srgb, var(--color-surface) 88%, var(--color-border));
}

.mobile-meta {
  display: grid;
  gap: 6px;
  margin: 0;
}

.mobile-meta > div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-12);
  align-items: baseline;
}

.mobile-meta dt,
.mobile-meta dd {
  margin: 0;
  font: var(--font-caption);
  color: var(--color-muted-text);
}

.mobile-meta dd {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.mobile-action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: grid;
  gap: var(--space-8);
  padding: var(--space-12) var(--space-16);
  padding-bottom: max(var(--space-12), env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 94%, #ffffff);
}

.mobile-action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
}

.mobile-action-bar :deep(.n-button) {
  min-height: 44px;
}

.delete-secondary {
  min-height: 36px !important;
  font-weight: 500;
}

.state {
  padding: var(--space-32) 0;
}

.driver-distances {
  list-style: none;
  margin: var(--space-12) 0 0;
  padding: 0;
  display: grid;
  gap: var(--space-8);
}

.driver-distances li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-12);
  font: var(--font-caption);
  color: var(--color-muted-text);
}

@media (max-width: 900px) {
  .page {
    gap: var(--space-12);
  }

  .mobile-layout.has-action-bar {
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
  }

  .desktop-layout {
    display: none;
  }

  .mobile-layout {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
  }

  h1 {
    font-size: 22px;
  }
}

@media (min-width: 901px) {
  .mobile-action-bar {
    display: none;
  }
}
</style>
