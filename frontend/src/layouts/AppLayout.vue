<script setup lang="ts">
import { Car, ClipboardList, LogOut } from 'lucide-vue-next'
import { NButton } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'

const app = useAppStore()
const auth = useAuthStore()
const router = useRouter()

async function onLogout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <RouterLink class="brand" :to="{ name: 'orders' }">{{ app.name }}</RouterLink>
      <nav class="nav">
        <RouterLink
          class="nav-item"
          :to="{ name: 'orders' }"
          active-class="nav-item-active"
        >
          <ClipboardList :size="16" />
          訂單
        </RouterLink>
        <RouterLink
          class="nav-item"
          :to="{ name: 'drivers' }"
          active-class="nav-item-active"
        >
          <Car :size="16" />
          司機
        </RouterLink>
      </nav>
      <div class="account">
        <span class="username">{{ auth.currentUser?.username }}</span>
        <NButton quaternary size="small" @click="onLogout">
          <template #icon>
            <LogOut :size="16" />
          </template>
          登出
        </NButton>
      </div>
    </aside>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  background: var(--color-background);
}

.sidebar {
  width: 232px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  padding: var(--space-24) var(--space-16);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.brand {
  font: var(--font-section-title);
  color: var(--color-text);
  text-decoration: none;
  padding: 0 var(--space-8);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-12);
  border-radius: var(--radius-8);
  color: var(--color-muted-text);
  text-decoration: none;
  font: var(--font-label);
}

.nav-item:hover {
  background: var(--color-background);
  color: var(--color-text);
}

.nav-item-active {
  background: #eff6ff;
  color: var(--color-primary);
}

.account {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-8);
  padding: var(--space-8);
}

.username {
  font: var(--font-caption);
  color: var(--color-muted-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.content {
  flex: 1;
  min-width: 0;
  padding: var(--space-32);
}

@media (max-width: 900px) {
  .shell {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    flex-direction: row;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-12) var(--space-16);
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }

  .nav {
    flex: 1;
    flex-direction: row;
  }

  .account {
    flex-direction: row;
    align-items: center;
    padding: 0;
  }

  .username {
    max-width: 96px;
  }

  .content {
    padding: var(--space-16);
  }
}
</style>
