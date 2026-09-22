<script setup lang="ts">
import { Car, ClipboardList, LayoutDashboard, LogOut, Menu, X } from 'lucide-vue-next'
import { NButton, NConfigProvider, NDrawer, NDrawerContent, darkTheme } from 'naive-ui'
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminThemeOverrides } from '../lib/admin-theme'
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
  <NConfigProvider :theme="darkTheme" :theme-overrides="adminThemeOverrides">
    <div class="shell">
      <div class="atmosphere" aria-hidden="true">
        <div class="glow glow-a" />
        <div class="glow glow-b" />
        <div class="grid" />
      </div>

      <header class="mobile-header">
        <NButton quaternary circle aria-label="開啟選單" @click="menuOpen = true">
          <template #icon>
            <Menu :size="20" />
          </template>
        </NButton>
        <RouterLink class="mobile-brand" :to="{ name: 'dashboard' }">{{ app.name }}</RouterLink>
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
          <NButton class="logout-btn" quaternary size="small" @click="onLogout">
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
              <NButton class="logout-btn" quaternary size="small" @click="onLogout">
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
  </NConfigProvider>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&display=swap');

.shell {
  --color-primary: #3b82f6;
  --color-success: #34d399;
  --color-warning: #d97706;
  --color-danger: #f87171;
  --color-info: #38bdf8;
  --color-background: #141e33;
  --color-surface: rgba(36, 48, 76, 0.94);
  --color-text: #f4f7fc;
  --color-muted-text: rgba(196, 208, 224, 0.82);
  --color-border: rgba(186, 203, 225, 0.26);
  --color-primary-soft: rgba(59, 130, 246, 0.18);
  /* Surface stack: page section → status → board panel → order row */
  --admin-surface-section: linear-gradient(
    180deg,
    rgba(28, 38, 62, 0.72) 0%,
    rgba(22, 32, 54, 0.58) 100%
  );
  --admin-surface-status: linear-gradient(
    160deg,
    rgba(48, 62, 94, 0.96) 0%,
    rgba(40, 52, 82, 0.98) 100%
  );
  --admin-surface-panel: linear-gradient(
    160deg,
    rgba(40, 52, 82, 0.94) 0%,
    rgba(34, 44, 72, 0.97) 100%
  );
  --admin-surface-order: rgba(54, 68, 102, 0.78);
  --admin-surface-order-hover: rgba(62, 78, 114, 0.92);
  --admin-panel: var(--admin-surface-panel);
  --admin-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.1),
    0 12px 32px rgba(8, 12, 24, 0.28);
  --admin-glow: 0 0 24px rgba(59, 130, 246, 0.14);
  --font-page-title: 600 28px/1.3 'Outfit', 'Segoe UI', system-ui, sans-serif;
  --font-section-title: 600 18px/1.4 'Outfit', 'Segoe UI', system-ui, sans-serif;

  position: relative;
  isolation: isolate;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  color: var(--color-text);
  background:
    radial-gradient(90% 60% at 12% -8%, rgba(59, 130, 246, 0.14), transparent 55%),
    radial-gradient(70% 50% at 92% 108%, rgba(99, 102, 241, 0.12), transparent 52%),
    linear-gradient(165deg, #1a2540 0%, #141e33 45%, #101829 100%);
}

.atmosphere {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  animation: admin-drift 22s ease-in-out infinite alternate;
}

.glow-a {
  width: min(42vw, 380px);
  height: min(42vw, 380px);
  top: -10%;
  left: 18%;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.35), transparent 70%);
}

.glow-b {
  width: min(36vw, 320px);
  height: min(36vw, 320px);
  right: 4%;
  bottom: 8%;
  background: radial-gradient(circle, rgba(79, 70, 229, 0.28), transparent 70%);
  animation-delay: -8s;
}

.grid {
  position: absolute;
  inset: -10%;
  opacity: 0.28;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse at 40% 30%, black 10%, transparent 70%);
}

.mobile-header {
  display: none;
}

.sidebar {
  position: relative;
  z-index: 2;
  width: 232px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  padding: var(--space-24) var(--space-16);
  background: rgba(22, 32, 54, 0.92);
  border-right: 1px solid var(--color-border);
  box-shadow: 8px 0 32px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.brand,
.mobile-brand {
  font: var(--font-section-title);
  font-weight: 700;
  letter-spacing: -0.02em;
  text-decoration: none;
  padding: 0 var(--space-8);
  background: linear-gradient(115deg, #ffffff 8%, #93c5fd 52%, #818cf8 92%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
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
  border-radius: 10px;
  color: var(--color-muted-text);
  text-decoration: none;
  font: var(--font-label);
  border: 1px solid transparent;
  transition:
    color 180ms ease,
    background 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.nav-item:hover {
  background: rgba(59, 130, 246, 0.08);
  color: var(--color-text);
}

.nav-item-active {
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
  border-color: rgba(96, 165, 250, 0.28);
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.08), var(--admin-glow);
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

.logout-btn {
  transition: color 160ms ease, background 160ms ease !important;
}

.content {
  position: relative;
  z-index: 1;
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
  background: #182238;
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

@keyframes admin-drift {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(12px, -10px, 0);
  }
}

@media (max-width: 900px) {
  .shell {
    flex-direction: column;
  }

  .atmosphere .glow-b,
  .atmosphere .grid {
    opacity: 0.22;
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
    background: rgba(22, 32, 54, 0.94);
    border-bottom: 1px solid var(--color-border);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  .mobile-brand {
    flex: 1;
    min-width: 0;
    padding: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar {
    display: none;
  }

  .content {
    padding: var(--space-16);
  }
}

@media (prefers-reduced-motion: reduce) {
  .glow,
  .nav-item {
    animation: none !important;
    transition: none !important;
  }
}
</style>
