<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
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
    <header class="topbar">
      <div class="brand">{{ app.name }}</div>
      <div class="actions">
        <span class="username">{{ auth.currentUser?.username }}</span>
        <NButton quaternary size="small" @click="onLogout">
          <template #icon>
            <LogOut :size="16" />
          </template>
          登出
        </NButton>
      </div>
    </header>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-16);
  padding: var(--space-12) var(--space-24);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.brand {
  font: var(--font-section-title);
  color: var(--color-text);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  min-width: 0;
}

.username {
  font: var(--font-caption);
  color: var(--color-muted-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.content {
  flex: 1;
  padding: var(--space-24);
}

@media (max-width: 640px) {
  .topbar,
  .content {
    padding-left: var(--space-16);
    padding-right: var(--space-16);
  }

  .username {
    max-width: 96px;
  }
}
</style>
