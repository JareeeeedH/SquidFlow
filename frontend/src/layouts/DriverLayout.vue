<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import type { GlobalThemeOverrides } from 'naive-ui'
import { NButton, NConfigProvider } from 'naive-ui'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useDriverStatusStore } from '../stores/driver-status'
import { usePushNotificationStore } from '../stores/push-notification'

const auth = useAuthStore()
const driverStatus = useDriverStatusStore()
const pushNotification = usePushNotificationStore()
const router = useRouter()

const driverTheme: GlobalThemeOverrides = {
  common: {
    primaryColor: '#0B1F3A',
    primaryColorHover: '#16325A',
    primaryColorPressed: '#071526',
  },
}

async function onLogout() {
  await auth.logout()
  await router.push({ name: 'login' })
}

onMounted(() => {
  void pushNotification.sync()
  void driverStatus.sync().catch(() => {
    // Home will surface status sync errors when opened.
  })
})
</script>

<template>
  <NConfigProvider :theme-overrides="driverTheme">
    <div class="shell">
      <header class="topbar">
        <RouterLink
          class="brand"
          :to="{ name: 'driver-home' }"
          aria-label="首頁"
        >
          <span class="brand-mark" aria-hidden="true" />
        </RouterLink>
        <p v-if="auth.currentUser" class="user">
          {{ auth.currentUser.username }}
        </p>
        <NButton class="logout" quaternary size="large" @click="onLogout">
          <template #icon>
            <LogOut :size="18" />
          </template>
          登出
        </NButton>
      </header>
      <nav class="nav">
        <RouterLink
          class="nav-item"
          :to="{ name: 'driver-home' }"
          exact-active-class="nav-item-active"
        >
          狀態
        </RouterLink>
        <RouterLink
          class="nav-item"
          :to="{ name: 'driver-open-orders' }"
          active-class="nav-item-active"
        >
          可搶訂單
        </RouterLink>
        <RouterLink
          class="nav-item"
          :to="{ name: 'driver-my-orders' }"
          exact-active-class="nav-item-active"
        >
          我的訂單
        </RouterLink>
      </nav>
      <main class="content">
        <RouterView />
      </main>
    </div>
  </NConfigProvider>
</template>

<style scoped>
.shell {
  --color-primary: #0b1f3a;
  --color-primary-hover: #16325a;
  --color-primary-soft: #e8eef5;
  --color-primary-muted: #1a3358;
  --color-background: #f3f5f8;
  --color-surface: #ffffff;
  --color-border: #e2e8f0;
  --color-text: #0f172a;
  --color-muted-text: #64748b;
  --shadow-card: 0 1px 2px rgb(11 31 58 / 6%);

  min-height: 100vh;
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  color: var(--color-text);
}

.topbar {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  padding: var(--space-12) var(--space-16);
  background: var(--color-primary);
  border-bottom: 1px solid transparent;
  color: #f8fafc;
}

.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-8);
  background: rgb(248 250 252 / 12%);
  text-decoration: none;
  flex-shrink: 0;
}

.brand-mark {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background: #f8fafc;
  box-shadow: 6px 0 0 rgb(248 250 252 / 45%);
}

.user {
  flex: 1;
  margin: 0;
  min-width: 0;
  font: var(--font-label);
  font-weight: 600;
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout {
  min-height: 44px;
  color: #f8fafc !important;
}

.nav {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-8);
  padding: var(--space-12) var(--space-16) 0;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-8);
  color: var(--color-muted-text);
  text-decoration: none;
  font: var(--font-label);
  white-space: nowrap;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
}

.nav-item-active {
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  background: var(--color-primary-soft);
  font-weight: 600;
}

.content {
  flex: 1;
  min-width: 0;
  padding: var(--space-16);
  padding-bottom: max(var(--space-24), env(safe-area-inset-bottom));
}
</style>
