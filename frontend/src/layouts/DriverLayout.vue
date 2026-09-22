<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import { NButton, NConfigProvider, darkTheme } from 'naive-ui'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { driverThemeOverrides } from '../lib/driver-theme'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'
import { useDriverStatusStore } from '../stores/driver-status'
import { usePushNotificationStore } from '../stores/push-notification'

const app = useAppStore()
const auth = useAuthStore()
const driverStatus = useDriverStatusStore()
const pushNotification = usePushNotificationStore()
const router = useRouter()

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
  <NConfigProvider :theme="darkTheme" :theme-overrides="driverThemeOverrides">
    <div class="shell">
      <div class="atmosphere" aria-hidden="true">
        <div class="glow glow-a" />
        <div class="glow glow-b" />
      </div>

      <header class="topbar">
        <RouterLink
          class="brand"
          :to="{ name: 'driver-home' }"
        >
          {{ app.name }}
        </RouterLink>
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
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&display=swap');

.shell {
  --color-primary: #3b82f6;
  --color-primary-hover: #60a5fa;
  --color-primary-soft: rgba(59, 130, 246, 0.16);
  --color-primary-muted: #93c5fd;
  --color-success: #34d399;
  --color-warning: #d97706;
  --color-danger: #f87171;
  --color-info: #38bdf8;
  --color-background: #141e33;
  --color-surface: rgba(36, 48, 76, 0.94);
  --color-text: #f4f7fc;
  --color-muted-text: rgba(196, 208, 224, 0.82);
  --color-border: rgba(186, 203, 225, 0.26);
  --driver-surface-card: linear-gradient(
    160deg,
    rgba(48, 62, 94, 0.96) 0%,
    rgba(40, 52, 82, 0.98) 100%
  );
  --driver-surface-elevated: rgba(54, 68, 102, 0.78);
  --shadow-card:
    0 0 0 1px rgba(148, 163, 184, 0.1),
    0 10px 28px rgba(8, 12, 24, 0.28);
  --driver-glow: 0 0 20px rgba(59, 130, 246, 0.14);
  --font-page-title: 600 28px/1.3 'Outfit', 'Segoe UI', system-ui, sans-serif;
  --font-section-title: 600 18px/1.4 'Outfit', 'Segoe UI', system-ui, sans-serif;

  position: relative;
  isolation: isolate;
  min-height: 100vh;
  min-height: 100dvh;
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  color: var(--color-text);
  background:
    radial-gradient(90% 50% at 20% -8%, rgba(59, 130, 246, 0.16), transparent 55%),
    radial-gradient(70% 40% at 90% 100%, rgba(99, 102, 241, 0.12), transparent 50%),
    linear-gradient(165deg, #1a2540 0%, #141e33 48%, #101829 100%);
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
  filter: blur(72px);
  opacity: 0.35;
  animation: driver-drift 20s ease-in-out infinite alternate;
}

.glow-a {
  width: min(70vw, 280px);
  height: min(70vw, 280px);
  top: -8%;
  left: -10%;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.4), transparent 70%);
}

.glow-b {
  width: min(60vw, 240px);
  height: min(60vw, 240px);
  right: -12%;
  bottom: 12%;
  background: radial-gradient(circle, rgba(79, 70, 229, 0.28), transparent 70%);
  animation-delay: -7s;
}

.topbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  padding: var(--space-12) var(--space-16);
  background: rgba(22, 32, 54, 0.92);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  color: #f8fafc;
}

.brand {
  flex: 1;
  min-width: 0;
  margin: 0;
  text-decoration: none;
  font: var(--font-label);
  font-weight: 700;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: linear-gradient(115deg, #ffffff 8%, #93c5fd 52%, #818cf8 92%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.logout {
  flex-shrink: 0;
  min-height: 44px;
  color: #e2e8f0 !important;
  transition: color 160ms ease, background 160ms ease !important;
}

.logout:hover {
  color: #ffffff !important;
}

.nav {
  position: relative;
  z-index: 2;
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
  border-radius: 10px;
  color: var(--color-muted-text);
  text-decoration: none;
  font: var(--font-label);
  white-space: nowrap;
  background: var(--driver-surface-card);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
  transition:
    color 180ms ease,
    background 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.nav-item:hover {
  color: var(--color-text);
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
}

.nav-item-active {
  color: #93c5fd;
  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
  background: var(--color-primary-soft);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.12), var(--driver-glow);
}

.content {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  padding: var(--space-16);
  padding-bottom: max(var(--space-24), env(safe-area-inset-bottom));
  animation: driver-page-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes driver-drift {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(10px, -8px, 0);
  }
}

@keyframes driver-page-enter {
  from {
    opacity: 0;
    transform: translate3d(0, 8px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .glow,
  .content,
  .nav-item {
    animation: none !important;
    transition: none !important;
  }

  .content {
    opacity: 1;
    transform: none;
  }
}
</style>
