<script setup lang="ts">
import { Truck } from 'lucide-vue-next'
import {
  NAlert,
  NButton,
  NConfigProvider,
  NForm,
  NFormItem,
  NInput,
  darkTheme,
  type FormInst,
  type FormRules,
  type GlobalThemeOverrides,
} from 'naive-ui'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiClientError } from '../api/types'
import { homeRouteName } from '../lib/auth-redirect'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const formRef = ref<FormInst | null>(null)
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

const form = reactive({
  username: '',
  password: '',
})

const rules: FormRules = {
  username: {
    required: true,
    message: '請輸入帳號',
    trigger: ['blur', 'input'],
  },
  password: {
    required: true,
    message: '請輸入密碼',
    trigger: ['blur', 'input'],
  },
}

const loginTheme: GlobalThemeOverrides = {
  common: {
    primaryColor: '#3b82f6',
    primaryColorHover: '#60a5fa',
    primaryColorPressed: '#2563eb',
    errorColor: '#f87171',
    borderRadius: '10px',
  },
  Form: {
    labelTextColor: 'rgba(203, 213, 225, 0.88)',
    labelFontWeight: '500',
  },
  Input: {
    color: 'rgba(8, 15, 30, 0.72)',
    colorFocus: 'rgba(8, 15, 30, 0.9)',
    textColor: '#e8eef8',
    placeholderColor: 'rgba(148, 163, 184, 0.55)',
    caretColor: '#93c5fd',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderHover: '1px solid rgba(96, 165, 250, 0.48)',
    borderFocus: '1px solid rgba(96, 165, 250, 0.78)',
    boxShadowFocus: '0 0 0 3px rgba(59, 130, 246, 0.22)',
    heightLarge: '50px',
  },
  Alert: {
    colorError: 'rgba(127, 29, 29, 0.35)',
    borderError: '1px solid rgba(248, 113, 113, 0.35)',
    titleTextColorError: '#fecaca',
    iconColorError: '#f87171',
  },
}

async function onSubmit() {
  errorMessage.value = null
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    await auth.login(form.username.trim(), form.password)
    const role = auth.currentUser?.role ?? 'ADMIN'
    await router.push({ name: homeRouteName(role) })
  } catch (error) {
    if (error instanceof ApiClientError) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = '系統發生錯誤'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="atmosphere" aria-hidden="true">
      <div class="glow glow-a" />
      <div class="glow glow-b" />
      <div class="glow glow-c" />
      <div class="grid" />
      <div class="orbit orbit-a" />
      <div class="orbit orbit-b" />
      <span
        v-for="n in 12"
        :key="n"
        class="particle"
        :style="{ '--i': n }"
      />
    </div>

    <p class="sys-chip sys-chip-tl" aria-hidden="true">SYSTEM ONLINE</p>
    <p class="sys-chip sys-chip-tr" aria-hidden="true">SECURE CONNECTION</p>
    <p class="sys-chip sys-chip-bl" aria-hidden="true">CONTROL NODE 01</p>

    <NConfigProvider :theme="darkTheme" :theme-overrides="loginTheme">
      <div class="card-shell">
        <div class="card-sweep" aria-hidden="true" />
        <section class="card">
          <header class="heading">
            <div class="badge" aria-hidden="true">
              <span class="badge-ring" />
              <span class="badge-core">
                <Truck :size="28" stroke-width="1.75" />
              </span>
            </div>
            <h1>SquidFlow</h1>
            <p class="brand-hint">派車管理系統</p>
          </header>

          <NAlert
            v-if="auth.initError"
            type="error"
            :title="auth.initError"
            class="alert"
          />
          <NAlert
            v-if="errorMessage"
            type="error"
            :title="errorMessage"
            class="alert"
          />

          <NForm
            ref="formRef"
            :model="form"
            :rules="rules"
            size="large"
            @submit.prevent="onSubmit"
          >
            <NFormItem path="username" label="帳號">
              <NInput
                v-model:value="form.username"
                placeholder="請輸入帳號"
                autocomplete="username"
                :disabled="submitting"
              />
            </NFormItem>
            <NFormItem path="password" label="密碼">
              <NInput
                v-model:value="form.password"
                type="password"
                show-password-on="click"
                placeholder="請輸入密碼"
                autocomplete="current-password"
                :disabled="submitting"
              />
            </NFormItem>
            <NButton
              class="login-btn"
              attr-type="submit"
              block
              size="large"
              :loading="submitting"
              :disabled="submitting"
            >
              登入控制中心
            </NButton>
          </NForm>
        </section>
      </div>
    </NConfigProvider>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap');

.page {
  --login-bg: #050814;
  --login-navy: #0a1228;
  --login-blue: #3b82f6;
  --login-indigo: #4f46e5;
  --login-cyan: #67e8f9;
  --login-text: #e8eef8;
  --login-muted: rgba(148, 163, 184, 0.78);
  --login-font: 'IBM Plex Sans', 'Segoe UI', sans-serif;
  --login-display: 'Outfit', 'Segoe UI', sans-serif;

  position: relative;
  isolation: isolate;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 16px;
  overflow-x: hidden;
  overflow-y: auto;
  color: var(--login-text);
  font-family: var(--login-font);
  background:
    radial-gradient(120% 80% at 50% -10%, #132044 0%, transparent 55%),
    linear-gradient(165deg, #070b18 0%, var(--login-bg) 45%, #04060f 100%);
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
  opacity: 0.55;
  animation: drift 18s ease-in-out infinite alternate;
}

.glow-a {
  width: min(52vw, 460px);
  height: min(52vw, 460px);
  top: -12%;
  left: 8%;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.45), transparent 68%);
}

.glow-b {
  width: min(48vw, 420px);
  height: min(48vw, 420px);
  right: -8%;
  bottom: 4%;
  background: radial-gradient(circle, rgba(79, 70, 229, 0.38), transparent 70%);
  animation-delay: -6s;
  animation-duration: 22s;
}

.glow-c {
  width: min(36vw, 280px);
  height: min(36vw, 280px);
  left: 42%;
  bottom: 18%;
  background: radial-gradient(circle, rgba(103, 232, 249, 0.14), transparent 70%);
  animation-delay: -11s;
  animation-duration: 26s;
}

.grid {
  position: absolute;
  inset: -20%;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse at center, black 18%, transparent 72%);
  opacity: 0.45;
}

.orbit {
  position: absolute;
  left: 50%;
  top: 48%;
  border: 1px solid rgba(96, 165, 250, 0.12);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.orbit-a {
  width: min(92vw, 720px);
  height: min(92vw, 720px);
  box-shadow: inset 0 0 40px rgba(59, 130, 246, 0.04);
}

.orbit-b {
  width: min(70vw, 520px);
  height: min(70vw, 520px);
  border-color: rgba(129, 140, 248, 0.1);
  border-style: dashed;
}

.particle {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: rgba(191, 219, 254, 0.85);
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.65);
  left: calc(8% + (var(--i) * 7.2%));
  top: calc(12% + (var(--i) * 5.5%));
  opacity: 0.25;
  animation: float-particle 10s ease-in-out infinite;
  animation-delay: calc(var(--i) * -0.7s);
}

.sys-chip {
  position: absolute;
  z-index: 1;
  margin: 0;
  font-family: var(--login-display);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: rgba(148, 163, 184, 0.55);
  pointer-events: none;
  user-select: none;
}

.sys-chip-tl {
  top: 28px;
  left: 32px;
}

.sys-chip-tr {
  top: 28px;
  right: 32px;
}

.sys-chip-bl {
  bottom: 28px;
  left: 32px;
}

.card-shell {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 500px;
  animation: card-enter 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.card-sweep {
  position: absolute;
  inset: -1px;
  border-radius: 24px;
  overflow: hidden;
  pointer-events: none;
  z-index: 3;
}

.card-sweep::before {
  content: '';
  position: absolute;
  top: -40%;
  left: -60%;
  width: 42%;
  height: 180%;
  background: linear-gradient(
    105deg,
    transparent 0%,
    rgba(255, 255, 255, 0.08) 48%,
    transparent 100%
  );
  transform: skewX(-18deg);
  animation: sweep 7.5s ease-in-out infinite;
}

.card {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 44px 40px 40px;
  border-radius: 24px;
  background:
    linear-gradient(160deg, rgba(22, 32, 58, 0.72) 0%, rgba(10, 16, 32, 0.78) 100%);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow:
    0 0 0 1px rgba(59, 130, 246, 0.08),
    0 28px 72px rgba(0, 0, 0, 0.48),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.heading {
  text-align: center;
  margin-bottom: 36px;
}

.badge {
  position: relative;
  width: 72px;
  height: 72px;
  margin: 0 auto 20px;
}

.badge-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(96, 165, 250, 0.45);
  box-shadow:
    0 0 20px rgba(59, 130, 246, 0.35),
    inset 0 0 16px rgba(59, 130, 246, 0.15);
  animation: badge-pulse 3.2s ease-in-out infinite;
}

.badge-core {
  position: absolute;
  inset: 8px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #dbeafe;
  background:
    radial-gradient(circle at 35% 30%, rgba(147, 197, 253, 0.35), transparent 55%),
    linear-gradient(145deg, rgba(37, 99, 235, 0.55), rgba(79, 70, 229, 0.55));
  border: 1px solid rgba(191, 219, 254, 0.35);
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.28);
}

h1 {
  margin: 0 0 10px;
  font-family: var(--login-display);
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
  background: linear-gradient(115deg, #ffffff 8%, #93c5fd 48%, #818cf8 92%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.brand-hint {
  margin: 0;
  font-size: 14px;
  color: var(--login-muted);
}

.alert {
  margin-bottom: var(--space-16);
}

.login-btn {
  --n-height: 54px !important;
  --n-font-size: 16px !important;
  --n-border: none !important;
  --n-border-hover: none !important;
  --n-border-pressed: none !important;
  --n-border-focus: none !important;
  --n-border-disabled: none !important;
  --n-color: transparent !important;
  --n-color-hover: transparent !important;
  --n-color-pressed: transparent !important;
  --n-color-focus: transparent !important;
  --n-color-disabled: rgba(37, 99, 235, 0.35) !important;
  --n-text-color: #f8fafc !important;
  --n-text-color-hover: #ffffff !important;
  --n-text-color-pressed: #e2e8f0 !important;
  --n-text-color-disabled: rgba(226, 232, 240, 0.55) !important;
  --n-ripple-color: rgba(147, 197, 253, 0.35) !important;
  margin-top: 10px;
  min-height: 54px;
  border-radius: 12px !important;
  font-family: var(--login-display) !important;
  font-weight: 600 !important;
  letter-spacing: 0.02em;
  background: linear-gradient(120deg, #2563eb 0%, #4f46e5 100%) !important;
  box-shadow:
    0 0 0 1px rgba(147, 197, 253, 0.22),
    0 10px 28px rgba(37, 99, 235, 0.35) !important;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    filter 180ms ease !important;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.06);
  box-shadow:
    0 0 0 1px rgba(191, 219, 254, 0.35),
    0 14px 34px rgba(37, 99, 235, 0.45) !important;
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
  filter: brightness(0.96);
}

@keyframes drift {
  from {
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    transform: translate3d(18px, -14px, 0) scale(1.06);
  }
}

@keyframes float-particle {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
    opacity: 0.15;
  }
  50% {
    transform: translate3d(0, -14px, 0);
    opacity: 0.55;
  }
}

@keyframes badge-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.85;
  }
  50% {
    transform: scale(1.06);
    opacity: 1;
  }
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translate3d(0, 18px, 0) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes sweep {
  0%,
  55% {
    transform: translateX(0) skewX(-18deg);
    opacity: 0;
  }
  65% {
    opacity: 0.7;
  }
  100% {
    transform: translateX(420%) skewX(-18deg);
    opacity: 0;
  }
}

@media (max-width: 640px) {
  .page {
    padding: 16px 12px;
    align-items: center;
  }

  .sys-chip {
    display: none;
  }

  .orbit {
    display: none;
  }

  .card-shell {
    max-width: 100%;
    animation-duration: 500ms;
  }

  .card {
    padding: 32px 22px 28px;
    border-radius: 20px;
  }

  .card-sweep {
    border-radius: 20px;
  }

  .heading {
    margin-bottom: 28px;
  }

  .badge {
    width: 64px;
    height: 64px;
    margin-bottom: 16px;
  }

  h1 {
    font-size: 30px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .glow,
  .particle,
  .badge-ring,
  .card-shell,
  .card-sweep::before,
  .login-btn {
    animation: none !important;
    transition: none !important;
  }

  .card-shell {
    opacity: 1;
    transform: none;
  }

  .login-btn:hover:not(:disabled),
  .login-btn:active:not(:disabled) {
    transform: none;
  }
}
</style>
