<script setup lang="ts">
import { Search, RotateCcw } from 'lucide-vue-next'
import {
  NButton,
  NDataTable,
  NDatePicker,
  NEmpty,
  NInput,
  NResult,
  NSelect,
  type DataTableColumns,
} from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { listOrders } from '../api/orders'
import { ApiClientError } from '../api/types'
import type { OrderListItem, OrderListQuery, OrderStatus } from '../api/types'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import { formatPrice, formatScheduledAt, formatTaipeiYmd } from '../lib/format'

const STATUS_OPTIONS: { label: string; value: OrderStatus }[] = [
  { label: '草稿', value: 'DRAFT' },
  { label: '搶單中', value: 'OPEN' },
  { label: '已接單', value: 'ACCEPTED' },
  { label: '行程中', value: 'IN_PROGRESS' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
]

const router = useRouter()
const searchInput = ref('')
const appliedSearch = ref('')
const status = ref<OrderStatus | null>(null)
const dateValue = ref<number | null>(null)
const orders = ref<OrderListItem[]>([])
const loading = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const forbidden = ref(false)

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
    status.value !== null ||
    dateValue.value !== null,
)

const columns: DataTableColumns<OrderListItem> = [
  {
    title: '訂單編號',
    key: 'order_no',
    width: 168,
    ellipsis: { tooltip: true },
  },
  {
    title: '預約時間',
    key: 'scheduled_at',
    width: 112,
    render(row) {
      return formatScheduledAt(row.scheduled_at)
    },
  },
  {
    title: '客戶',
    key: 'customer_name',
    width: 112,
    ellipsis: { tooltip: true },
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
  },
  {
    title: '車型',
    key: 'vehicle_type',
    width: 88,
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
            void router.push({ name: 'order-placeholder', params: { id: row.id } })
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
      <p v-if="!error && !loading" class="count">{{ orders.length }} 筆</p>
    </header>

    <div class="toolbar">
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
        placeholder="預約日期"
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

      <NDataTable
        v-else
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

@media (max-width: 900px) {
  .search,
  .status-filter,
  .date-filter {
    max-width: none;
    width: 100%;
    flex: 1 1 100%;
  }

  h1 {
    font-size: 24px;
  }
}
</style>
