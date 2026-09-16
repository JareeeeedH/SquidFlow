<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { NButton } from 'naive-ui'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createDriver } from '../api/drivers'
import { ApiClientError } from '../api/types'
import type { CreateDriverInput, UpdateDriverInput } from '../api/types'
import DriverForm from '../components/DriverForm.vue'

const router = useRouter()
const formRef = ref<{ submit: () => Promise<void> } | null>(null)
const submitting = ref(false)
const error = ref<{ code: string; message: string } | null>(null)

async function onSubmit(input: CreateDriverInput | UpdateDriverInput) {
  if (submitting.value) {
    return
  }

  submitting.value = true
  error.value = null

  try {
    if (!input.password) {
      return
    }
    const created = await createDriver({ ...input, password: input.password })
    await router.push({ name: 'driver-detail', params: { id: created.id } })
  } catch (caught) {
    if (caught instanceof ApiClientError) {
      error.value = { code: caught.code, message: caught.message }
    } else {
      error.value = { code: 'INTERNAL_ERROR', message: '系統發生錯誤' }
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="page">
    <NButton
      class="back"
      text
      type="primary"
      @click="router.push({ name: 'drivers' })"
    >
      <template #icon>
        <ArrowLeft :size="16" />
      </template>
      返回司機列表
    </NButton>

    <header class="page-header">
      <h1>新增司機</h1>
    </header>

    <div class="form-shell">
      <DriverForm
        ref="formRef"
        mode="create"
        submit-label="建立司機"
        grouped
        hide-actions
        :submitting="submitting"
        :error="error"
        @submit="onSubmit"
      />
    </div>

    <div class="cta-bar">
      <NButton
        quaternary
        class="cta-cancel"
        :disabled="submitting"
        @click="router.push({ name: 'drivers' })"
      >
        取消
      </NButton>
      <NButton
        class="cta"
        type="primary"
        :loading="submitting"
        :disabled="submitting"
        @click="formRef?.submit()"
      >
        建立司機
      </NButton>
    </div>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  width: 100%;
  max-width: 800px;
  min-width: 0;
  margin: 0 auto;
  padding-bottom: 88px;
}

.page-header,
.form-shell {
  width: 100%;
  min-width: 0;
}

.back {
  align-self: flex-start;
}

.page-header h1 {
  margin: 0;
  font: var(--font-page-title);
}

.subtitle {
  margin: var(--space-4) 0 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.form-shell {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  padding: var(--space-32);
}

.cta-bar {
  display: flex;
  gap: var(--space-8);
  justify-content: flex-end;
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin: 0 calc(-1 * var(--space-32));
  padding: var(--space-12) var(--space-32);
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  border-top: 1px solid var(--color-border);
  backdrop-filter: blur(8px);
}

.cta {
  min-width: 120px;
}

@media (max-width: 900px) {
  .page {
    gap: var(--space-12);
    max-width: none;
    margin: 0;
    padding-bottom: 104px;
  }

  .page-header h1 {
    font-size: 22px;
    line-height: 1.25;
  }

  .form-shell {
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
  }

  .cta-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0;
    padding: var(--space-12) var(--space-16);
  }

  .cta-cancel {
    display: none;
  }

  .cta {
    flex: 1;
    min-height: 44px;
  }
}
</style>
