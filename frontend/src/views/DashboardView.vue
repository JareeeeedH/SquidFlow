<script setup lang="ts">
import { ChevronDown, RotateCcw, User, UserX } from 'lucide-vue-next'
import { NButton, NResult, NSpin } from 'naive-ui'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAdminDashboard } from '../api/dashboard'
import { ApiClientError } from '../api/types'
import type { AdminDashboard, DashboardBoardOrder, OrderStatus } from '../api/types'
import AdminRefreshButton from '../components/AdminRefreshButton.vue'
import AdminRefreshOverlay from '../components/AdminRefreshOverlay.vue'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import { groupBoardOrders } from '../lib/dashboard'
import { formatOptionalText, formatPrice, formatScheduledAt } from '../lib/format'
import { useListRefreshControl } from '../lib/list-refresh'
import {
  DASHBOARD_BOARD_STATUSES,
  OPERATIONAL_ORDER_STATUSES,
  ORDER_STATUSES,
  isOperationalStatus,
} from '../lib/order-status'
import { useVisiblePolling } from '../lib/visible-polling'

const router = useRouter()
const dashboard = ref<AdminDashboard | null>(null)
const loading = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const forbidden = ref(false)

const {
  canManualRefresh,
  refreshButtonLabel,
  manualUpdating,
  runRefresh,
} = useListRefreshControl()

/** Mobile focus sections: collapsed by default. */
const mobileExpanded = reactive(
  Object.fromEntries(
    OPERATIONAL_ORDER_STATUSES.map((status) => [status, false]),
  ) as Record<(typeof OPERATIONAL_ORDER_STATUSES)[number], boolean>,
)

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

/** Mobile focus board: OPEN / ACCEPTED / IN_PROGRESS only (DRAFT stays on desktop board). */
const MOBILE_FOCUS_PREVIEW_LIMIT = 5

const mobileFocusColumns = computed(() =>
  OPERATIONAL_ORDER_STATUSES.map((status) => {
    const orders = groupedBoardOrders.value[status]
    const count = dashboard.value?.summary[status] ?? 0
    return {
      status,
      count,
      preview: orders.slice(0, MOBILE_FOCUS_PREVIEW_LIMIT),
      showViewAll: count > MOBILE_FOCUS_PREVIEW_LIMIT,
      expanded: mobileExpanded[status],
    }
  }),
)

function toggleMobileFocus(status: (typeof OPERATIONAL_ORDER_STATUSES)[number]) {
  mobileExpanded[status] = !mobileExpanded[status]
}

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

async function loadDashboard(options: { silent?: boolean } = {}): Promise<boolean> {
  const silent = Boolean(options.silent)
  const seq = ++requestSeq
  if (!silent) {
    loading.value = true
    error.value = null
    forbidden.value = false
  }

  try {
    const data = await getAdminDashboard()
    if (seq !== requestSeq) {
      return false
    }
    dashboard.value = data
    error.value = null
    forbidden.value = false
    return true
  } catch (caught) {
    if (seq !== requestSeq) {
      return false
    }
    if (silent) {
      return false
    }
    dashboard.value = null
    if (caught instanceof ApiClientError) {
      if (caught.status === 403 && caught.code === 'FORBIDDEN') {
        forbidden.value = true
      }
      error.value = { code: caught.code, message: caught.message }
      return false
    }
    error.value = { code: 'INTERNAL_ERROR', message: '系統發生錯誤' }
    return false
  } finally {
    if (seq === requestSeq && !silent) {
      loading.value = false
    }
  }
}

function manualRefresh() {
  void runRefresh('manual', () =>
    loadDashboard({ silent: Boolean(dashboard.value) }),
  )
}

function retryLoad() {
  void runRefresh('manual', () => loadDashboard())
}

useVisiblePolling((reason) => {
  void runRefresh('auto', () =>
    loadDashboard({ silent: reason !== 'immediate' }),
  )
})
</script>

<template>
  <section class="page">
    <header class="page-header page-header-desktop">
      <div>
        <h1>Dashboard</h1>
        <p class="subtitle">派車管理</p>
      </div>
      <AdminRefreshButton
        :label="refreshButtonLabel"
        :disabled="!canManualRefresh"
        :spinning="manualUpdating"
        @click="manualRefresh"
      />
    </header>

    <AdminRefreshOverlay :show="manualUpdating">
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
        <NButton type="primary" :disabled="!canManualRefresh" @click="retryLoad">
          <template #icon>
            <RotateCcw :size="16" />
          </template>
          重試
        </NButton>
      </template>
    </NResult>

    <NSpin v-else :show="loading && !manualUpdating">
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

      <section class="board board-desktop" aria-label="派車看板">
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

      <section class="board board-mobile" aria-label="執行中訂單">
        <div class="mobile-board-actions">
          <AdminRefreshButton
            text
            primary
            size="small"
            :label="refreshButtonLabel"
            :disabled="!canManualRefresh"
            :spinning="manualUpdating"
            @click="manualRefresh"
          />
          <NButton text type="primary" size="small" @click="router.push({ name: 'orders' })">
            完整訂單
          </NButton>
        </div>
        <div class="focus-list">
          <div
            v-for="column in mobileFocusColumns"
            :key="column.status"
            class="focus-group"
            :class="{ 'is-expanded': column.expanded }"
            :data-status="column.status"
          >
            <button
              class="focus-group-header"
              type="button"
              :aria-expanded="column.expanded"
              @click="toggleMobileFocus(column.status)"
            >
              <span class="focus-header-main">
                <OrderStatusTag :status="column.status" />
                <span class="column-count">{{ column.count }}</span>
              </span>
              <ChevronDown
                class="focus-chevron"
                :class="{ 'is-open': column.expanded }"
                :size="18"
              />
            </button>
            <div
              class="focus-accordion"
              :class="{ 'is-open': column.expanded }"
              :aria-hidden="column.expanded ? 'false' : 'true'"
            >
              <div class="focus-accordion-panel" :inert="!column.expanded">
                <div class="focus-group-body">
                  <p
                    v-if="!loading && column.preview.length === 0"
                    class="column-empty focus-empty"
                  >
                    目前沒有訂單
                  </p>
                  <button
                    v-for="order in column.preview"
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
                  <button
                    v-if="column.showViewAll"
                    class="view-all"
                    type="button"
                    @click="openOrders(column.status)"
                  >
                    查看全部 {{ column.count }} →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      </NSpin>
    </AdminRefreshOverlay>
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
.focus-group,
.order-card {
  --status-color: var(--color-muted-text);
}

.summary-card[data-status='OPEN'],
.column[data-status='OPEN'],
.focus-group[data-status='OPEN'] {
  --status-color: var(--color-warning);
}

.summary-card[data-status='ACCEPTED'],
.column[data-status='ACCEPTED'],
.focus-group[data-status='ACCEPTED'] {
  --status-color: var(--color-info);
}

.summary-card[data-status='IN_PROGRESS'],
.column[data-status='IN_PROGRESS'],
.focus-group[data-status='IN_PROGRESS'] {
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

.board-mobile {
  display: none;
}

.mobile-board-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-8);
  margin-bottom: var(--space-8);
}

.focus-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.focus-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
}

.focus-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  width: 100%;
  padding: var(--space-8);
  border: none;
  border-radius: var(--radius-8);
  background: transparent;
  cursor: pointer;
  color: inherit;
  text-align: left;
}

.focus-group-header:hover,
.focus-group-header:focus-visible {
  background: color-mix(in srgb, var(--status-color) 8%, transparent);
}

.focus-group-header:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.focus-header-main {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
}

.focus-chevron {
  flex-shrink: 0;
  color: var(--color-muted-text);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.focus-chevron.is-open {
  transform: rotate(180deg);
}

.focus-accordion {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.focus-accordion.is-open {
  grid-template-rows: 1fr;
}

.focus-accordion-panel {
  min-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.focus-accordion.is-open .focus-accordion-panel {
  opacity: 1;
}

.focus-group-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: 0 var(--space-4) var(--space-4);
}

.focus-empty {
  padding: var(--space-12) var(--space-8);
}

@media (prefers-reduced-motion: reduce) {
  .focus-chevron,
  .focus-accordion,
  .focus-accordion-panel {
    transition: none;
  }
}

.view-all {
  margin-top: var(--space-4);
  padding: var(--space-8);
  border: none;
  border-radius: var(--radius-8);
  background: transparent;
  color: var(--color-primary);
  font: var(--font-label);
  text-align: left;
  cursor: pointer;
}

.view-all:hover,
.view-all:focus-visible {
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.view-all:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
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
  .page {
    gap: var(--space-16);
  }

  .page-header-desktop {
    display: none;
  }

  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-8);
  }

  .summary-card {
    min-height: 72px;
    padding: var(--space-12);
    gap: var(--space-8);
  }

  .summary-count {
    font-size: 18px;
  }

  .board-desktop {
    display: none;
  }

  .board-mobile {
    display: block;
  }
}
</style>
