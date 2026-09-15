<script setup lang="ts">
import { ChevronRight, RotateCcw } from 'lucide-vue-next'
import { NButton, NResult, NSpin, NSwitch } from 'naive-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { OnlineStatus } from '../api/types'
import AccountStatusTag from '../components/AccountStatusTag.vue'
import { useAuthStore } from '../stores/auth'
import { useDriverStatusStore } from '../stores/driver-status'
import { usePushNotificationStore } from '../stores/push-notification'

const auth = useAuthStore()
const driverStatus = useDriverStatusStore()
const pushNotification = usePushNotificationStore()
const router = useRouter()
const loading = ref(false)
const updating = ref(false)
const error = ref<{ code: string; message: string } | null>(null)
const actionError = ref<{ code: string; message: string } | null>(null)
const confirmOffline = ref(false)

const isOnline = computed(() => driverStatus.onlineStatus === 'ONLINE')

const onlineLabel = computed(() => {
  if (driverStatus.onlineStatus === 'ONLINE') {
    return '上線'
  }
  if (driverStatus.onlineStatus === 'OFFLINE') {
    return '下線'
  }
  return '未同步'
})

const readiness = computed(() => {
  if (driverStatus.onlineStatus === 'ONLINE') {
    return '目前可搶單，並可接收新訂單通知'
  }
  if (driverStatus.onlineStatus === 'OFFLINE') {
    return '目前無法搶新訂單，也不會收到新的派車通知'
  }
  return '尚未向伺服器確認上線狀態'
})

const notifySwitchDisabled = computed(
  () =>
    pushNotification.updating ||
    !(pushNotification.canEnable || pushNotification.canDisable),
)

function captureError(caught: unknown) {
  if (caught instanceof ApiClientError) {
    return { code: caught.code, message: caught.message }
  }
  return { code: 'INTERNAL_ERROR', message: '系統發生錯誤' }
}

async function loadHome() {
  loading.value = true
  error.value = null
  actionError.value = null
  confirmOffline.value = false

  try {
    await auth.refresh()
    await pushNotification.sync()
  } catch (caught) {
    error.value = captureError(caught)
  } finally {
    loading.value = false
  }
}

async function changeStatus(status: OnlineStatus) {
  if (updating.value) {
    return
  }

  updating.value = true
  actionError.value = null

  try {
    await driverStatus.setOnlineStatus(status)
    confirmOffline.value = false
  } catch (caught) {
    actionError.value = captureError(caught)
  } finally {
    updating.value = false
  }
}

function onOnlineSwitch(value: boolean) {
  if (updating.value) {
    return
  }
  if (value) {
    confirmOffline.value = false
    void changeStatus('ONLINE')
    return
  }
  confirmOffline.value = true
}

function onNotifySwitch(value: boolean) {
  if (value) {
    void pushNotification.enable()
    return
  }
  void pushNotification.disable()
}

void loadHome()
</script>

<template>
  <section class="page">
    <NSpin :show="loading">
      <NResult
        v-if="error"
        status="error"
        title="無法載入司機狀態"
        class="state"
      >
        <template #default>
          <p class="error-detail">{{ error.code }} · {{ error.message }}</p>
        </template>
        <template #footer>
          <NButton size="large" type="primary" block @click="loadHome">
            <template #icon>
              <RotateCcw :size="18" />
            </template>
            重試
          </NButton>
        </template>
      </NResult>

      <template v-else-if="auth.currentUser">
        <header class="identity">
          <p class="kicker">司機</p>
          <div class="identity-row">
            <h1>{{ auth.currentUser.username }}</h1>
            <div class="account-status">
              <p class="row-label">帳號狀態</p>
              <AccountStatusTag :status="auth.currentUser.status" />
            </div>
          </div>
        </header>

        <section class="status-panel">
          <div class="switch-row">
            <div class="switch-copy">
              <p class="row-label">上線狀態</p>
              <p
                class="row-value"
                :class="{
                  'is-online': isOnline,
                  'is-offline': driverStatus.onlineStatus === 'OFFLINE',
                }"
              >
                {{ onlineLabel }}
              </p>
            </div>
            <NSwitch
              size="large"
              :value="isOnline"
              :loading="updating"
              :disabled="updating"
              aria-label="切換上線狀態"
              @update:value="onOnlineSwitch"
            />
          </div>

          <div class="switch-row">
            <div class="switch-copy">
              <p class="row-label">通知</p>
              <p
                class="row-value"
                :class="{ 'is-online': pushNotification.enabled }"
              >
                {{ pushNotification.label }}
              </p>
            </div>
            <NSwitch
              size="large"
              :value="pushNotification.enabled"
              :loading="pushNotification.updating"
              :disabled="notifySwitchDisabled"
              aria-label="切換通知"
              @update:value="onNotifySwitch"
            />
          </div>

          <p class="readiness">{{ readiness }}</p>

          <p v-if="actionError" class="action-error">
            {{ actionError.code }} · {{ actionError.message }}
          </p>
          <p v-if="pushNotification.error" class="action-error">
            {{ pushNotification.error.code }} · {{ pushNotification.error.message }}
          </p>

          <div v-if="confirmOffline" class="confirm">
            <p class="confirm-copy">
              確定要下線嗎？下線後將不再收到新的派車通知。
            </p>
            <div class="confirm-actions">
              <NButton
                size="large"
                block
                :disabled="updating"
                @click="confirmOffline = false"
              >
                取消
              </NButton>
              <NButton
                size="large"
                type="error"
                block
                :loading="updating"
                :disabled="updating"
                @click="changeStatus('OFFLINE')"
              >
                確定下線
              </NButton>
            </div>
          </div>
        </section>

        <NButton
          class="primary-cta"
          size="large"
          type="primary"
          block
          icon-placement="right"
          @click="router.push({ name: 'driver-open-orders' })"
        >
          查看可搶訂單
          <template #icon>
            <ChevronRight :size="18" />
          </template>
        </NButton>
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

.page :deep(.n-spin-container),
.page :deep(.n-spin-content) {
  overflow: visible;
}

.identity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  margin-top: var(--space-4);
}

.account-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-4);
  flex-shrink: 0;
}

.kicker,
.row-label,
.error-detail,
.confirm-copy,
.readiness {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.status-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  padding: var(--space-16);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  min-height: 44px;
}

.switch-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.row-value {
  margin: 0;
  color: var(--color-text);
  font: var(--font-label);
}

.row-value.is-online {
  color: var(--color-success);
}

.row-value.is-offline {
  color: var(--color-muted-text);
}

.readiness {
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  color: var(--color-text);
}

.action-error {
  margin: 0;
  padding: var(--space-12);
  border-radius: var(--radius-8);
  background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface));
  color: var(--color-danger);
  font: var(--font-caption);
}

.confirm {
  display: grid;
  gap: var(--space-8);
}

.confirm-copy {
  color: var(--color-text);
}

.confirm-actions {
  display: grid;
  gap: var(--space-8);
}

.confirm-actions :deep(.n-button),
.primary-cta {
  min-height: 48px;
}

.primary-cta {
  overflow: visible;
  white-space: nowrap;
}

.primary-cta :deep(.n-button__content) {
  overflow: visible;
  flex: 1 1 auto;
}

.state {
  padding: var(--space-24) 0;
}

:deep(.n-switch.n-switch--active) {
  background: var(--color-success);
}
</style>
