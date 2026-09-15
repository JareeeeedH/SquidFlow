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
    <header class="page-header">
      <h1>我的訂單</h1>
      <p class="subtitle">目前訂單與歷史訂單</p>
    </header>

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
            class="empty"
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
                  </div>
                  <div class="route">
                    <p class="place">{{ order.pickup_location }}</p>
                    <p class="arrow" aria-hidden="true">↓</p>
                    <p class="place">{{ formatOptionalText(order.destination) }}</p>
                  </div>
                  <p class="order-no">{{ order.order_no }}</p>
                  <div class="meta">
                    <span class="price">{{ formatPrice(order.price) }}</span>
                  </div>
                </button>
                <NButton
                  v-if="order.status === 'ACCEPTED'"
                  size="large"
                  type="primary"
                  block
                  :loading="actingId === order.id"
                  :disabled="acting"
                  @click="startOrder(order)"
                >
                  {{ actingId === order.id ? '開始中...' : '開始行程' }}
                </NButton>
                <NButton
                  v-else-if="order.status === 'IN_PROGRESS'"
                  size="large"
                  type="primary"
                  block
                  :loading="actingId === order.id"
                  :disabled="acting"
                  @click="completeOrder(order)"
                >
                  {{ actingId === order.id ? '完成中...' : '完成訂單' }}
                </NButton>
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
                <div class="card-top">
                  <p class="time">{{ historyDate(order.created_at) }}</p>
                  <OrderStatusTag :status="order.status" />
                </div>
                <div class="route">
                  <p class="place">{{ order.pickup_location }}</p>
                  <p class="arrow" aria-hidden="true">↓</p>
                  <p class="place">{{ formatOptionalText(order.destination) }}</p>
                </div>
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
  gap: var(--space-16);
}

.page :deep(.n-spin-container),
.page :deep(.n-spin-content) {
  overflow: visible;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

h1 {
  margin: 0;
  font: var(--font-page-title);
}

h2 {
  margin: 0 0 var(--space-8);
  font: var(--font-section-title);
}

.subtitle,
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
}

.history-group {
  padding-top: var(--space-8);
  border-top: 1px solid var(--color-border);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-12);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  padding: var(--space-16);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
}

.card.current[data-status='ACCEPTED'] {
  --status-color: var(--color-info);
}

.card.current[data-status='IN_PROGRESS'] {
  --status-color: var(--color-primary);
}

.card.current {
  box-shadow: inset 4px 0 0 var(--status-color);
  border-color: color-mix(in srgb, var(--status-color) 28%, var(--color-border));
}

.card-main,
.history {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-8);
  padding: 0;
  text-align: left;
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.history {
  gap: var(--space-4);
  padding: var(--space-12) var(--space-16);
  background: color-mix(in srgb, var(--color-muted-text) 5%, var(--color-surface));
}

.history:focus-visible,
.card-main:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.time {
  margin: 0;
  font: var(--font-label);
  font-weight: 600;
}

.route {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.place {
  margin: 0;
  font: var(--font-body);
  font-weight: 600;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history .place {
  font-weight: 500;
}

.arrow {
  line-height: 1.1;
}

.meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-8);
  font: var(--font-label);
  color: var(--color-muted-text);
}

.price {
  font: var(--font-section-title);
  color: var(--color-text);
}

.card :deep(.n-button) {
  min-height: 52px;
}

.empty,
.state {
  padding: var(--space-16) 0;
}

.state :deep(.n-button) {
  min-height: 48px;
}
</style>
