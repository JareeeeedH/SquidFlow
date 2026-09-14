<script setup lang="ts">
import { ArrowLeft, RotateCcw } from 'lucide-vue-next'
import { NButton, NResult, NSpin } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOrder } from '../api/orders'
import { ApiClientError } from '../api/types'
import type { OrderDetail, OrderStatus } from '../api/types'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import { formatDateTimeTaipei, formatPrice, formatScheduledAt } from '../lib/format'

const READONLY_HINT: Record<OrderStatus, string> = {
  DRAFT: '草稿，目前僅供查看',
  OPEN: '搶單中，目前僅供查看',
  ACCEPTED: '已接單，目前僅供查看',
  IN_PROGRESS: '行程進行中，此訂單為唯讀',
  COMPLETED: '已完成，此訂單為唯讀',
  CANCELLED: '已取消，此訂單為唯讀',
}

const route = useRoute()
const router = useRouter()
const order = ref<OrderDetail | null>(null)
const loading = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const notFound = ref(false)
const forbidden = ref(false)

let requestSeq = 0

const timestamps = computed(() => {
  if (!order.value) {
    return []
  }

  const rows = [
    { label: '建立時間', value: order.value.created_at },
    { label: '更新時間', value: order.value.updated_at },
    { label: '接單時間', value: order.value.accepted_at },
    { label: '開始時間', value: order.value.started_at },
    { label: '完成時間', value: order.value.completed_at },
    { label: '取消時間', value: order.value.cancelled_at },
  ]

  return rows.filter((row) => row.value)
})

async function loadOrder() {
  const id = String(route.params.id ?? '')
  const seq = ++requestSeq
  loading.value = true
  error.value = null
  notFound.value = false
  forbidden.value = false
  order.value = null

  try {
    const data = await getOrder(id)
    if (seq !== requestSeq) {
      return
    }
    order.value = data
  } catch (caught) {
    if (seq !== requestSeq) {
      return
    }
    if (caught instanceof ApiClientError) {
      if (caught.status === 404 && caught.code === 'NOT_FOUND') {
        notFound.value = true
      } else if (caught.status === 403 && caught.code === 'FORBIDDEN') {
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

watch(
  () => route.params.id,
  () => {
    void loadOrder()
  },
  { immediate: true },
)
</script>

<template>
  <section class="page">
    <NButton text type="primary" @click="router.push({ name: 'orders' })">
      <template #icon>
        <ArrowLeft :size="16" />
      </template>
      返回訂單列表
    </NButton>

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
        v-else-if="notFound"
        status="404"
        title="找不到訂單"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error?.code }} · {{ error?.message }}</p>
        </template>
      </NResult>

      <NResult
        v-else-if="error && !order"
        status="error"
        title="無法載入訂單"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error.code }} · {{ error.message }}</p>
        </template>
        <template #footer>
          <NButton type="primary" @click="loadOrder">
            <template #icon>
              <RotateCcw :size="16" />
            </template>
            重試
          </NButton>
        </template>
      </NResult>

      <template v-else-if="order">
        <header class="page-header">
          <div>
            <p class="kicker">訂單詳情</p>
            <h1>{{ order.order_no }}</h1>
            <p class="readonly-hint">{{ READONLY_HINT[order.status] }}</p>
          </div>
          <OrderStatusTag :status="order.status" />
        </header>

        <div class="grid">
          <article class="panel">
            <h2>訂單資訊</h2>
            <dl class="fields">
              <div>
                <dt>客戶</dt>
                <dd>{{ order.customer_name }}</dd>
              </div>
              <div>
                <dt>預約時間</dt>
                <dd>{{ formatScheduledAt(order.scheduled_at) }}</dd>
              </div>
              <div class="route">
                <dt>行程</dt>
                <dd>
                  <span>{{ order.pickup_location }}</span>
                  <span class="route-arrow">↓</span>
                  <span>{{ order.destination }}</span>
                </dd>
              </div>
              <div>
                <dt>車型</dt>
                <dd>{{ order.vehicle_type }}</dd>
              </div>
              <div>
                <dt>價格</dt>
                <dd class="price">{{ formatPrice(order.price) }}</dd>
              </div>
              <div>
                <dt>備註</dt>
                <dd>{{ order.note || '—' }}</dd>
              </div>
            </dl>
          </article>

          <aside class="panel status-panel">
            <h2>訂單狀態</h2>
            <div class="status-block">
              <OrderStatusTag :status="order.status" />
              <p class="driver-label">接單司機</p>
              <p class="driver-value">{{ order.driver_id ? '已指派' : '尚無' }}</p>
            </div>
            <dl v-if="timestamps.length" class="meta">
              <div v-for="row in timestamps" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ formatDateTimeTaipei(row.value as string) }}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </template>
    </NSpin>
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
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-16);
}

.kicker,
.readonly-hint,
.error-detail,
.driver-label {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

h1 {
  margin: var(--space-4) 0;
  font: var(--font-page-title);
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: var(--space-16);
}

.panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  padding: var(--space-24);
}

h2 {
  margin: 0 0 var(--space-16);
  font: var(--font-section-title);
}

.fields,
.meta {
  display: grid;
  gap: var(--space-16);
  margin: 0;
}

.fields > div,
.meta > div {
  display: grid;
  gap: var(--space-4);
}

dt,
.driver-label {
  font: var(--font-label);
  color: var(--color-muted-text);
}

dd {
  margin: 0;
}

.route-arrow {
  display: block;
  color: var(--color-muted-text);
  margin: var(--space-4) 0;
}

.price {
  font: var(--font-price);
}

.status-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-8);
  margin-bottom: var(--space-24);
}

.driver-value {
  margin: 0;
}

.meta {
  padding-top: var(--space-16);
  border-top: 1px solid var(--color-border);
}

.state {
  padding: var(--space-32) 0;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }

  h1 {
    font-size: 24px;
  }
}
</style>
