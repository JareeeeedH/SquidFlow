<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { NButton } from 'naive-ui'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createOrder, publishOrder } from '../api/orders'
import { ApiClientError } from '../api/types'
import type { CreateOrderInput } from '../api/types'
import OrderForm from '../components/OrderForm.vue'

const router = useRouter()
const formRef = ref<{
  submitDraft: () => Promise<void>
  submitPublish: () => Promise<void>
} | null>(null)
const submitting = ref(false)
const error = ref<{ code: string; message: string } | null>(null)

async function createThenNavigate(input: CreateOrderInput, publish: boolean) {
  if (submitting.value) {
    return
  }

  submitting.value = true
  error.value = null

  try {
    const created = await createOrder(input)
    if (publish) {
      await publishOrder(created.id)
    }
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

function onSubmit(input: CreateOrderInput) {
  void createThenNavigate(input, false)
}

function onPublish(input: CreateOrderInput) {
  void createThenNavigate(input, true)
}
</script>

<template>
  <section class="page">
    <NButton
      class="back"
      text
      type="primary"
      @click="router.push({ name: 'orders' })"
    >
      <template #icon>
        <ArrowLeft :size="16" />
      </template>
      返回訂單列表
    </NButton>

    <header class="page-header">
      <h1>建立派車單</h1>
    </header>

    <div class="panel">
      <OrderForm
        ref="formRef"
        submit-label="儲存草稿"
        secondary-label="發布搶單"
        grouped
        hide-actions
        :submitting="submitting"
        :error="error"
        @submit="onSubmit"
        @publish="onPublish"
      />
    </div>

    <div class="cta-bar">
      <NButton
        class="cta"
        secondary
        :loading="submitting"
        :disabled="submitting"
        @click="formRef?.submitDraft()"
      >
        儲存草稿
      </NButton>
      <NButton
        class="cta"
        type="primary"
        :loading="submitting"
        :disabled="submitting"
        @click="formRef?.submitPublish()"
      >
        發布搶單
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
  margin: 0 auto;
  padding-bottom: 88px;
}

.page-header,
.panel {
  width: 100%;
}

.back {
  align-self: flex-start;
}

.page-header h1 {
  margin: 0;
  font: var(--font-page-title);
}

.panel {
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
  flex: 0 1 auto;
  min-width: 120px;
}

@media (max-width: 900px) {
  .page {
    max-width: none;
    margin: 0;
    padding-bottom: 96px;
  }

  .panel {
    padding: var(--space-16);
    border-radius: var(--radius-8);
  }

  .cta-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0;
    padding: var(--space-12) var(--space-16);
    justify-content: stretch;
  }

  .cta {
    flex: 1;
    min-width: 0;
  }
}
</style>
