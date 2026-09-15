<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { NButton, NEmpty, NResult, NSpin } from 'naive-ui'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { listOpenDriverOrders } from '../api/driver-orders'
import { ApiClientError } from '../api/types'
import type { DriverOpenOrder } from '../api/types'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import { formatPrice, formatScheduledAt } from '../lib/format'

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
              <p class="time">{{ formatScheduledAt(order.scheduled_at) }}</p>
              <OrderStatusTag status="OPEN" />
            </div>
            <p class="order-no">{{ order.order_no }}</p>
            <p class="place">{{ order.pickup_location }}</p>
            <p class="arrow">↓</p>
            <p class="place">{{ order.destination }}</p>
            <div class="meta">
              <span>{{ order.vehicle_type }}</span>
              <span class="price">{{ formatPrice(order.price) }}</span>
            </div>
            <p v-if="order.note" class="note">{{ order.note }}</p>
            <span class="view">查看訂單</span>
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
  gap: var(--space-16);
}

h1 {
  margin: 0;
  font: var(--font-page-title);
}

.subtitle,
.error-detail,
.order-no,
.note,
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
  gap: var(--space-12);
}

.card {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-8);
  padding: var(--space-16);
  min-height: 48px;
  text-align: left;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  color: inherit;
  font: inherit;
}

.card:active {
  background: #eff6ff;
}

.card-top {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.time {
  margin: 0;
  font: var(--font-section-title);
}

.place {
  margin: 0;
  font: var(--font-body);
}

.meta {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-8);
  font: var(--font-label);
}

.price {
  font: var(--font-price);
}

.view {
  margin-top: var(--space-4);
  color: var(--color-primary);
  font: var(--font-label);
}

.state {
  padding: var(--space-32) 0;
}

.state :deep(.n-button) {
  min-height: 48px;
}
</style>
