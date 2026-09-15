<script setup lang="ts">
import { ArrowLeft, RotateCcw } from 'lucide-vue-next'
import { NButton, NResult, NSpin } from 'naive-ui'
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { acceptDriverOrder, getDriverOrder } from '../api/driver-orders'
import { ApiClientError } from '../api/types'
import type { DriverOrderDetail } from '../api/types'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import { formatPrice, formatScheduledAt } from '../lib/format'

const route = useRoute()
const router = useRouter()
const order = ref<DriverOrderDetail | null>(null)
const loading = ref(false)
const accepting = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const actionError = ref<{ code: string; message: string } | null>(null)
const successMessage = ref<string | null>(null)
const notFound = ref(false)
const forbidden = ref(false)

let requestSeq = 0

function captureError(caught: unknown) {
  if (caught instanceof ApiClientError) {
    return { code: caught.code, message: caught.message }
  }
  return { code: 'INTERNAL_ERROR', message: '系統發生錯誤' }
}

async function loadOrder() {
  const id = String(route.params.id ?? '')
  const seq = ++requestSeq
  loading.value = true
  error.value = null
  notFound.value = false
  forbidden.value = false

  try {
    const data = await getDriverOrder(id)
    if (seq !== requestSeq) {
      return
    }
    order.value = data
  } catch (caught) {
    if (seq !== requestSeq) {
      return
    }
    order.value = null
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

async function acceptOrder() {
  if (!order.value || accepting.value || order.value.status !== 'OPEN') {
    return
  }

  accepting.value = true
  actionError.value = null
  successMessage.value = null

  try {
    await acceptDriverOrder(order.value.id)
    successMessage.value = '接單成功'
    await loadOrder()
  } catch (caught) {
    actionError.value = captureError(caught)
    if (
      actionError.value.code === 'ORDER_ALREADY_ACCEPTED' ||
      actionError.value.code === 'INVALID_ORDER_STATUS'
    ) {
      await loadOrder()
    }
  } finally {
    accepting.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    actionError.value = null
    successMessage.value = null
    void loadOrder()
  },
  { immediate: true },
)
</script>

<template>
  <section class="page">
    <NButton
      class="back"
      text
      type="primary"
      size="large"
      @click="router.push({ name: 'driver-open-orders' })"
    >
      <template #icon>
        <ArrowLeft :size="18" />
      </template>
      返回可搶訂單
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
        v-else-if="notFound && !actionError"
        status="404"
        title="找不到訂單"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error?.code }} · {{ error?.message }}</p>
        </template>
      </NResult>

      <NResult
        v-else-if="notFound && actionError"
        status="warning"
        title="此訂單已被其他司機接走"
        class="state"
      >
        <template #default>
          <p class="error-detail">
            {{ actionError.code }} · {{ actionError.message }}
          </p>
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
          <NButton size="large" type="primary" block @click="loadOrder">
            <template #icon>
              <RotateCcw :size="18" />
            </template>
            重試
          </NButton>
        </template>
      </NResult>

      <article v-else-if="order" class="card">
        <header class="header">
          <p class="kicker">{{ order.order_no }}</p>
          <OrderStatusTag :status="order.status" />
        </header>
        <p class="time">{{ formatScheduledAt(order.scheduled_at) }}</p>
        <dl class="fields">
          <div>
            <dt>客戶</dt>
            <dd>{{ order.customer_name }}</dd>
          </div>
          <div class="route">
            <dt>行程</dt>
            <dd>
              <span>{{ order.pickup_location }}</span>
              <span class="arrow">↓</span>
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

        <p v-if="successMessage" class="success">{{ successMessage }}</p>
        <p v-if="actionError" class="action-error">
          {{ actionError.code }} · {{ actionError.message }}
        </p>

        <NButton
          v-if="order.status === 'OPEN'"
          class="accept"
          size="large"
          type="primary"
          block
          :loading="accepting"
          :disabled="accepting"
          @click="acceptOrder"
        >
          {{ accepting ? '搶單中...' : '我要接單' }}
        </NButton>
      </article>
    </NSpin>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.back {
  align-self: flex-start;
  min-height: 44px;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  padding: var(--space-24);
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-12);
}

.kicker,
.error-detail,
.arrow {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.time {
  margin: var(--space-12) 0 var(--space-24);
  font: var(--font-page-title);
}

.fields {
  display: grid;
  gap: var(--space-16);
  margin: 0;
}

.fields > div {
  display: grid;
  gap: var(--space-4);
}

dt {
  font: var(--font-label);
  color: var(--color-muted-text);
}

dd {
  margin: 0;
}

.arrow {
  display: block;
  margin: var(--space-4) 0;
}

.price {
  font: var(--font-price);
}

.success {
  margin: var(--space-16) 0 0;
  color: var(--color-success);
  font: var(--font-label);
}

.action-error {
  margin: var(--space-16) 0 0;
  color: var(--color-danger);
  font: var(--font-caption);
}

.accept {
  margin-top: var(--space-16);
  min-height: 48px;
}

.state {
  padding: var(--space-32) 0;
}

.state :deep(.n-button) {
  min-height: 48px;
}
</style>
