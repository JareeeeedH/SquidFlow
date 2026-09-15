<script setup lang="ts">
import { ArrowLeft, RotateCcw } from 'lucide-vue-next'
import { NButton, NResult, NSpin } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  acceptDriverOrder,
  completeDriverOrder,
  getDriverOrder,
  startDriverOrder,
} from '../api/driver-orders'
import { ApiClientError } from '../api/types'
import type { DriverOrderDetail } from '../api/types'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import { formatOptionalText, formatPrice, formatScheduledAt } from '../lib/format'

const route = useRoute()
const router = useRouter()
const order = ref<DriverOrderDetail | null>(null)
const loading = ref(false)
const accepting = ref(false)
const starting = ref(false)
const completing = ref(false)
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

const acting = computed(
  () => accepting.value || starting.value || completing.value,
)

const backTarget = computed(() =>
  order.value?.status === 'OPEN'
    ? { name: 'driver-open-orders' as const, label: '返回可搶訂單' }
    : { name: 'driver-my-orders' as const, label: '返回我的訂單' },
)

const hasPrimaryAction = computed(
  () =>
    order.value?.status === 'OPEN' ||
    order.value?.status === 'ACCEPTED' ||
    order.value?.status === 'IN_PROGRESS',
)

async function acceptOrder() {
  if (!order.value || acting.value || order.value.status !== 'OPEN') {
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

async function startOrder() {
  if (!order.value || acting.value || order.value.status !== 'ACCEPTED') {
    return
  }

  starting.value = true
  actionError.value = null
  successMessage.value = null

  try {
    await startDriverOrder(order.value.id)
    successMessage.value = '行程已開始'
    await loadOrder()
  } catch (caught) {
    actionError.value = captureError(caught)
    if (actionError.value.code === 'INVALID_ORDER_STATUS') {
      await loadOrder()
    }
  } finally {
    starting.value = false
  }
}

async function completeOrder() {
  if (!order.value || acting.value || order.value.status !== 'IN_PROGRESS') {
    return
  }

  completing.value = true
  actionError.value = null
  successMessage.value = null

  try {
    await completeDriverOrder(order.value.id)
    successMessage.value = '訂單已完成'
    await loadOrder()
  } catch (caught) {
    actionError.value = captureError(caught)
    if (actionError.value.code === 'INVALID_ORDER_STATUS') {
      await loadOrder()
    }
  } finally {
    completing.value = false
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
      @click="router.push({ name: backTarget.name })"
    >
      <template #icon>
        <ArrowLeft :size="18" />
      </template>
      {{ backTarget.label }}
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
          <div class="header-copy">
            <p class="kicker">{{ order.order_no }}</p>
            <p class="time">{{ formatScheduledAt(order.created_at) }}</p>
          </div>
          <OrderStatusTag :status="order.status" />
        </header>

        <div class="route">
          <p class="place">{{ order.pickup_location }}</p>
          <p class="arrow" aria-hidden="true">↓</p>
          <p class="place">{{ formatOptionalText(order.destination) }}</p>
        </div>

        <div class="price-block">
          <p class="price-label">價格</p>
          <p class="price">{{ formatPrice(order.price) }}</p>
        </div>

        <dl class="fields">
          <div>
            <dt>客戶</dt>
            <dd>{{ formatOptionalText(order.customer_name) }}</dd>
          </div>
          <div class="note-row">
            <dt>備註</dt>
            <dd>{{ formatOptionalText(order.note) }}</dd>
          </div>
        </dl>

        <p v-if="successMessage" class="success">{{ successMessage }}</p>
        <p v-if="actionError" class="action-error">
          {{ actionError.code }} · {{ actionError.message }}
        </p>

        <div v-if="hasPrimaryAction" class="action-dock">
          <NButton
            v-if="order.status === 'OPEN'"
            class="accept"
            size="large"
            type="primary"
            block
            :loading="accepting"
            :disabled="acting"
            @click="acceptOrder"
          >
            {{ accepting ? '搶單中...' : '我要接單' }}
          </NButton>
          <NButton
            v-else-if="order.status === 'ACCEPTED'"
            class="accept"
            size="large"
            type="primary"
            block
            :loading="starting"
            :disabled="acting"
            @click="startOrder"
          >
            {{ starting ? '開始中...' : '開始行程' }}
          </NButton>
          <NButton
            v-else-if="order.status === 'IN_PROGRESS'"
            class="accept"
            size="large"
            type="primary"
            block
            :loading="completing"
            :disabled="acting"
            @click="completeOrder"
          >
            {{ completing ? '完成中...' : '完成訂單' }}
          </NButton>
        </div>
      </article>
    </NSpin>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.back {
  align-self: flex-start;
  min-height: 44px;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  padding: var(--space-16);
  box-shadow: var(--shadow-card, 0 1px 2px rgb(11 31 58 / 6%));
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-12);
}

.header-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kicker,
.error-detail,
.arrow,
.price-label {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.time {
  margin: 0;
  font: var(--font-label);
  font-weight: 600;
  color: var(--color-text);
}

.route {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: var(--space-16) 0;
  padding: var(--space-12);
  background: var(--color-primary-soft, #e8eef5);
  border-radius: var(--radius-8);
  border: 1px solid color-mix(in srgb, var(--color-primary, #0b1f3a) 12%, var(--color-border));
}

.place {
  margin: 0;
  font: var(--font-section-title);
  line-height: 1.35;
  color: var(--color-primary, #0b1f3a);
  overflow-wrap: anywhere;
}

.arrow {
  display: block;
  margin: var(--space-4) 0;
  line-height: 1.1;
  color: var(--color-primary-muted, #1a3358);
  font-weight: 700;
}

.price-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--space-12);
}

.price {
  margin: 0;
  font: var(--font-price);
  font-size: 24px;
  color: var(--color-primary, #0b1f3a);
}

.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12) var(--space-16);
  margin: 0;
  padding-top: var(--space-12);
  border-top: 1px solid var(--color-border);
}

.fields > div {
  display: grid;
  gap: var(--space-4);
}

.note-row {
  grid-column: 1 / -1;
}

dt {
  font: var(--font-label);
  color: var(--color-muted-text);
}

dd {
  margin: 0;
}

.success,
.action-error {
  margin: var(--space-12) 0 0;
  padding: var(--space-12);
  border-radius: var(--radius-8);
  font: var(--font-label);
}

.success {
  background: color-mix(in srgb, var(--color-success) 10%, var(--color-surface));
  color: var(--color-success);
}

.action-error {
  background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface));
  color: var(--color-danger);
  font: var(--font-caption);
}

.action-dock {
  position: sticky;
  bottom: 0;
  z-index: 1;
  margin: var(--space-16) calc(-1 * var(--space-16)) calc(-1 * var(--space-16));
  padding: var(--space-16);
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 92%) 0%,
    var(--color-surface) 40%
  );
  border-top: 1px solid var(--color-border);
  border-radius: 0 0 var(--radius-12) var(--radius-12);
}

.accept {
  min-height: 52px;
  font-weight: 700;
}

.state {
  padding: var(--space-32) 0;
}

.state :deep(.n-button) {
  min-height: 48px;
}
</style>
