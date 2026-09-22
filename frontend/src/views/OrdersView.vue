<script setup lang="ts">
import { Plus, RotateCcw, Search } from 'lucide-vue-next'
import {
  NButton,
  NDataTable,
  NDatePicker,
  NEmpty,
  NInput,
  NResult,
  NSelect,
  NSpin,
  type DataTableColumns,
} from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAdminDashboard } from '../api/dashboard'
import { listOrders } from '../api/orders'
import { ApiClientError } from '../api/types'
import type {
  AdminDashboard,
  OrderListItem,
  OrderListQuery,
  OrderStatus,
} from '../api/types'
import AdminRefreshButton from '../components/AdminRefreshButton.vue'
import AdminRefreshOverlay from '../components/AdminRefreshOverlay.vue'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import { formatOptionalText, formatPrice, formatScheduledAt, formatTaipeiYmd } from '../lib/format'
import { useListRefreshControl } from '../lib/list-refresh'
import { ORDER_STATUS_LABELS, ORDER_STATUSES, parseOrderStatus } from '../lib/order-status'
import { useVisiblePolling } from '../lib/visible-polling'

const STATUS_OPTIONS: { label: string; value: OrderStatus }[] = ORDER_STATUSES.map(
  (value) => ({
    label: ORDER_STATUS_LABELS[value],
    value,
  }),
)

const route = useRoute()
const router = useRouter()
const searchInput = ref('')
const appliedSearch = ref('')
const status = ref<OrderStatus | null>(parseOrderStatus(route.query.status))
const dateValue = ref<number | null>(null)
const orders = ref<OrderListItem[]>([])
const statusSummary = ref<AdminDashboard['summary'] | null>(null)
const loading = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const forbidden = ref(false)

const {
  canManualRefresh,
  refreshButtonLabel,
  manualUpdating,
  runRefresh,
} = useListRefreshControl()

let requestSeq = 0

const dateYmd = computed(() =>
  dateValue.value == null ? undefined : formatTaipeiYmd(dateValue.value),
)

const query = computed<OrderListQuery>(() => ({
  ...(appliedSearch.value ? { search: appliedSearch.value } : {}),
  ...(status.value ? { status: status.value } : {}),
  ...(dateYmd.value ? { date: dateYmd.value } : {}),
}))

const hasFilters = computed(
  () =>
    Boolean(searchInput.value.trim()) ||
    Boolean(appliedSearch.value) ||
    status.value !== null ||
    dateValue.value !== null,
)

const totalOrderCount = computed(() => {
  if (!statusSummary.value) {
    return null
  }
  return ORDER_STATUSES.reduce(
    (sum, key) => sum + (statusSummary.value?.[key] ?? 0),
    0,
  )
})

const statusChips = computed(() => {
  const summary = statusSummary.value
  return [
    {
      key: 'ALL' as const,
      label: '全部',
      count: totalOrderCount.value,
      value: null as OrderStatus | null,
    },
    ...ORDER_STATUSES.map((value) => ({
      key: value,
      label: ORDER_STATUS_LABELS[value],
      count: summary ? summary[value] : null,
      value,
    })),
  ]
})

const columns: DataTableColumns<OrderListItem> = [
  {
    title: '訂單編號',
    key: 'order_no',
    width: 168,
    ellipsis: { tooltip: true },
  },
  {
    title: '建立時間',
    key: 'created_at',
    width: 112,
    render(row) {
      return formatScheduledAt(row.created_at)
    },
  },
  {
    title: '客戶',
    key: 'customer_name',
    width: 112,
    ellipsis: { tooltip: true },
    render(row) {
      return formatOptionalText(row.customer_name)
    },
  },
  {
    title: '上車地點',
    key: 'pickup_location',
    ellipsis: { tooltip: true },
    minWidth: 140,
  },
  {
    title: '目的地',
    key: 'destination',
    ellipsis: { tooltip: true },
    minWidth: 140,
    render(row) {
      return formatOptionalText(row.destination)
    },
  },
  {
    title: '價格',
    key: 'price',
    width: 120,
    render(row) {
      return h('span', { class: 'price-cell' }, formatPrice(row.price))
    },
  },
  {
    title: '狀態',
    key: 'status',
    width: 104,
    render(row) {
      return h(OrderStatusTag, { status: row.status })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 80,
    render(row) {
      return h(
        NButton,
        {
          text: true,
          type: 'primary',
          size: 'small',
          onClick: () => {
            void router.push({ name: 'order-detail', params: { id: row.id } })
          },
        },
        { default: () => '查看' },
      )
    },
  },
]

function applySearch() {
  appliedSearch.value = searchInput.value.trim()
}

function clearFilters() {
  searchInput.value = ''
  appliedSearch.value = ''
  status.value = null
  dateValue.value = null
}

function selectStatusChip(next: OrderStatus | null) {
  status.value = next
}

function openOrder(id: string) {
  void router.push({ name: 'order-detail', params: { id } })
}

function chipCountLabel(count: number | null) {
  return count == null ? '—' : String(count)
}

async function loadStatusCounts() {
  try {
    const data = await getAdminDashboard()
    statusSummary.value = data.summary
  } catch {
    // Chip counts are supplementary; keep last known summary on failure.
  }
}

async function loadOrders(options: { silent?: boolean } = {}): Promise<boolean> {
  const silent = Boolean(options.silent)
  const seq = ++requestSeq
  if (!silent) {
    loading.value = true
    error.value = null
    forbidden.value = false
  }

  try {
    const data = await listOrders(query.value)
    if (seq !== requestSeq) {
      return false
    }
    orders.value = data
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
    orders.value = []
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

async function refreshOrders(options: { silent?: boolean } = {}): Promise<boolean> {
  const [ordersOk] = await Promise.all([loadOrders(options), loadStatusCounts()])
  return ordersOk
}

function manualRefresh() {
  void runRefresh('manual', () =>
    refreshOrders({ silent: orders.value.length > 0 && !error.value }),
  )
}

function retryLoad() {
  void runRefresh('manual', () => refreshOrders())
}

watch(
  () => route.query.status,
  (raw) => {
    const next = parseOrderStatus(raw)
    if (next !== status.value) {
      status.value = next
    }
  },
)

watch(status, (value) => {
  const current = parseOrderStatus(route.query.status)
  if (current === value) {
    return
  }
  const nextQuery = { ...route.query }
  if (value) {
    nextQuery.status = value
  } else {
    delete nextQuery.status
  }
  void router.replace({ query: nextQuery })
})

watch(query, () => {
  void loadOrders()
})

useVisiblePolling((reason) => {
  void runRefresh('auto', () =>
    refreshOrders({ silent: reason !== 'immediate' }),
  )
})
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div class="page-header-copy">
        <h1>訂單</h1>
      </div>
      <div class="header-actions">
        <p v-if="!error && !loading" class="count count-desktop">{{ orders.length }} 筆</p>
        <AdminRefreshButton
          class="refresh-btn"
          :label="refreshButtonLabel"
          :disabled="!canManualRefresh"
          :spinning="manualUpdating"
          @click="manualRefresh"
        />
        <NButton type="primary" @click="router.push({ name: 'order-create' })">
          <template #icon>
            <Plus :size="16" />
          </template>
          建立訂單
        </NButton>
      </div>
    </header>

    <AdminRefreshOverlay :show="manualUpdating">
    <div class="toolbar toolbar-desktop">
      <NInput
        v-model:value="searchInput"
        class="search"
        clearable
        placeholder="搜尋訂單編號或客戶姓名"
        @keyup.enter="applySearch"
        @clear="applySearch"
      >
        <template #prefix>
          <Search :size="16" class="search-icon" />
        </template>
      </NInput>
      <NSelect
        v-model:value="status"
        class="status-filter"
        :options="STATUS_OPTIONS"
        clearable
        placeholder="全部狀態"
      />
      <NDatePicker
        v-model:value="dateValue"
        class="date-filter"
        type="date"
        clearable
        format="yyyy/MM/dd"
        placeholder="建立日期"
      />
      <NButton
        v-if="hasFilters"
        quaternary
        class="clear"
        @click="clearFilters"
      >
        清除篩選
      </NButton>
    </div>

    <div class="toolbar toolbar-mobile">
      <NInput
        v-model:value="searchInput"
        class="search"
        clearable
        placeholder="搜尋訂單編號或客戶"
        @keyup.enter="applySearch"
        @clear="applySearch"
      >
        <template #prefix>
          <Search :size="16" class="search-icon" />
        </template>
      </NInput>
      <div class="status-chips" role="tablist" aria-label="訂單狀態篩選">
        <button
          v-for="chip in statusChips"
          :key="chip.key"
          class="status-chip"
          type="button"
          role="tab"
          :aria-selected="status === chip.value"
          :class="{ 'is-active': status === chip.value }"
          @click="selectStatusChip(chip.value)"
        >
          <span class="chip-label">{{ chip.label }}</span>
          <span class="chip-count">{{ chipCountLabel(chip.count) }}</span>
        </button>
      </div>
    </div>

    <div class="panel">
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
        title="無法載入訂單"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error.code }} · {{ error.message }}</p>
        </template>
        <template #footer>
          <NButton
            type="primary"
            :disabled="!canManualRefresh"
            @click="retryLoad"
          >
            <template #icon>
              <RotateCcw :size="16" />
            </template>
            重試
          </NButton>
        </template>
      </NResult>

      <template v-else>
        <NDataTable
          class="orders-table"
          :columns="columns"
          :data="orders"
          :loading="loading && !manualUpdating"
          :bordered="false"
          :single-line="false"
          :scroll-x="960"
          size="small"
        >
          <template #empty>
            <NEmpty
              :description="
                hasFilters ? '沒有符合條件的訂單' : '目前沒有訂單'
              "
            />
          </template>
        </NDataTable>

        <NSpin :show="loading && !manualUpdating" class="orders-cards-wrap">
          <div class="orders-cards">
            <NEmpty
              v-if="!loading && orders.length === 0"
              :description="
                hasFilters ? '沒有符合條件的訂單' : '目前沒有訂單'
              "
            />
            <button
              v-for="order in orders"
              :key="order.id"
              class="order-card"
              type="button"
              @click="openOrder(order.id)"
            >
              <div class="card-row card-row-top">
                <span class="order-no">{{ order.order_no }}</span>
                <OrderStatusTag :status="order.status" />
              </div>
              <p class="card-mid">
                <span class="card-customer">{{ formatOptionalText(order.customer_name) }}</span>
                <span class="card-sep">·</span>
                <span class="card-route">
                  {{ order.pickup_location }}
                  <span class="arrow">→</span>
                  {{ formatOptionalText(order.destination) }}
                </span>
              </p>
              <div class="card-row card-row-bottom">
                <span class="card-price">{{ formatPrice(order.price) }}</span>
                <span class="card-time">{{ formatScheduledAt(order.created_at) }}</span>
              </div>
            </button>
          </div>
        </NSpin>
      </template>
    </div>
    </AdminRefreshOverlay>
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
  letter-spacing: -0.02em;
  background: linear-gradient(115deg, #ffffff 10%, #93c5fd 55%, #818cf8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.subtitle {
  margin: var(--space-4) 0 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-16);
}

.count {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-label);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-12);
}

.toolbar-mobile {
  display: none;
}

.search {
  flex: 1 1 240px;
  max-width: 360px;
}

.search-icon {
  color: var(--color-muted-text);
}

.status-filter {
  width: 160px;
}

.date-filter {
  width: 168px;
}

.panel {
  min-height: 360px;
  background: var(--admin-panel, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: var(--space-8);
  overflow: hidden;
  box-shadow: var(--admin-shadow, none);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.state {
  padding: var(--space-32) var(--space-16);
}

.error-detail {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.panel :deep(.price-cell) {
  font: var(--font-label);
  font-variant-numeric: tabular-nums;
}

.panel :deep(.n-data-table-th) {
  font: var(--font-label);
  color: var(--color-muted-text);
}

.orders-cards-wrap {
  display: none;
}

.orders-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-4);
}

.order-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  width: 100%;
  min-height: 84px;
  max-height: 90px;
  padding: 10px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  cursor: pointer;
  text-align: left;
  color: var(--color-text);
}

.order-card:hover,
.order-card:focus-visible {
  border-color: var(--color-primary);
}

.card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-width: 0;
}

.order-no {
  font: var(--font-label);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-mid {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
  margin: 0;
  min-width: 0;
  overflow: hidden;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.card-customer {
  flex-shrink: 0;
  max-width: 28%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-sep {
  flex-shrink: 0;
}

.card-route {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-price {
  font: var(--font-label);
  font-variant-numeric: tabular-nums;
}

.card-time {
  color: var(--color-muted-text);
  font: var(--font-caption);
  flex-shrink: 0;
}

.arrow {
  margin: 0 2px;
}

.status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
  font: var(--font-caption);
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}

.status-chip.is-active {
  border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
  color: #93c5fd;
  box-shadow: 0 0 16px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.chip-count {
  font-variant-numeric: tabular-nums;
  color: var(--color-muted-text);
}

.status-chip.is-active .chip-count {
  color: var(--color-primary);
}

@media (max-width: 900px) {
  h1 {
    font-size: 22px;
  }

  .subtitle {
    display: none;
  }

  .page-header {
    align-items: center;
  }

  .count-desktop {
    display: none;
  }

  .toolbar-desktop {
    display: none;
  }

  .toolbar-mobile {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-8);
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
  }

  .toolbar-mobile .search {
    flex: none;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .page {
    overflow-x: hidden;
  }

  .orders-table {
    display: none;
  }

  .orders-cards-wrap {
    display: block;
  }

  .panel {
    background: transparent;
    border: none;
    padding: 0;
    min-height: 0;
  }
}
</style>
