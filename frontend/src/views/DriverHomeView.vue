<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { NButton, NResult, NSpin, NSwitch } from 'naive-ui'
import { computed, ref } from 'vue'
import { ApiClientError } from '../api/types'
import type { OnlineStatus } from '../api/types'
import AccountStatusTag from '../components/AccountStatusTag.vue'
import { useAuthStore } from '../stores/auth'
import { useDriverStatusStore } from '../stores/driver-status'
import { usePushNotificationStore } from '../stores/push-notification'

const auth = useAuthStore()
const driverStatus = useDriverStatusStore()
const pushNotification = usePushNotificationStore()
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
    await Promise.all([driverStatus.sync(), pushNotification.sync()])
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
          <div class="identity-row">
            <h1>{{ auth.currentUser.username }}</h1>
            <div class="account-status">
              <p class="row-label">帳號狀態</p>
              <AccountStatusTag :status="auth.currentUser.status" />
            </div>
          </div>
        </header>

        <section class="status-panel">
          <div class="switch-row online-row">
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
      </template>
    </NSpin>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  min-width: 0;
}

.page :deep(.n-spin-container),
.page :deep(.n-spin-content) {
  overflow: visible;
}

.identity {
  padding: var(--space-12) var(--space-16);
  background: linear-gradient(
    145deg,
    rgba(59, 130, 246, 0.32) 0%,
    rgba(79, 70, 229, 0.28) 55%,
    rgba(40, 52, 82, 0.95) 100%
  );
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  border-radius: 14px;
  color: #f8fafc;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    var(--shadow-card, 0 10px 28px rgba(8, 12, 24, 0.28));
}

.identity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
}

.identity h1 {
  margin: 0;
  font: var(--font-page-title);
  font-size: 24px;
  letter-spacing: -0.02em;
  background: linear-gradient(115deg, #ffffff 10%, #93c5fd 60%, #818cf8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-status {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-8);
  flex-shrink: 0;
}

.identity .row-label {
  margin: 0;
  color: rgba(226, 232, 240, 0.78);
  font: var(--font-caption);
}

.error-detail,
.confirm-copy,
.readiness {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.row-label {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.status-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-12) var(--space-16);
  background: var(--driver-surface-card, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    var(--shadow-card, 0 10px 28px rgba(8, 12, 24, 0.28));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  min-height: 44px;
}

.online-row {
  padding-bottom: var(--space-8);
  border-bottom: 1px solid var(--color-border);
}

.switch-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-value {
  margin: 0;
  color: var(--color-text);
  font: var(--font-label);
  font-weight: 600;
  transition: color 180ms ease;
}

.row-value.is-online {
  color: var(--color-success);
  text-shadow: 0 0 12px color-mix(in srgb, var(--color-success) 35%, transparent);
}

.row-value.is-offline {
  color: var(--color-muted-text);
}

.readiness {
  padding-top: var(--space-4);
  color: rgba(226, 232, 240, 0.9);
}

.action-error {
  margin: 0;
  padding: var(--space-12);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-danger) 14%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
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

.confirm-actions :deep(.n-button) {
  min-height: 48px;
  transition: transform 160ms ease, filter 160ms ease !important;
}

.confirm-actions :deep(.n-button:active:not(:disabled)) {
  transform: translateY(1px);
}

.state {
  padding: var(--space-24) 0;
}

:deep(.n-switch.n-switch--active) {
  background: var(--color-success);
}

@media (prefers-reduced-motion: reduce) {
  .row-value,
  .status-panel,
  .confirm-actions :deep(.n-button) {
    transition: none !important;
  }
}
</style>
