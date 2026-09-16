<script setup lang="ts">
import { Filter, Plus, RotateCcw, Search } from 'lucide-vue-next'
import {
  NButton,
  NDataTable,
  NDatePicker,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NInput,
  NResult,
  NSelect,
  NSpin,
  type DataTableColumns,
} from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listOrders } from '../api/orders'
import { ApiClientError } from '../api/types'
import type { OrderListItem, OrderListQuery, OrderStatus } from '../api/types'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import { formatOptionalText, formatPrice, formatScheduledAt, formatTaipeiYmd } from '../lib/format'
import { ORDER_STATUS_LABELS, ORDER_STATUSES, parseOrderStatus } from '../lib/order-status'

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
const loading = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const forbidden = ref(false)
const filterOpen = ref(false)

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

const activeFilterCount = computed(() => {
  let count = 0
  if (appliedSearch.value) count += 1
  if (status.value) count += 1
  if (dateValue.value !== null) count += 1
  return count
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

function applyDrawerFilters() {
  applySearch()
  filterOpen.value = false
}

function openOrder(id: string) {
  void router.push({ name: 'order-detail', params: { id } })
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

async function loadOrders() {
  const seq = ++requestSeq
  loading.value = true
  error.value = null
  forbidden.value = false

  try {
    const data = await listOrders(query.value)
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

watch(query, () => {
  void loadOrders()
}, { immediate: true })
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <h1>Orders</h1>
        <p class="subtitle">訂單列表</p>
      </div>
      <div class="header-actions">
        <p v-if="!error && !loading" class="count">{{ orders.length }} 筆</p>
        <NButton type="primary" @click="router.push({ name: 'order-create' })">
          <template #icon>
            <Plus :size="16" />
          </template>
          建立訂單
        </NButton>
      </div>
    </header>

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
      <NButton secondary @click="filterOpen = true">
        <template #icon>
          <Filter :size="16" />
        </template>
        篩選
        <span v-if="activeFilterCount" class="filter-badge">{{ activeFilterCount }}</span>
      </NButton>
    </div>

    <NDrawer v-model:show="filterOpen" placement="bottom" :height="360">
      <NDrawerContent title="篩選訂單" closable>
        <div class="drawer-filters">
          <NSelect
            v-model:value="status"
            :options="STATUS_OPTIONS"
            clearable
            placeholder="全部狀態"
          />
          <NDatePicker
            v-model:value="dateValue"
            type="date"
            clearable
            format="yyyy/MM/dd"
            placeholder="建立日期"
            style="width: 100%"
          />
          <div class="drawer-actions">
            <NButton quaternary :disabled="!hasFilters" @click="clearFilters">
              清除
            </NButton>
            <NButton type="primary" @click="applyDrawerFilters">套用</NButton>
          </div>
        </div>
      </NDrawerContent>
    </NDrawer>

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
          <NButton type="primary" @click="loadOrders">
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
          :loading="loading"
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

        <NSpin :show="loading" class="orders-cards-wrap">
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
              <div class="card-top">
                <span class="order-no">{{ order.order_no }}</span>
                <OrderStatusTag :status="order.status" />
              </div>
              <p class="card-customer">{{ formatOptionalText(order.customer_name) }}</p>
              <p class="card-route">
                {{ order.pickup_location }}
                <span class="arrow">→</span>
                {{ formatOptionalText(order.destination) }}
              </p>
              <div class="card-bottom">
                <span class="card-price">{{ formatPrice(order.price) }}</span>
                <span class="card-time">{{ formatScheduledAt(order.created_at) }}</span>
              </div>
            </button>
          </div>
        </NSpin>
      </template>
    </div>
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

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-left: var(--space-4);
  padding: 0 5px;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font: var(--font-caption);
  font-size: 11px;
}

.drawer-filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-8);
}

.panel {
  min-height: 360px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  padding: var(--space-8);
  overflow: hidden;
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
  gap: var(--space-4);
  width: 100%;
  padding: var(--space-12);
  background: var(--color-background);
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

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.order-no {
  font: var(--font-label);
}

.card-customer,
.card-route {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  margin-top: var(--space-4);
}

.card-price {
  font: var(--font-label);
  font-variant-numeric: tabular-nums;
}

.card-time {
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.arrow {
  margin: 0 var(--space-4);
}

@media (max-width: 900px) {
  h1 {
    font-size: 24px;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: space-between;
  }

  .toolbar-desktop {
    display: none;
  }

  .toolbar-mobile {
    display: flex;
    flex-wrap: nowrap;
  }

  .toolbar-mobile .search {
    flex: 1 1 auto;
    max-width: none;
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
