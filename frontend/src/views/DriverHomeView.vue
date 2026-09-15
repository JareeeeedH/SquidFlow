<script setup lang="ts">
import { Bell, BellOff, ChevronRight, RotateCcw } from 'lucide-vue-next'
import { NButton, NResult, NSpin } from 'naive-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import type { OnlineStatus } from '../api/types'
import AccountStatusTag from '../components/AccountStatusTag.vue'
import OnlineStatusTag from '../components/OnlineStatusTag.vue'
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

const nextStatus = computed<OnlineStatus>(() =>
  driverStatus.onlineStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE',
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
          <h1>{{ auth.currentUser.username }}</h1>
        </header>

        <article class="card">
          <div class="status-row">
            <div>
              <p class="label">帳號狀態</p>
              <AccountStatusTag :status="auth.currentUser.status" />
            </div>
            <div>
              <p class="label">上線狀態</p>
              <OnlineStatusTag
                v-if="driverStatus.onlineStatus"
                :status="driverStatus.onlineStatus"
              />
              <p v-else class="pending">尚未向伺服器確認</p>
            </div>
          </div>

          <p v-if="actionError" class="action-error">
            {{ actionError.code }} · {{ actionError.message }}
          </p>

          <div v-if="confirmOffline" class="actions">
            <p class="confirm-copy">
              確定要下線嗎？下線後將不再收到新的派車通知。
            </p>
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
          <div v-else class="actions">
            <NButton
              v-if="nextStatus === 'ONLINE'"
              size="large"
              type="success"
              block
              :loading="updating"
              :disabled="updating"
              @click="changeStatus('ONLINE')"
            >
              上線
            </NButton>
            <NButton
              v-else
              size="large"
              type="error"
              ghost
              block
              :disabled="updating"
              @click="confirmOffline = true"
            >
              下線
            </NButton>
          </div>
        </article>

        <article class="card">
          <div class="notify-row">
            <div>
              <p class="label">通知</p>
              <p class="notify-status">{{ pushNotification.label }}</p>
            </div>
          </div>

          <p v-if="pushNotification.error" class="action-error">
            {{ pushNotification.error.code }} · {{ pushNotification.error.message }}
          </p>

          <div
            v-if="pushNotification.canEnable || pushNotification.canDisable"
            class="actions"
          >
            <NButton
              v-if="pushNotification.canEnable"
              size="large"
              block
              :loading="pushNotification.updating"
              :disabled="pushNotification.updating"
              @click="pushNotification.enable()"
            >
              <template #icon>
                <Bell :size="18" />
              </template>
              開啟通知
            </NButton>
            <NButton
              v-else-if="pushNotification.canDisable"
              size="large"
              ghost
              block
              :loading="pushNotification.updating"
              :disabled="pushNotification.updating"
              @click="pushNotification.disable()"
            >
              <template #icon>
                <BellOff :size="18" />
              </template>
              關閉通知
            </NButton>
          </div>
        </article>

        <NButton
          class="open-orders"
          size="large"
          type="primary"
          block
          icon-placement="right"
          @click="router.push({ name: 'driver-open-orders' })"
        >
          可搶訂單
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
  gap: var(--space-12);
}

.page :deep(.n-spin-container),
.page :deep(.n-spin-content) {
  overflow: visible;
}

.identity h1 {
  margin: var(--space-4) 0 0;
  font: var(--font-page-title);
}

.kicker,
.label,
.pending,
.error-detail,
.confirm-copy {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  padding: var(--space-16);
}

.status-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
  margin-bottom: var(--space-16);
}

.status-row > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-8);
}

.notify-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: var(--space-16);
}

.notify-status {
  margin: var(--space-8) 0 0;
  font: var(--font-label);
}

.action-error {
  margin: 0 0 var(--space-12);
  color: var(--color-danger);
  font: var(--font-caption);
}

.actions {
  display: grid;
  gap: var(--space-8);
}

.actions :deep(.n-button),
.open-orders {
  min-height: 48px;
}

.open-orders {
  overflow: visible;
  white-space: nowrap;
}

.open-orders :deep(.n-button__content) {
  overflow: visible;
  flex: 1 1 auto;
}

.confirm-copy {
  color: var(--color-text);
  margin-bottom: var(--space-4);
}

.state {
  padding: var(--space-24) 0;
}
</style>
