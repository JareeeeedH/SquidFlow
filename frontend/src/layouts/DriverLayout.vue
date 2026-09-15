<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import { NButton } from 'naive-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import OnlineStatusTag from '../components/OnlineStatusTag.vue'
import { useAuthStore } from '../stores/auth'
import { useDriverStatusStore } from '../stores/driver-status'

const auth = useAuthStore()
const driverStatus = useDriverStatusStore()
const router = useRouter()

const knownOnlineStatus = computed(() => driverStatus.onlineStatus)

async function onLogout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <RouterLink class="brand" :to="{ name: 'driver-home' }">派車</RouterLink>
      <div class="topbar-status">
        <OnlineStatusTag v-if="knownOnlineStatus" :status="knownOnlineStatus" />
        <span v-else class="status-pending">上線狀態未同步</span>
      </div>
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
    </nav>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
}

.topbar {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  padding: var(--space-12) var(--space-16);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.brand {
  font: var(--font-section-title);
  color: var(--color-text);
  text-decoration: none;
}

.topbar-status {
  flex: 1;
  display: flex;
  justify-content: center;
}

.status-pending {
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.logout {
  min-height: 44px;
}

.nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
  padding: var(--space-12) var(--space-16) 0;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border-radius: var(--radius-8);
  color: var(--color-muted-text);
  text-decoration: none;
  font: var(--font-label);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.nav-item-active {
  color: var(--color-primary);
  border-color: #bfdbfe;
  background: #eff6ff;
}

.content {
  flex: 1;
  min-width: 0;
  padding: var(--space-16);
  padding-bottom: max(var(--space-24), env(safe-area-inset-bottom));
}
</style>
