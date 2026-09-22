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
  min-width: 0;
  max-width: 100%;
}

.page :deep(.n-spin-container),
.page :deep(.n-spin-content) {
  overflow: visible;
  min-width: 0;
  max-width: 100%;
}

.page-header {
  min-width: 0;
}

h1 {
  margin: 0;
  font: var(--font-page-title);
  font-size: 24px;
  letter-spacing: -0.02em;
  background: linear-gradient(115deg, #ffffff 10%, #93c5fd 55%, #818cf8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

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
  min-width: 0;
}

.card {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 12px 14px;
  min-height: 48px;
  text-align: left;
  background: var(--driver-surface-card, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    var(--shadow-card, 0 10px 28px rgba(8, 12, 24, 0.28));
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}

.card:hover,
.card:focus-visible {
  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
  box-shadow:
    0 0 18px rgba(59, 130, 246, 0.14),
    var(--shadow-card, 0 10px 28px rgba(8, 12, 24, 0.28));
  transform: translateY(-1px);
}

.card:active {
  background: var(--driver-surface-elevated, var(--color-primary-soft));
  transform: translateY(0);
}

.card:focus-visible {
  outline: 2px solid var(--color-primary);
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
  min-width: 0;
  font: var(--font-caption);
  font-weight: 600;
  color: rgba(203, 213, 225, 0.85);
}

.price {
  margin: 0;
  font: var(--font-label);
  font-weight: 700;
  color: #93c5fd;
  white-space: nowrap;
}

.route {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: start;
  column-gap: 6px;
  min-width: 0;
  width: 100%;
  margin: 0;
}

.place {
  min-width: 0;
  max-width: 100%;
  font: var(--font-body);
  font-weight: 600;
  line-height: 1.3;
  color: #f1f5f9;
  overflow-wrap: anywhere;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.arrow {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--color-primary-muted);
  font-weight: 600;
  line-height: 1.3;
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
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.view {
  flex: 0 0 auto;
  color: #93c5fd;
  font: var(--font-caption);
  font-weight: 600;
}

.state {
  padding: var(--space-24) 0;
}

.state :deep(.n-button) {
  min-height: 48px;
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none !important;
  }

  .card:hover,
  .card:focus-visible,
  .card:active {
    transform: none;
  }
}
</style>
