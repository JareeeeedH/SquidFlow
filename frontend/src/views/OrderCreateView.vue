<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import {
  NAlert,
  NButton,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createOrder } from '../api/orders'
import { ApiClientError } from '../api/types'
import { toScheduledAtIso } from '../lib/format'

const router = useRouter()
const formRef = ref<FormInst | null>(null)
const submitting = ref(false)
const error = ref<{ code: string; message: string } | null>(null)

const form = reactive({
  customer_name: '',
  pickup_location: '',
  destination: '',
  scheduled_at: null as number | null,
  vehicle_type: '',
  price: null as number | null,
  note: '',
})

const rules: FormRules = {
  customer_name: {
    required: true,
    message: '請輸入客戶姓名',
    trigger: ['blur', 'input'],
  },
  pickup_location: {
    required: true,
    message: '請輸入上車地點',
    trigger: ['blur', 'input'],
  },
  destination: {
    required: true,
    message: '請輸入目的地',
    trigger: ['blur', 'input'],
  },
  scheduled_at: {
    required: true,
    type: 'number',
    message: '請選擇預約時間',
    trigger: ['blur', 'change'],
  },
  vehicle_type: {
    required: true,
    message: '請輸入車型',
    trigger: ['blur', 'input'],
  },
  price: {
    required: true,
    type: 'number',
    message: '請輸入價格',
    trigger: ['blur', 'change'],
  },
}

async function onSubmit() {
  if (submitting.value) {
    return
  }

  submitting.value = true
  error.value = null

  try {
    await formRef.value?.validate()
  } catch {
    submitting.value = false
    return
  }

  if (form.scheduled_at == null || form.price == null) {
    submitting.value = false
    return
  }

  try {
    const created = await createOrder({
      customer_name: form.customer_name.trim(),
      pickup_location: form.pickup_location.trim(),
      destination: form.destination.trim(),
      scheduled_at: toScheduledAtIso(form.scheduled_at),
      vehicle_type: form.vehicle_type.trim(),
      price: form.price,
      note: form.note.trim() || undefined,
    })
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

    <NForm
      ref="formRef"
      class="panel"
      :model="form"
      :rules="rules"
      label-placement="top"
      @submit.prevent="onSubmit"
    >
      <NAlert
        v-if="error"
        type="error"
        :title="`${error.code} · ${error.message}`"
        class="alert"
      />

      <NFormItem path="customer_name" label="客戶姓名">
        <NInput
          v-model:value="form.customer_name"
          placeholder="例如 王先生"
          :disabled="submitting"
        />
      </NFormItem>
      <NFormItem path="pickup_location" label="上車地點">
        <NInput
          v-model:value="form.pickup_location"
          placeholder="例如 左營高鐵站"
          :disabled="submitting"
        />
      </NFormItem>
      <NFormItem path="destination" label="目的地">
        <NInput
          v-model:value="form.destination"
          placeholder="例如 高雄小港機場"
          :disabled="submitting"
        />
      </NFormItem>
      <NFormItem path="scheduled_at" label="預約時間">
        <NDatePicker
          v-model:value="form.scheduled_at"
          class="datetime"
          type="datetime"
          format="yyyy/MM/dd HH:mm"
          placeholder="選擇台灣時間"
          :disabled="submitting"
          clearable
        />
      </NFormItem>
      <NFormItem path="vehicle_type" label="車型">
        <NInput
          v-model:value="form.vehicle_type"
          placeholder="例如 5人座"
          :disabled="submitting"
        />
      </NFormItem>
      <NFormItem path="price" label="價格">
        <NInputNumber
          v-model:value="form.price"
          class="price"
          :show-button="false"
          :precision="2"
          placeholder="例如 1200"
          :disabled="submitting"
        >
          <template #prefix>NT$</template>
        </NInputNumber>
      </NFormItem>
      <NFormItem path="note" label="備註">
        <NInput
          v-model:value="form.note"
          type="textarea"
          placeholder="選填"
          :disabled="submitting"
          :autosize="{ minRows: 3, maxRows: 6 }"
        />
      </NFormItem>

      <div class="actions">
        <NButton
          type="primary"
          attr-type="submit"
          :loading="submitting"
          :disabled="submitting"
        >
          儲存草稿
        </NButton>
      </div>
    </NForm>
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

.alert {
  margin-bottom: var(--space-16);
}

.datetime,
.price {
  width: 100%;
}

.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
