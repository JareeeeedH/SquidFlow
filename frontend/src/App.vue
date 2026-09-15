<script setup lang="ts">
import type { GlobalThemeOverrides } from 'naive-ui'
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { useRouter } from 'vue-router'
import { usePushNotificationClicks } from './lib/push-clicks'

const router = useRouter()
usePushNotificationClicks(router)

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#2563eb',
    primaryColorHover: '#1d4ed8',
    primaryColorPressed: '#1e40af',
    successColor: '#16a34a',
    warningColor: '#d97706',
    errorColor: '#dc2626',
    infoColor: '#0284c7',
    borderRadius: '8px',
  },
}
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <NMessageProvider>
      <RouterView />
    </NMessageProvider>
  </NConfigProvider>
</template>
