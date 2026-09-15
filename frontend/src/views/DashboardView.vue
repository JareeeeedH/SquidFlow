<script setup lang="ts">
import { RotateCcw, User, UserX } from 'lucide-vue-next'
import { NButton, NResult, NSpin } from 'naive-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAdminDashboard } from '../api/dashboard'
import { ApiClientError } from '../api/types'
import type { AdminDashboard, DashboardBoardOrder, OrderStatus } from '../api/types'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import { groupBoardOrders } from '../lib/dashboard'
import { formatOptionalText, formatPrice, formatScheduledAt } from '../lib/format'
import {
  DASHBOARD_BOARD_STATUSES,
  ORDER_STATUSES,
  isOperationalStatus,
} from '../lib/order-status'

const router = useRouter()
const dashboard = ref<AdminDashboard | null>(null)
const loading = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const forbidden = ref(false)

let requestSeq = 0

const groupedBoardOrders = computed(() =>
  groupBoardOrders(dashboard.value?.board_orders ?? []),
)

const boardColumns = computed(() =>
  DASHBOARD_BOARD_STATUSES.map((status) => ({
    status,
    count: dashboard.value?.summary[status] ?? 0,
    orders: groupedBoardOrders.value[status],
  })),
)

function driverLabel(order: DashboardBoardOrder) {
  return order.driver?.username ?? '未指派'
}

function isAssigned(order: DashboardBoardOrder) {
  return Boolean(order.driver?.username)
}

function summaryCount(status: OrderStatus) {
  if (!dashboard.value) {
    return loading.value ? '—' : 0
  }
  return dashboard.value.summary[status]
}

function openOrders(status: OrderStatus) {
  void router.push({ name: 'orders', query: { status } })
}

function openOrder(id: string) {
  void router.push({ name: 'order-detail', params: { id } })
}

async function loadDashboard() {
  const seq = ++requestSeq
  loading.value = true
  error.value = null
  forbidden.value = false

  try {
    const data = await getAdminDashboard()
    if (seq !== requestSeq) {
      return
    }
    dashboard.value = data
  } catch (caught) {
    if (seq !== requestSeq) {
      return
    }
    dashboard.value = null
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

void loadDashboard()
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <h1>Dashboard</h1>
        <p class="subtitle">派車管理</p>
      </div>
    </header>

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
      title="無法載入 Dashboard"
      class="state"
    >
      <template #default>
        <p class="error-detail">{{ error.code }} · {{ error.message }}</p>
      </template>
      <template #footer>
        <NButton type="primary" @click="loadDashboard">
          <template #icon>
            <RotateCcw :size="16" />
          </template>
          重試
        </NButton>
      </template>
    </NResult>

    <NSpin v-else :show="loading">
      <section class="summary" aria-label="訂單狀態統計">
        <h2 class="section-title">狀態總覽</h2>
        <div class="summary-grid">
          <button
            v-for="status in ORDER_STATUSES"
            :key="status"
            class="summary-card"
            :class="{ 'is-operational': isOperationalStatus(status) }"
            :data-status="status"
            type="button"
            @click="openOrders(status)"
          >
            <span class="summary-top">
              <OrderStatusTag :status="status" />
            </span>
            <span class="summary-count">{{ summaryCount(status) }}</span>
          </button>
        </div>
      </section>

      <section class="board" aria-label="派車看板">
        <h2 class="section-title">派車看板</h2>
        <div class="board-grid">
          <div
            v-for="column in boardColumns"
            :key="column.status"
            class="column"
            :data-status="column.status"
          >
            <header class="column-header">
              <div class="column-title">
                <OrderStatusTag :status="column.status" />
              </div>
              <span class="column-count">{{ column.count }}</span>
            </header>
            <div class="column-body">
              <p
                v-if="!loading && column.orders.length === 0"
                class="column-empty"
              >
                目前沒有訂單
              </p>
              <button
                v-for="order in column.orders"
                :key="order.id"
                class="order-card"
                type="button"
                @click="openOrder(order.id)"
              >
                <div class="card-row">
                  <span class="identity">{{ order.order_no }}<template v-if="order.customer_name"> · {{ order.customer_name }}</template></span>
                  <span class="price">{{ formatPrice(order.price) }}</span>
                </div>
                <p class="route">
                  {{ order.pickup_location }}
                  <span class="arrow">→</span>
                  {{ formatOptionalText(order.destination) }}
                </p>
                <p class="meta">
                  <span class="time">{{ formatScheduledAt(order.created_at) }}</span>
                  <span class="sep">·</span>
                  <span
                    class="driver"
                    :class="isAssigned(order) ? 'is-assigned' : 'is-unassigned'"
                  >
                    <User v-if="isAssigned(order)" :size="12" />
                    <UserX v-else :size="12" />
                    {{ driverLabel(order) }}
                  </span>
                </p>
              </button>
            </div>
          </div>
        </div>
      </section>
    </NSpin>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-24);
  min-width: 0;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-16);
}

h1 {
  margin: 0;
  font: var(--font-page-title);
}

.subtitle {
  margin: var(--space-4) 0 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.section-title {
  margin: 0 0 var(--space-12);
  font: var(--font-section-title);
}

.state {
  padding: var(--space-32) var(--space-16);
}

.error-detail {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.summary-grid,
.board-grid {
  display: grid;
  gap: var(--space-12);
}

.summary-grid {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.board-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: stretch;
}

.summary-card,
.column,
.order-card {
  --status-color: var(--color-muted-text);
}

.summary-card[data-status='OPEN'],
.column[data-status='OPEN'] {
  --status-color: var(--color-warning);
}

.summary-card[data-status='ACCEPTED'],
.column[data-status='ACCEPTED'] {
  --status-color: var(--color-info);
}

.summary-card[data-status='IN_PROGRESS'],
.column[data-status='IN_PROGRESS'] {
  --status-color: var(--color-primary);
}

.summary-card[data-status='COMPLETED'] {
  --status-color: var(--color-success);
}

.summary-card[data-status='CANCELLED'] {
  --status-color: var(--color-danger);
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  align-items: flex-start;
  min-height: 96px;
  padding: var(--space-16);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  box-shadow: inset 0 3px 0 var(--status-color);
  cursor: pointer;
  text-align: left;
  color: var(--color-text);
}

.summary-card.is-operational {
  background: color-mix(in srgb, var(--status-color) 8%, var(--color-surface));
  border-color: color-mix(in srgb, var(--status-color) 35%, var(--color-border));
}

.summary-card:hover,
.summary-card:focus-visible {
  border-color: var(--status-color);
}

.summary-card:focus-visible,
.order-card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.summary-top {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.summary-count {
  font: var(--font-price);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.summary-card.is-operational .summary-count {
  color: var(--status-color);
}

.column {
  min-width: 0;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  overflow: hidden;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding: var(--space-12) var(--space-16);
  background: color-mix(in srgb, var(--status-color) 8%, var(--color-surface));
  border-bottom: 1px solid var(--color-border);
}

.column-title {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
}

.column-count {
  flex-shrink: 0;
  min-width: 24px;
  padding: 0 var(--space-8);
  border-radius: var(--radius-8);
  background: var(--color-surface);
  color: var(--color-text);
  font: var(--font-label);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.column-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-8);
  flex: 1;
}

.column-empty {
  margin: auto 0;
  padding: var(--space-24) var(--space-8);
  color: var(--color-muted-text);
  font: var(--font-caption);
  text-align: center;
}

.order-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  padding: var(--space-8);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--status-color);
  border-radius: var(--radius-8);
  cursor: pointer;
  text-align: left;
  color: var(--color-text);
}

.order-card:hover,
.order-card:focus-visible {
  border-color: var(--status-color);
  background: var(--color-surface);
}

.card-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-8);
  min-width: 0;
}

.identity,
.route,
.meta {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity {
  font: var(--font-label);
}

.price {
  flex-shrink: 0;
  font: var(--font-label);
  font-variant-numeric: tabular-nums;
}

.route,
.meta {
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.arrow,
.sep {
  margin: 0 var(--space-4);
}

.meta {
  display: flex;
  align-items: center;
}

.time {
  flex-shrink: 0;
}

.driver {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.driver.is-assigned {
  color: var(--color-text);
}

.driver.is-unassigned {
  color: var(--color-muted-text);
}

@media (max-width: 1280px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .board-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  h1 {
    font-size: 24px;
  }

  .page {
    gap: var(--space-16);
  }

  .summary-grid,
  .board-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .summary-grid,
  .board-grid {
    grid-template-columns: 1fr;
  }
}
</style>
