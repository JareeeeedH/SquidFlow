<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { NButton, NEmpty, NResult } from 'naive-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAdminDashboard } from '../api/dashboard'
import { ApiClientError } from '../api/types'
import type { AdminDashboard, DashboardBoardOrder, OrderStatus } from '../api/types'
import { groupBoardOrders } from '../lib/dashboard'
import { formatPrice, formatScheduledAt } from '../lib/format'
import {
  DASHBOARD_BOARD_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
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
    label: ORDER_STATUS_LABELS[status],
    count: dashboard.value?.summary[status] ?? 0,
    orders: groupedBoardOrders.value[status],
  })),
)

function driverLabel(order: DashboardBoardOrder) {
  return order.driver?.username ?? '未指派'
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

    <template v-else>
      <section class="summary" aria-label="訂單狀態統計">
        <button
          v-for="status in ORDER_STATUSES"
          :key="status"
          class="summary-card"
          type="button"
          @click="openOrders(status)"
        >
          <span class="summary-label">{{ ORDER_STATUS_LABELS[status] }}</span>
          <span class="summary-count">{{ dashboard?.summary[status] ?? (loading ? '—' : 0) }}</span>
        </button>
      </section>

      <section class="board" aria-label="派車看板">
        <div
          v-for="column in boardColumns"
          :key="column.status"
          class="column"
        >
          <header class="column-header">
            <h2>{{ column.label }}</h2>
            <span>{{ column.count }}</span>
          </header>
          <div class="column-body">
            <NEmpty
              v-if="!loading && column.orders.length === 0"
              description="目前沒有訂單"
            />
            <button
              v-for="order in column.orders"
              :key="order.id"
              class="order-card"
              type="button"
              @click="openOrder(order.id)"
            >
              <div class="card-row">
                <span class="order-no">{{ order.order_no }}</span>
                <span class="price">{{ formatPrice(order.price) }}</span>
              </div>
              <p class="customer">{{ order.customer_name }}</p>
              <p class="route">
                {{ order.pickup_location }}
                <span class="arrow">→</span>
                {{ order.destination }}
              </p>
              <div class="card-row meta">
                <span>{{ formatScheduledAt(order.scheduled_at) }}</span>
                <span>{{ driverLabel(order) }}</span>
              </div>
            </button>
          </div>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
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

.state {
  padding: var(--space-32) var(--space-16);
}

.error-detail {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.summary {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--space-12);
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  align-items: flex-start;
  padding: var(--space-16);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  cursor: pointer;
  text-align: left;
}

.summary-card:hover {
  border-color: var(--color-primary);
}

.summary-label {
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.summary-count {
  font: var(--font-section-title);
  font-variant-numeric: tabular-nums;
}

.board {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-12);
  align-items: start;
}

.column {
  min-width: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  padding: var(--space-12);
}

.column-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-8);
  margin-bottom: var(--space-12);
}

.column-header h2 {
  margin: 0;
  font: var(--font-label);
}

.column-header span {
  color: var(--color-muted-text);
  font: var(--font-caption);
  font-variant-numeric: tabular-nums;
}

.column-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.order-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  width: 100%;
  padding: var(--space-12);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  cursor: pointer;
  text-align: left;
}

.order-card:hover {
  border-color: var(--color-primary);
}

.card-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-8);
}

.order-no {
  font: var(--font-label);
}

.price {
  font: var(--font-label);
  font-variant-numeric: tabular-nums;
}

.customer,
.route {
  margin: 0;
  font: var(--font-caption);
}

.route {
  color: var(--color-muted-text);
}

.arrow {
  margin: 0 var(--space-4);
}

.meta {
  color: var(--color-muted-text);
  font: var(--font-caption);
}

@media (max-width: 1100px) {
  .summary,
  .board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  h1 {
    font-size: 24px;
  }

  .summary,
  .board {
    grid-template-columns: 1fr;
  }
}
</style>
