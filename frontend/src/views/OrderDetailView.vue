<script setup lang="ts">
import { ArrowLeft, RotateCcw } from 'lucide-vue-next'
import { NButton, NResult, NSpin } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cancelOrder, deleteOrder, getOrder, publishOrder, updateOrder } from '../api/orders'
import { ApiClientError } from '../api/types'
import type { CreateOrderInput, OrderDetail, OrderStatus } from '../api/types'
import OrderForm from '../components/OrderForm.vue'
import OrderStatusTag from '../components/OrderStatusTag.vue'
import { formatDateTimeTaipei, formatOptionalText, formatPrice } from '../lib/format'
import { orderDetailToFormValues, type OrderFormValues } from '../lib/order-form'

const STATUS_HINT: Record<OrderStatus, string> = {
  DRAFT: '草稿可編輯、刪除或發布',
  OPEN: '搶單中，可取消此訂單',
  ACCEPTED: '已接單，可取消此訂單',
  IN_PROGRESS: '行程進行中，此訂單為唯讀',
  COMPLETED: '已完成，此訂單為唯讀',
  CANCELLED: '已取消，此訂單為唯讀',
}

const route = useRoute()
const router = useRouter()
const order = ref<OrderDetail | null>(null)
const loading = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const actionError = ref<{ code: string; message: string } | null>(null)
const notFound = ref(false)
const forbidden = ref(false)
const editing = ref(false)
const editValues = ref<OrderFormValues | null>(null)
const saving = ref(false)
const deleting = ref(false)
const publishing = ref(false)
const cancelling = ref(false)
const confirmDelete = ref(false)
const confirmPublish = ref(false)
const confirmCancel = ref(false)

let requestSeq = 0

const isDraft = computed(() => order.value?.status === 'DRAFT')
const canCancel = computed(
  () => order.value?.status === 'OPEN' || order.value?.status === 'ACCEPTED',
)
const busy = computed(
  () => saving.value || deleting.value || publishing.value || cancelling.value,
)

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
  actionError.value = null
  notFound.value = false
  forbidden.value = false
  editing.value = false
  confirmDelete.value = false
  confirmPublish.value = false
  confirmCancel.value = false
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

async function refreshOrder() {
  const id = String(route.params.id ?? '')
  const data = await getOrder(id)
  order.value = data
}

function startEdit() {
  if (!order.value || !isDraft.value || busy.value) {
    return
  }
  actionError.value = null
  editValues.value = orderDetailToFormValues(order.value)
  editing.value = true
}

function cancelEdit() {
  if (saving.value) {
    return
  }
  editing.value = false
  editValues.value = null
  actionError.value = null
}

async function onSave(input: CreateOrderInput) {
  if (!order.value || saving.value) {
    return
  }

  saving.value = true
  actionError.value = null

  try {
    order.value = await updateOrder(order.value.id, input)
    editing.value = false
    editValues.value = null
  } catch (caught) {
    actionError.value = captureError(caught)
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!order.value || deleting.value) {
    return false
  }

  deleting.value = true
  actionError.value = null

  try {
    await deleteOrder(order.value.id)
    confirmDelete.value = false
    await router.push({ name: 'orders' })
    return true
  } catch (caught) {
    actionError.value = captureError(caught)
    return false
  } finally {
    deleting.value = false
  }
}

async function onPublish() {
  if (!order.value || publishing.value) {
    return false
  }

  publishing.value = true
  actionError.value = null

  try {
    await publishOrder(order.value.id)
    confirmPublish.value = false
    await refreshOrder()
    return true
  } catch (caught) {
    actionError.value = captureError(caught)
    return false
  } finally {
    publishing.value = false
  }
}

async function onCancel() {
  if (!order.value || cancelling.value || !canCancel.value) {
    return false
  }

  cancelling.value = true
  actionError.value = null

  try {
    await cancelOrder(order.value.id)
    confirmCancel.value = false
    await refreshOrder()
    return true
  } catch (caught) {
    actionError.value = captureError(caught)
    return false
  } finally {
    cancelling.value = false
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
            <p class="readonly-hint">{{ STATUS_HINT[order.status] }}</p>
          </div>
          <OrderStatusTag :status="order.status" />
        </header>

        <p v-if="actionError && !editing" class="action-error">
          {{ actionError.code }} · {{ actionError.message }}
        </p>

        <div class="grid">
          <article class="panel">
            <h2>{{ editing ? '編輯草稿' : '訂單資訊' }}</h2>
            <OrderForm
              v-if="editing && editValues"
              submit-label="儲存變更"
              :initial-values="editValues"
              :submitting="saving"
              :error="actionError"
              show-cancel
              @submit="onSave"
              @cancel="cancelEdit"
            />
            <dl v-else class="fields">
              <div>
                <dt>客戶</dt>
                <dd>{{ formatOptionalText(order.customer_name) }}</dd>
              </div>
              <div class="route">
                <dt>行程</dt>
                <dd>
                  <span>{{ order.pickup_location }}</span>
                  <span class="route-arrow">↓</span>
                  <span>{{ formatOptionalText(order.destination) }}</span>
                </dd>
              </div>
              <div>
                <dt>價格</dt>
                <dd class="price">{{ formatPrice(order.price) }}</dd>
              </div>
              <div>
                <dt>備註</dt>
                <dd>{{ formatOptionalText(order.note) }}</dd>
              </div>
            </dl>
          </article>

          <aside class="panel status-panel">
            <h2>訂單狀態</h2>
            <div class="status-block">
              <OrderStatusTag :status="order.status" />
              <p class="driver-label">接單司機</p>
              <template v-if="order.driver">
                <p class="driver-value">{{ order.driver.username }}</p>
                <dl class="driver-fields">
                  <div>
                    <dt>車牌</dt>
                    <dd>{{ order.driver.license_plate }}</dd>
                  </div>
                  <div>
                    <dt>車輛</dt>
                    <dd>
                      {{ order.driver.vehicle_brand }}
                      {{ order.driver.vehicle_model }}
                    </dd>
                  </div>
                  <div>
                    <dt>顏色</dt>
                    <dd>{{ order.driver.vehicle_color }}</dd>
                  </div>
                </dl>
              </template>
              <p v-else class="driver-value">尚無</p>
            </div>
            <div v-if="isDraft && !editing" class="draft-actions">
              <template v-if="confirmDelete">
                <p class="confirm-copy">確定刪除此草稿？刪除後無法復原。</p>
                <NButton block :disabled="deleting" @click="confirmDelete = false">
                  取消
                </NButton>
                <NButton
                  type="error"
                  block
                  :loading="deleting"
                  :disabled="deleting"
                  @click="onDelete"
                >
                  確認刪除
                </NButton>
              </template>
              <template v-else-if="confirmPublish">
                <p class="confirm-copy">確定發布這張草稿？發布後會進入搶單中，無法再編輯或刪除。</p>
                <NButton block :disabled="publishing" @click="confirmPublish = false">
                  取消
                </NButton>
                <NButton
                  type="warning"
                  block
                  :loading="publishing"
                  :disabled="publishing"
                  @click="onPublish"
                >
                  確認發布
                </NButton>
              </template>
              <template v-else>
                <NButton type="primary" block :disabled="busy" @click="startEdit">
                  編輯
                </NButton>
                <NButton
                  type="warning"
                  block
                  :disabled="busy"
                  @click="confirmPublish = true"
                >
                  發布
                </NButton>
                <NButton
                  type="error"
                  ghost
                  block
                  :disabled="busy"
                  @click="confirmDelete = true"
                >
                  刪除
                </NButton>
              </template>
            </div>
            <div v-else-if="canCancel && !editing" class="draft-actions">
              <template v-if="confirmCancel">
                <p class="confirm-copy">確定取消此訂單？取消後無法再搶單或接單。</p>
                <NButton block :disabled="cancelling" @click="confirmCancel = false">
                  返回
                </NButton>
                <NButton
                  type="error"
                  block
                  :loading="cancelling"
                  :disabled="cancelling"
                  @click="onCancel"
                >
                  確認取消
                </NButton>
              </template>
              <NButton
                v-else
                type="error"
                ghost
                block
                :disabled="busy"
                @click="confirmCancel = true"
              >
                取消訂單
              </NButton>
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

.action-error {
  margin: 0;
  color: var(--color-danger);
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

.driver-fields {
  display: grid;
  gap: var(--space-8);
  margin: 0;
  width: 100%;
}

.driver-fields > div {
  display: grid;
  gap: var(--space-4);
}

.draft-actions {
  display: grid;
  gap: var(--space-8);
  margin-bottom: var(--space-24);
}

.confirm-copy {
  margin: 0 0 var(--space-4);
  color: var(--color-text);
  font: var(--font-caption);
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
