<script setup lang="ts">
import { ArrowLeft, RotateCcw } from 'lucide-vue-next'
import { NButton, NResult, NSpin } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDriver, updateDriver, updateDriverStatus } from '../api/drivers'
import { ApiClientError } from '../api/types'
import type {
  AccountStatus,
  CreateDriverInput,
  DriverItem,
  UpdateDriverInput,
} from '../api/types'
import AccountStatusTag from '../components/AccountStatusTag.vue'
import DriverForm from '../components/DriverForm.vue'
import OnlineStatusTag from '../components/OnlineStatusTag.vue'
import { driverToFormValues, type DriverFormValues } from '../lib/driver-form'

const route = useRoute()
const router = useRouter()
const driver = ref<DriverItem | null>(null)
const loading = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const actionError = ref<{ code: string; message: string } | null>(null)
const notFound = ref(false)
const forbidden = ref(false)
const editing = ref(false)
const editValues = ref<DriverFormValues | null>(null)
const saving = ref(false)
const changingStatus = ref(false)
const confirmStatus = ref<AccountStatus | null>(null)

let requestSeq = 0

const busy = computed(() => saving.value || changingStatus.value)
const nextStatus = computed<AccountStatus | null>(() => {
  if (!driver.value) {
    return null
  }
  return driver.value.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
})

function captureError(caught: unknown) {
  if (caught instanceof ApiClientError) {
    return { code: caught.code, message: caught.message }
  }
  return { code: 'INTERNAL_ERROR', message: '系統發生錯誤' }
}

async function loadDriver() {
  const id = String(route.params.id ?? '')
  const seq = ++requestSeq
  loading.value = true
  error.value = null
  actionError.value = null
  notFound.value = false
  forbidden.value = false
  editing.value = false
  confirmStatus.value = null
  driver.value = null

  try {
    const data = await getDriver(id)
    if (seq !== requestSeq) {
      return
    }
    driver.value = data
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

async function refreshDriver() {
  const id = String(route.params.id ?? '')
  driver.value = await getDriver(id)
}

function startEdit() {
  if (!driver.value || busy.value) {
    return
  }
  actionError.value = null
  confirmStatus.value = null
  editValues.value = driverToFormValues(driver.value)
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

async function onSave(input: CreateDriverInput | UpdateDriverInput) {
  if (!driver.value || saving.value) {
    return
  }

  saving.value = true
  actionError.value = null

  try {
    driver.value = await updateDriver(driver.value.id, input)
    editing.value = false
    editValues.value = null
  } catch (caught) {
    actionError.value = captureError(caught)
  } finally {
    saving.value = false
  }
}

async function onChangeStatus() {
  if (!driver.value || !confirmStatus.value || changingStatus.value) {
    return
  }

  changingStatus.value = true
  actionError.value = null

  try {
    await updateDriverStatus(driver.value.id, confirmStatus.value)
    confirmStatus.value = null
    await refreshDriver()
  } catch (caught) {
    actionError.value = captureError(caught)
  } finally {
    changingStatus.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    void loadDriver()
  },
  { immediate: true },
)
</script>

<template>
  <section class="page">
    <NButton class="back" text type="primary" @click="router.push({ name: 'drivers' })">
      <template #icon>
        <ArrowLeft :size="16" />
      </template>
      返回司機列表
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
        title="找不到司機"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error?.code }} · {{ error?.message }}</p>
        </template>
      </NResult>

      <NResult
        v-else-if="error && !driver"
        status="error"
        title="無法載入司機"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error.code }} · {{ error.message }}</p>
        </template>
        <template #footer>
          <NButton type="primary" @click="loadDriver">
            <template #icon>
              <RotateCcw :size="16" />
            </template>
            重試
          </NButton>
        </template>
      </NResult>

      <template v-else-if="driver">
        <header class="page-header">
          <div>
            <p class="kicker">司機詳情</p>
            <h1>{{ driver.username }}</h1>
          </div>
        </header>

        <p v-if="actionError && !editing" class="action-error">
          {{ actionError.code }} · {{ actionError.message }}
        </p>

        <div class="grid">
          <div class="main">
            <article v-if="editing && editValues" class="panel">
              <h2>編輯司機</h2>
              <DriverForm
                mode="edit"
                submit-label="儲存變更"
                :initial-values="editValues"
                :submitting="saving"
                :error="actionError"
                show-cancel
                @submit="onSave"
                @cancel="cancelEdit"
              />
            </article>

            <template v-else>
              <article class="panel">
                <h2>帳號資訊</h2>
                <dl class="fields">
                  <div class="emphasis">
                    <dt>帳號</dt>
                    <dd class="primary-value">{{ driver.username }}</dd>
                  </div>
                </dl>
              </article>

              <article class="panel">
                <h2>車輛資訊</h2>
                <dl class="fields vehicle-fields">
                  <div class="emphasis plate">
                    <dt>車牌</dt>
                    <dd class="primary-value">{{ driver.license_plate }}</dd>
                  </div>
                  <div>
                    <dt>品牌</dt>
                    <dd>{{ driver.vehicle_brand }}</dd>
                  </div>
                  <div>
                    <dt>型號</dt>
                    <dd>{{ driver.vehicle_model }}</dd>
                  </div>
                  <div>
                    <dt>車色</dt>
                    <dd>{{ driver.vehicle_color }}</dd>
                  </div>
                </dl>
              </article>
            </template>
          </div>

          <aside class="panel status-panel">
            <h2>狀態</h2>
            <div class="status-block">
              <div class="status-row">
                <span class="status-label">帳號狀態</span>
                <AccountStatusTag :status="driver.status" />
              </div>
              <div class="status-row">
                <span class="status-label">上線狀態</span>
                <OnlineStatusTag :status="driver.online_status" />
                <p class="online-hint">上線狀態由司機端切換，此處僅顯示。</p>
              </div>
            </div>

            <div v-if="!editing" class="actions-block">
              <h2 class="actions-title">操作</h2>
              <div class="actions">
                <template v-if="confirmStatus">
                  <p class="confirm-copy">
                    {{
                      confirmStatus === 'SUSPENDED'
                        ? '確定停用此司機帳號？停用後不可登入。'
                        : '確定重新啟用此司機帳號？'
                    }}
                  </p>
                  <NButton
                    block
                    :disabled="changingStatus"
                    @click="confirmStatus = null"
                  >
                    取消
                  </NButton>
                  <NButton
                    :type="confirmStatus === 'SUSPENDED' ? 'error' : 'success'"
                    block
                    :loading="changingStatus"
                    :disabled="changingStatus"
                    @click="onChangeStatus"
                  >
                    {{ confirmStatus === 'SUSPENDED' ? '確認停用' : '確認啟用' }}
                  </NButton>
                </template>
                <template v-else>
                  <NButton type="primary" block :disabled="busy" @click="startEdit">
                    編輯
                  </NButton>
                  <NButton
                    v-if="nextStatus === 'SUSPENDED'"
                    type="error"
                    ghost
                    block
                    :disabled="busy"
                    @click="confirmStatus = 'SUSPENDED'"
                  >
                    停用
                  </NButton>
                  <NButton
                    v-else
                    type="success"
                    ghost
                    block
                    :disabled="busy"
                    @click="confirmStatus = 'ACTIVE'"
                  >
                    啟用
                  </NButton>
                </template>
              </div>
            </div>
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
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  min-width: 0;
}

.back {
  align-self: flex-start;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-16);
}

.kicker,
.error-detail,
.status-label,
.online-hint {
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
  margin: var(--space-4) 0 0;
  font: var(--font-page-title);
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(240px, 3fr);
  gap: var(--space-16);
  align-items: start;
}

.main {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  min-width: 0;
}

.panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  padding: var(--space-24);
}

h2 {
  margin: 0 0 var(--space-12);
  padding-bottom: var(--space-12);
  border-bottom: 1px solid var(--color-border);
  font: var(--font-section-title);
}

.fields {
  display: grid;
  gap: var(--space-12);
  margin: 0;
}

.fields > div {
  display: grid;
  gap: var(--space-4);
}

.vehicle-fields {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-12) var(--space-16);
}

.vehicle-fields .plate {
  grid-column: 1 / -1;
}

dt,
.status-label {
  font: var(--font-label);
  color: var(--color-muted-text);
}

dd {
  margin: 0;
}

.primary-value {
  font: var(--font-section-title);
  color: var(--color-text);
}

.status-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  margin-bottom: var(--space-16);
}

.status-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
}

.online-hint {
  margin-top: var(--space-4);
}

.actions-block {
  padding-top: var(--space-16);
  border-top: 1px solid var(--color-border);
}

.actions-title {
  margin-bottom: var(--space-12);
}

.actions {
  display: grid;
  gap: var(--space-8);
}

.confirm-copy {
  margin: 0 0 var(--space-4);
  color: var(--color-text);
  font: var(--font-caption);
}

.state {
  padding: var(--space-32) 0;
}

@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }

  h1 {
    font-size: 24px;
  }

  .actions :deep(.n-button) {
    min-height: 44px;
  }
}

@media (max-width: 640px) {
  .panel {
    padding: var(--space-16);
  }

  .vehicle-fields {
    grid-template-columns: 1fr;
  }
}
</style>
