<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { NButton } from 'naive-ui'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createOrder } from '../api/orders'
import { ApiClientError } from '../api/types'
import type { CreateOrderInput } from '../api/types'
import OrderForm from '../components/OrderForm.vue'

const router = useRouter()
const submitting = ref(false)
const error = ref<{ code: string; message: string } | null>(null)

async function onSubmit(input: CreateOrderInput) {
  if (submitting.value) {
    return
  }

  submitting.value = true
  error.value = null

  try {
    const created = await createOrder(input)
    await router.push({ name: 'order-detail', params: { id: created.id } })
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
    <NButton text type="primary" @click="router.push({ name: 'orders' })">
      <template #icon>
        <ArrowLeft :size="16" />
      </template>
      返回訂單列表
    </NButton>

    <header class="page-header">
      <h1>建立派車單</h1>
      <p class="subtitle">儲存後會建立草稿，可再查看訂單內容。</p>
    </header>

    <div class="panel">
      <OrderForm
        submit-label="儲存草稿"
        :submitting="submitting"
        :error="error"
        @submit="onSubmit"
      />
    </div>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  max-width: 640px;
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
  padding: var(--space-24);
}
</style>
