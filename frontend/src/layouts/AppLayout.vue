<script setup lang="ts">
import { Car, ClipboardList, LayoutDashboard, LogOut, Menu, X } from 'lucide-vue-next'
import { NButton, NDrawer, NDrawerContent } from 'naive-ui'
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'

const app = useAppStore()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

async function onLogout() {
  menuOpen.value = false
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="shell">
    <header class="mobile-header">
      <NButton quaternary circle aria-label="開啟選單" @click="menuOpen = true">
        <template #icon>
          <Menu :size="20" />
        </template>
      </NButton>
      <RouterLink class="mobile-brand" :to="{ name: 'dashboard' }">{{ app.name }}</RouterLink>
      <span class="mobile-user">{{ auth.currentUser?.username }}</span>
    </header>

    <aside class="sidebar">
      <RouterLink class="brand" :to="{ name: 'dashboard' }">{{ app.name }}</RouterLink>
      <nav class="nav">
        <RouterLink
          class="nav-item"
          :to="{ name: 'dashboard' }"
          exact-active-class="nav-item-active"
        >
          <LayoutDashboard :size="16" />
          派車管理
        </RouterLink>
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

    <NDrawer v-model:show="menuOpen" placement="left" :width="280" display-directive="show">
      <NDrawerContent :native-scrollbar="false" body-content-style="padding: 0">
        <div class="drawer-panel">
          <div class="drawer-top">
            <RouterLink class="brand" :to="{ name: 'dashboard' }" @click="menuOpen = false">
              {{ app.name }}
            </RouterLink>
            <NButton quaternary circle aria-label="關閉選單" @click="menuOpen = false">
              <template #icon>
                <X :size="18" />
              </template>
            </NButton>
          </div>
          <nav class="nav drawer-nav">
            <RouterLink
              class="nav-item"
              :to="{ name: 'dashboard' }"
              exact-active-class="nav-item-active"
              @click="menuOpen = false"
            >
              <LayoutDashboard :size="16" />
              派車管理
            </RouterLink>
            <RouterLink
              class="nav-item"
              :to="{ name: 'orders' }"
              active-class="nav-item-active"
              @click="menuOpen = false"
            >
              <ClipboardList :size="16" />
              訂單
            </RouterLink>
            <RouterLink
              class="nav-item"
              :to="{ name: 'drivers' }"
              active-class="nav-item-active"
              @click="menuOpen = false"
            >
              <Car :size="16" />
              司機
            </RouterLink>
          </nav>
          <div class="account drawer-account">
            <span class="username">{{ auth.currentUser?.username }}</span>
            <NButton quaternary size="small" @click="onLogout">
              <template #icon>
                <LogOut :size="16" />
              </template>
              登出
            </NButton>
          </div>
        </div>
      </NDrawerContent>
    </NDrawer>

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

.mobile-header {
  display: none;
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

.brand,
.mobile-brand {
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

.username,
.mobile-user {
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

.drawer-panel {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: var(--space-16);
  gap: var(--space-16);
}

.drawer-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.drawer-nav {
  flex: 1;
}

.drawer-account {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-16);
}

@media (max-width: 900px) {
  .shell {
    flex-direction: column;
  }

  .mobile-header {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    position: sticky;
    top: 0;
    z-index: 20;
    min-height: 52px;
    padding: var(--space-8) var(--space-12);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }

  .mobile-brand {
    flex: 1;
    min-width: 0;
    padding: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-user {
    max-width: 88px;
    flex-shrink: 0;
  }

  .sidebar {
    display: none;
  }

  .content {
    padding: var(--space-16);
  }
}
</style>
