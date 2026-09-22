<script setup lang="ts">
import { Plus, RotateCcw } from 'lucide-vue-next'
import {
  NButton,
  NDataTable,
  NEmpty,
  NResult,
  NSpin,
  type DataTableColumns,
} from 'naive-ui'
import { h, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listDrivers } from '../api/drivers'
import { ApiClientError } from '../api/types'
import type { DriverItem } from '../api/types'
import AccountStatusTag from '../components/AccountStatusTag.vue'
import OnlineStatusTag from '../components/OnlineStatusTag.vue'

const router = useRouter()
const drivers = ref<DriverItem[]>([])
const loading = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const forbidden = ref(false)

let requestSeq = 0

function openDriver(id: string) {
  void router.push({ name: 'driver-detail', params: { id } })
}

const columns: DataTableColumns<DriverItem> = [
  {
    title: '帳號',
    key: 'username',
    width: 168,
    ellipsis: { tooltip: true },
    render(row) {
      return h('span', { class: 'username-cell' }, row.username)
    },
  },
  {
    title: '上線狀態',
    key: 'online_status',
    width: 112,
    render(row) {
      return h('div', { class: 'status-cell status-cell-online' }, [
        h(OnlineStatusTag, { status: row.online_status }),
      ])
    },
  },
  {
    title: '車牌',
    key: 'license_plate',
    width: 128,
    render(row) {
      return h('span', { class: 'plate-cell' }, row.license_plate)
    },
  },
  {
    title: '車輛',
    key: 'vehicle',
    minWidth: 200,
    ellipsis: { tooltip: true },
    render(row) {
      return h('div', { class: 'vehicle-cell' }, [
        h(
          'span',
          { class: 'vehicle-name' },
          `${row.vehicle_brand} ${row.vehicle_model}`,
        ),
        h(
          'span',
          { class: 'vehicle-meta' },
          row.vehicle_color,
        ),
      ])
    },
  },
  {
    title: '帳號狀態',
    key: 'status',
    width: 112,
    render(row) {
      return h('div', { class: 'status-cell status-cell-account' }, [
        h(AccountStatusTag, { status: row.status }),
      ])
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 88,
    fixed: 'right',
    render(row) {
      return h('div', { class: 'row-actions' }, [
        h(
          NButton,
          {
            size: 'small',
            tertiary: true,
            type: 'primary',
            onClick: () => openDriver(row.id),
          },
          { default: () => '查看' },
        ),
      ])
    },
  },
]

async function loadDrivers() {
  const seq = ++requestSeq
  loading.value = true
  error.value = null
  forbidden.value = false

  try {
    const data = await listDrivers()
    if (seq !== requestSeq) {
      return
    }
    drivers.value = data
  } catch (caught) {
    if (seq !== requestSeq) {
      return
    }
    drivers.value = []
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

void loadDrivers()
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <h1>司機管理</h1>
        <p class="subtitle">管理司機帳號、車輛與上線狀態</p>
      </div>
      <div class="header-actions">
        <p v-if="!error && !loading" class="count">{{ drivers.length }} 位</p>
        <NButton type="primary" @click="router.push({ name: 'driver-create' })">
          <template #icon>
            <Plus :size="16" />
          </template>
          新增司機
        </NButton>
      </div>
    </header>

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
        title="無法載入司機"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error.code }} · {{ error.message }}</p>
        </template>
        <template #footer>
          <NButton type="primary" @click="loadDrivers">
            <template #icon>
              <RotateCcw :size="16" />
            </template>
            重試
          </NButton>
        </template>
      </NResult>

      <template v-else>
        <NDataTable
          class="drivers-table"
          :columns="columns"
          :data="drivers"
          :loading="loading"
          :bordered="false"
          :single-line="false"
          :scroll-x="980"
          size="small"
        >
          <template #empty>
            <NEmpty description="目前沒有司機" />
          </template>
        </NDataTable>

        <NSpin :show="loading" class="drivers-cards-wrap">
          <div class="drivers-cards">
            <NEmpty
              v-if="!loading && drivers.length === 0"
              description="目前沒有司機"
            />
            <button
              v-for="driver in drivers"
              :key="driver.id"
              class="driver-card"
              type="button"
              @click="openDriver(driver.id)"
            >
              <div class="card-row card-row-top">
                <span class="username-cell">{{ driver.username }}</span>
                <span class="card-badges">
                  <OnlineStatusTag :status="driver.online_status" />
                  <AccountStatusTag :status="driver.status" />
                </span>
              </div>
              <p class="card-meta">
                <span class="plate-cell">{{ driver.license_plate }}</span>
                <span class="sep">·</span>
                <span class="vehicle-inline">
                  {{ driver.vehicle_brand }} {{ driver.vehicle_model }}
                </span>
                <span class="sep">·</span>
                <span class="vehicle-color">{{ driver.vehicle_color }}</span>
              </p>
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
  flex-shrink: 0;
}

.count {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-label);
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

.panel :deep(.n-data-table-th) {
  font: var(--font-caption);
  font-weight: 500;
  color: var(--color-muted-text);
  background: var(--color-background);
  padding: 10px 16px;
}

.panel :deep(.n-data-table-td) {
  padding: 12px 16px;
  vertical-align: middle;
}

.panel :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
}

.username-cell {
  font: var(--font-label);
  color: var(--color-text);
}

.plate-cell {
  margin: 0;
  font: var(--font-label);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.vehicle-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.vehicle-name {
  font: var(--font-label);
}

.vehicle-meta {
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.status-cell {
  display: flex;
  align-items: center;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-4);
}

.drivers-cards-wrap {
  display: none;
}

.drivers-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-4);
}

.driver-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 100%;
  min-height: 72px;
  max-height: 80px;
  padding: 10px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  cursor: pointer;
  text-align: left;
  color: var(--color-text);
}

.driver-card:hover,
.driver-card:focus-visible {
  border-color: var(--color-primary);
}

.card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-width: 0;
}

.card-badges {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  flex-shrink: 0;
}

.card-badges :deep(.n-tag) {
  height: 22px;
  padding: 0 7px;
  font-size: 12px;
  line-height: 22px;
}

.card-meta {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
  margin: 0;
  min-width: 0;
  overflow: hidden;
  color: var(--color-muted-text);
  font: var(--font-caption);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.card-meta .plate-cell {
  flex-shrink: 0;
  font: var(--font-caption);
  font-weight: 500;
  color: var(--color-text);
}

.vehicle-inline,
.vehicle-color {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sep {
  flex-shrink: 0;
  margin: 0;
}

@media (max-width: 900px) {
  h1 {
    font-size: 22px;
  }

  .subtitle {
    display: none;
  }

  .page {
    gap: var(--space-16);
  }

  .page-header {
    align-items: center;
  }

  .header-actions {
    justify-content: space-between;
  }

  .drivers-table {
    display: none;
  }

  .drivers-cards-wrap {
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
