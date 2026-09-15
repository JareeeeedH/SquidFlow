<script setup lang="ts">
import { Truck } from 'lucide-vue-next'
import {
  NAlert,
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  type FormInst,
  type FormRules,
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
    <NCard class="card" :bordered="false">
      <div class="heading">
        <Truck :size="28" class="logo" />
        <h1>SquidFlow</h1>
        <p>派車管理系統</p>
      </div>

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
          type="primary"
          attr-type="submit"
          block
          size="large"
          :loading="submitting"
          :disabled="submitting"
        >
          登入
        </NButton>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-24);
  background: var(--color-background);
}

.card {
  width: 100%;
  max-width: 400px;
  border-radius: var(--radius-12);
  box-shadow: 0 8px 24px rgb(17 24 39 / 6%);
}

.heading {
  text-align: center;
  margin-bottom: var(--space-24);
}

.logo {
  color: var(--color-primary);
}

h1 {
  margin: var(--space-8) 0 var(--space-4);
  font: var(--font-page-title);
}

p {
  margin: 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.alert {
  margin-bottom: var(--space-16);
}

@media (max-width: 640px) {
  .page {
    padding: var(--space-16);
    align-items: flex-start;
    padding-top: var(--space-32);
  }

  .card {
    box-shadow: none;
  }
}
</style>
