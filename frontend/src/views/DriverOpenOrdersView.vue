<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { NButton, NEmpty, NResult, NSpin } from 'naive-ui'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { listOpenDriverOrders } from '../api/driver-orders'
import { ApiClientError } from '../api/types'
import type { DriverOpenOrder } from '../api/types'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import { formatOptionalText, formatPrice, formatScheduledAt } from '../lib/format'

const router = useRouter()
const orders = ref<DriverOpenOrder[]>([])
const loading = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const forbidden = ref(false)

let requestSeq = 0

async function loadOrders() {
  const seq = ++requestSeq
  loading.value = true
  error.value = null
  forbidden.value = false

  try {
    const data = await listOpenDriverOrders()
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

void loadOrders()
</script>

<template>
  <section class="page">
    <header class="page-header">
      <h1>可搶訂單</h1>
      <p class="subtitle">點選卡片查看行程</p>
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
        title="無法載入可搶訂單"
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

      <NEmpty
        v-else-if="!loading && orders.length === 0"
        description="目前沒有可搶訂單"
        class="state"
      />

      <ul v-else class="list">
        <li v-for="order in orders" :key="order.id">
          <button
            type="button"
            class="card"
            @click="
              router.push({
                name: 'driver-order-detail',
                params: { id: order.id },
              })
            "
          >
            <div class="card-top">
              <p class="time">{{ formatScheduledAt(order.created_at) }}</p>
              <OrderStatusTag status="OPEN" />
              <p class="price">{{ formatPrice(order.price) }}</p>
            </div>
            <p class="route">
              <span class="place">{{ order.pickup_location }}</span>
              <span class="arrow" aria-hidden="true">→</span>
              <span class="place">{{ formatOptionalText(order.destination) }}</span>
            </p>
            <div class="card-foot">
              <p class="order-no">{{ order.order_no }}</p>
              <span class="view">查看 →</span>
            </div>
          </button>
        </li>
      </ul>
    </NSpin>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.page :deep(.n-spin-container),
.page :deep(.n-spin-content) {
  overflow: visible;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

h1 {
  margin: 0;
  font: var(--font-page-title);
  font-size: 24px;
}

.subtitle,
.error-detail,
.order-no,
.arrow {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-8);
}

.card {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 10px 12px;
  min-height: 48px;
  text-align: left;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  box-shadow: var(--shadow-card, 0 1px 2px rgb(11 31 58 / 6%));
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.card:active {
  background: var(--color-primary-soft, #e8eef5);
}

.card:focus-visible {
  outline: 2px solid var(--color-primary, #0b1f3a);
  outline-offset: 2px;
}

.card-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
}

.time {
  margin: 0;
  font: var(--font-caption);
  font-weight: 600;
  color: var(--color-muted-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.price {
  margin: 0;
  font: var(--font-label);
  font-weight: 700;
  color: var(--color-primary, #0b1f3a);
  white-space: nowrap;
}

.route {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin: 0;
}

.place {
  min-width: 0;
  flex: 1 1 0;
  font: var(--font-body);
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  flex: 0 0 auto;
  color: var(--color-primary-muted, #1a3358);
  font-weight: 600;
}

.card-foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-8);
  min-width: 0;
}

.order-no {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}

.view {
  flex: 0 0 auto;
  color: var(--color-primary, #0b1f3a);
  font: var(--font-caption);
  font-weight: 600;
}

.state {
  padding: var(--space-24) 0;
}

.state :deep(.n-button) {
  min-height: 48px;
}
</style>
