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
const mobileFocusColumns = computed(() =>
  OPERATIONAL_ORDER_STATUSES.map((status) => {
    const orders = groupedBoardOrders.value[status]
    return {
      status,
      count: dashboard.value?.summary[status] ?? 0,
      orders,
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
      <section class="summary dashboard-section" aria-label="訂單狀態統計">
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

      <section class="board board-desktop dashboard-section" aria-label="派車看板">
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

      <section class="board board-mobile dashboard-section" aria-label="執行中訂單">
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
                    v-if="!loading && column.orders.length === 0"
                    class="column-empty focus-empty"
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
  animation: admin-page-enter 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
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
  letter-spacing: -0.02em;
  background: linear-gradient(115deg, #ffffff 10%, #93c5fd 55%, #818cf8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.subtitle {
  margin: var(--space-4) 0 0;
  color: rgba(203, 213, 225, 0.88);
  font: var(--font-caption);
}

.dashboard-section {
  padding: var(--space-16);
  border-radius: 16px;
  border: 1px solid var(--color-border);
  background: var(--admin-surface-section);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    var(--admin-shadow, 0 12px 32px rgba(8, 12, 24, 0.28));
}

.section-title {
  margin: 0 0 var(--space-12);
  font: var(--font-section-title);
  color: #f8fafc;
  letter-spacing: -0.01em;
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
  --status-color: rgba(148, 163, 184, 0.72);
}

.summary-card[data-status='OPEN'],
.column[data-status='OPEN'],
.focus-group[data-status='OPEN'] {
  --status-color: #d97706;
}

.summary-card[data-status='ACCEPTED'],
.column[data-status='ACCEPTED'],
.focus-group[data-status='ACCEPTED'] {
  --status-color: #38bdf8;
}

.summary-card[data-status='IN_PROGRESS'],
.column[data-status='IN_PROGRESS'],
.focus-group[data-status='IN_PROGRESS'] {
  --status-color: #3b82f6;
}

.summary-card[data-status='COMPLETED'] {
  --status-color: #34d399;
}

.summary-card[data-status='CANCELLED'] {
  --status-color: #f87171;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  align-items: flex-start;
  min-height: 96px;
  padding: var(--space-16);
  background: var(--admin-surface-status);
  border: 1px solid color-mix(in srgb, var(--color-border) 88%, white 12%);
  border-radius: 14px;
  box-shadow:
    inset 0 3px 0 var(--status-color),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    var(--admin-shadow, 0 12px 32px rgba(8, 12, 24, 0.28));
  cursor: pointer;
  text-align: left;
  color: var(--color-text);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
}

.summary-card.is-operational {
  background:
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--status-color) 14%, rgba(48, 62, 94, 0.98)),
      rgba(40, 52, 82, 0.98)
    );
  border-color: color-mix(in srgb, var(--status-color) 38%, var(--color-border));
  box-shadow:
    inset 0 3px 0 var(--status-color),
    0 0 20px color-mix(in srgb, var(--status-color) 16%, transparent),
    var(--admin-shadow, 0 16px 40px rgba(0, 0, 0, 0.35));
}

.summary-card:hover,
.summary-card:focus-visible {
  border-color: color-mix(in srgb, var(--status-color) 55%, var(--color-border));
  transform: translateY(-1px);
  box-shadow:
    inset 0 3px 0 var(--status-color),
    0 0 28px color-mix(in srgb, var(--status-color) 22%, transparent),
    0 18px 44px rgba(0, 0, 0, 0.4);
}

.summary-card:active {
  transform: translateY(0);
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
  color: #f1f5f9;
}

.summary-card.is-operational .summary-count {
  color: var(--status-color);
}

.column {
  min-width: 0;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  background: var(--admin-surface-panel);
  border: 1px solid color-mix(in srgb, var(--color-border) 85%, white 15%);
  border-radius: 14px;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    var(--admin-shadow, 0 12px 32px rgba(8, 12, 24, 0.28));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding: var(--space-12) var(--space-16);
  background: color-mix(in srgb, var(--status-color) 12%, rgba(36, 48, 76, 0.98));
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
  background: rgba(54, 68, 102, 0.55);
  border: 1px solid var(--color-border);
  color: #f8fafc;
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
  background: rgba(30, 40, 64, 0.35);
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
  background: var(--admin-surface-order);
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, white 20%);
  border-left: 3px solid var(--status-color);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  color: var(--color-text);
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}

.order-card:hover,
.order-card:focus-visible {
  border-color: color-mix(in srgb, var(--status-color) 50%, var(--color-border));
  background: var(--admin-surface-order-hover);
  box-shadow: 0 0 16px color-mix(in srgb, var(--status-color) 14%, transparent);
  transform: translateY(-1px);
}

.order-card:active {
  transform: translateY(0);
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
  color: #f1f5f9;
}

.price {
  flex-shrink: 0;
  font: var(--font-label);
  font-variant-numeric: tabular-nums;
  color: #93c5fd;
}

.route,
.meta {
  color: rgba(203, 213, 225, 0.82);
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
  background: var(--admin-surface-panel);
  border: 1px solid color-mix(in srgb, var(--status-color) 32%, var(--color-border));
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    var(--admin-shadow, 0 12px 28px rgba(8, 12, 24, 0.28));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.focus-group.is-expanded {
  box-shadow:
    0 0 20px color-mix(in srgb, var(--status-color) 14%, transparent),
    var(--admin-shadow, 0 12px 28px rgba(0, 0, 0, 0.28));
}

.focus-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  width: 100%;
  min-height: 44px;
  padding: var(--space-8);
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  color: inherit;
  text-align: left;
  transition: background 160ms ease;
}

.focus-group-header:hover,
.focus-group-header:focus-visible {
  background: color-mix(in srgb, var(--status-color) 10%, transparent);
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

@keyframes admin-page-enter {
  from {
    opacity: 0;
    transform: translate3d(0, 10px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .page,
  .summary-card,
  .order-card,
  .focus-group,
  .focus-group-header,
  .focus-chevron,
  .focus-accordion,
  .focus-accordion-panel {
    animation: none !important;
    transition: none !important;
  }

  .summary-card:hover,
  .summary-card:focus-visible,
  .order-card:hover,
  .order-card:focus-visible {
    transform: none;
  }
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

  .dashboard-section {
    padding: var(--space-12);
    border-radius: 14px;
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

  .summary-card:hover,
  .summary-card:focus-visible {
    transform: none;
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
