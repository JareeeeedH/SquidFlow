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
      <p class="subtitle">建立帳號與車輛資料。上線狀態由系統決定。</p>
    </header>

    <div class="panel">
      <DriverForm
        mode="create"
        submit-label="建立司機"
        grouped
        :submitting="submitting"
        :error="error"
        show-cancel
        @submit="onSubmit"
        @cancel="router.push({ name: 'drivers' })"
      />
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
}

.page-header,
.panel {
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

.panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  padding: var(--space-32);
}

@media (max-width: 640px) {
  .panel {
    padding: var(--space-16);
  }
}
</style>
