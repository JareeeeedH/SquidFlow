<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { NButton, NEmpty, NResult, NSpin } from 'naive-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  completeDriverOrder,
  listDriverOrders,
  startDriverOrder,
} from '../api/driver-orders'
import { ApiClientError } from '../api/types'
import type { DriverMyOrder } from '../api/types'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import SlideToConfirm from '../components/SlideToConfirm.vue'
import { splitDriverMyOrders } from '../lib/driver-my-orders'
import { formatOptionalText, formatPrice, formatScheduledAt, formatTaipeiYmd } from '../lib/format'

const router = useRouter()
const orders = ref<DriverMyOrder[]>([])
const loading = ref(false)
const actingId = ref<string | null>(null)
const error = ref<{ code: string; message: string } | null>(null)
const actionError = ref<{ code: string; message: string } | null>(null)
const successMessage = ref<string | null>(null)
const forbidden = ref(false)

const grouped = computed(() => splitDriverMyOrders(orders.value))
const acting = computed(() => actingId.value !== null)

let requestSeq = 0

function captureError(caught: unknown) {
  if (caught instanceof ApiClientError) {
    return { code: caught.code, message: caught.message }
  }
  return { code: 'INTERNAL_ERROR', message: '系統發生錯誤' }
}

function historyDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return formatTaipeiYmd(date)
}

async function loadOrders() {
  const seq = ++requestSeq
  loading.value = true
  error.value = null
  forbidden.value = false

  try {
    const data = await listDriverOrders()
    if (seq !== requestSeq) {
      return
    }
    orders.value = data
  } catch (caught) {
    if (seq !== requestSeq) {
      return
    }
    orders.value = []
    if (caught instanceof ApiClientError) {
      if (caught.status === 403 && caught.code === 'FORBIDDEN') {
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

function openDetail(id: string) {
  void router.push({
    name: 'driver-order-detail',
    params: { id },
  })
}

async function startOrder(order: DriverMyOrder) {
  if (acting.value || order.status !== 'ACCEPTED') {
    return
  }

  actingId.value = order.id
  actionError.value = null
  successMessage.value = null

  try {
    await startDriverOrder(order.id)
    successMessage.value = '行程已開始'
    await loadOrders()
  } catch (caught) {
    actionError.value = captureError(caught)
    if (actionError.value.code === 'INVALID_ORDER_STATUS') {
      await loadOrders()
    }
  } finally {
    actingId.value = null
  }
}

async function completeOrder(order: DriverMyOrder) {
  if (acting.value || order.status !== 'IN_PROGRESS') {
    return
  }

  actingId.value = order.id
  actionError.value = null
  successMessage.value = null

  try {
    await completeDriverOrder(order.id)
    successMessage.value = '訂單已完成'
    await loadOrders()
  } catch (caught) {
    actionError.value = captureError(caught)
    if (actionError.value.code === 'INVALID_ORDER_STATUS') {
      await loadOrders()
    }
  } finally {
    actingId.value = null
  }
}

void loadOrders()
</script>

<template>
  <section class="page">
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
        v-else-if="error"
        status="error"
        title="無法載入我的訂單"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error.code }} · {{ error.message }}</p>
        </template>
        <template #footer>
          <NButton size="large" type="primary" block @click="loadOrders">
            <template #icon>
              <RotateCcw :size="18" />
            </template>
            重試
          </NButton>
        </template>
      </NResult>

      <template v-else>
        <p v-if="successMessage" class="success">{{ successMessage }}</p>
        <p v-if="actionError" class="action-error">
          {{ actionError.code }} · {{ actionError.message }}
        </p>

        <section class="group current-group">
          <h2>目前訂單</h2>
          <NEmpty
            v-if="!loading && grouped.current.length === 0"
            description="目前沒有進行中的訂單"
            class="empty current-empty"
          />
          <ul v-else class="list">
            <li v-for="order in grouped.current" :key="order.id">
              <article class="card current" :data-status="order.status">
                <button
                  type="button"
                  class="card-main"
                  @click="openDetail(order.id)"
                >
                  <div class="card-top">
                    <p class="time">{{ formatScheduledAt(order.created_at) }}</p>
                    <OrderStatusTag :status="order.status" />
                    <p class="price">{{ formatPrice(order.price) }}</p>
                  </div>
                  <p class="route">
                    <span class="place">{{ order.pickup_location }}</span>
                    <span class="arrow" aria-hidden="true">→</span>
                    <span class="place">{{ formatOptionalText(order.destination) }}</span>
                  </p>
                  <p class="order-no">{{ order.order_no }}</p>
                </button>
                <SlideToConfirm
                  v-if="order.status === 'ACCEPTED'"
                  label="滑動開始行程"
                  loading-label="開始中..."
                  :loading="actingId === order.id"
                  :disabled="acting && actingId !== order.id"
                  @confirm="startOrder(order)"
                />
                <SlideToConfirm
                  v-else-if="order.status === 'IN_PROGRESS'"
                  label="滑動完成訂單"
                  loading-label="完成中..."
                  :loading="actingId === order.id"
                  :disabled="acting && actingId !== order.id"
                  @confirm="completeOrder(order)"
                />
              </article>
            </li>
          </ul>
        </section>

        <section class="group history-group">
          <h2>歷史訂單</h2>
          <NEmpty
            v-if="!loading && grouped.history.length === 0"
            description="目前沒有歷史訂單"
            class="empty"
          />
          <ul v-else class="list">
            <li v-for="order in grouped.history" :key="order.id">
              <button
                type="button"
                class="card history"
                :data-status="order.status"
                @click="openDetail(order.id)"
              >
                <p class="history-date">{{ historyDate(order.created_at) }}</p>
                <div class="history-status">
                  <OrderStatusTag :status="order.status" />
                </div>
                <p class="route">
                  <span class="place">{{ order.pickup_location }}</span>
                  <span class="arrow" aria-hidden="true">→</span>
                  <span class="place">{{ formatOptionalText(order.destination) }}</span>
                </p>
                <p class="order-no">{{ order.order_no }}</p>
              </button>
            </li>
          </ul>
        </section>
      </template>
    </NSpin>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  min-width: 0;
  max-width: 100%;
}

.page :deep(.n-spin-container),
.page :deep(.n-spin-content) {
  overflow: visible;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

h2 {
  margin: 0 0 var(--space-8);
  font: var(--font-section-title);
  font-size: 15px;
  color: var(--color-primary, #0b1f3a);
}

.error-detail,
.order-no,
.arrow {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.success,
.action-error {
  margin: 0;
  padding: var(--space-12);
  border-radius: var(--radius-8);
  font: var(--font-label);
}

.success {
  background: color-mix(in srgb, var(--color-success) 10%, var(--color-surface));
  color: var(--color-success);
}

.action-error {
  background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface));
  color: var(--color-danger);
  font: var(--font-caption);
}

.group {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.history-group {
  padding-top: var(--space-4);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-8);
  min-width: 0;
}

.card {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: 10px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  box-shadow: var(--shadow-card, 0 1px 2px rgb(11 31 58 / 6%));
}

.card.current[data-status='ACCEPTED'] {
  --status-color: var(--color-info);
}

.card.current[data-status='IN_PROGRESS'] {
  --status-color: var(--color-primary, #0b1f3a);
}

.card.current {
  box-shadow:
    inset 3px 0 0 var(--status-color),
    var(--shadow-card, 0 1px 2px rgb(11 31 58 / 6%));
  border-color: color-mix(in srgb, var(--status-color) 28%, var(--color-border));
}

.card-main {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 0;
  text-align: left;
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.history {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 10px 12px;
  text-align: left;
  color: inherit;
  font: inherit;
  cursor: pointer;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  box-shadow: var(--shadow-card, 0 1px 2px rgb(11 31 58 / 6%));
}

.history:active {
  background: var(--color-primary-soft, #e8eef5);
}

.history:focus-visible,
.card-main:focus-visible {
  outline: 2px solid var(--color-primary, #0b1f3a);
  outline-offset: 2px;
}

.card-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
}

.history-date {
  margin: 0;
  min-width: 0;
  font: var(--font-caption);
  font-weight: 600;
  color: var(--color-muted-text);
  line-height: 1.3;
}

.history-status {
  display: flex;
  min-width: 0;
}

.time {
  margin: 0;
  min-width: 0;
  font: var(--font-caption);
  font-weight: 600;
  color: var(--color-muted-text);
}

.price {
  margin: 0;
  font: var(--font-label);
  font-weight: 700;
  color: var(--color-primary, #0b1f3a);
  white-space: nowrap;
}

.route {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: start;
  column-gap: 6px;
  min-width: 0;
  width: 100%;
  margin: 0;
}

.place {
  min-width: 0;
  max-width: 100%;
  font: var(--font-body);
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.history .place {
  font-weight: 500;
}

.arrow {
  margin-top: 1px;
  color: var(--color-primary-muted, #1a3358);
  font-weight: 600;
  line-height: 1.3;
}

.order-no {
  min-width: 0;
  line-height: 1.3;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.card :deep(.n-button) {
  min-height: 48px;
}

.empty,
.state {
  padding: var(--space-16) 0;
}

.current-empty {
  padding: var(--space-8) 0;
}

.current-empty :deep(.n-empty__icon) {
  margin-bottom: var(--space-4);
}

.state :deep(.n-button) {
  min-height: 48px;
}
</style>
