<script setup lang="ts">
import {
  NAlert,
  NButton,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  type FormInst,
} from 'naive-ui'
import { reactive, ref, watch } from 'vue'
import type { CreateOrderInput } from '../api/types'
import {
  emptyOrderFormValues,
  formValuesToInput,
  orderFormRules,
  type OrderFormValues,
} from '../lib/order-form'

const props = defineProps<{
  submitLabel: string
  submitting: boolean
  error: { code: string; message: string } | null
  initialValues?: OrderFormValues | null
  showCancel?: boolean
  grouped?: boolean
}>()

const emit = defineEmits<{
  submit: [input: CreateOrderInput]
  cancel: []
}>()

const formRef = ref<FormInst | null>(null)
const form = reactive<OrderFormValues>(emptyOrderFormValues())
const locked = ref(false)

watch(
  () => props.initialValues,
  (value) => {
    Object.assign(form, value ?? emptyOrderFormValues())
  },
  { immediate: true, deep: true },
)

watch(
  () => props.submitting,
  (value, previous) => {
    if (previous && !value) {
      locked.value = false
    }
  },
)

async function onSubmit() {
  if (props.submitting || locked.value) {
    return
  }

  locked.value = true

  try {
    await formRef.value?.validate()
  } catch {
    locked.value = false
    return
  }

  const input = formValuesToInput(form)
  if (!input) {
    locked.value = false
    return
  }

  emit('submit', input)
}
</script>

<template>
  <NForm
    ref="formRef"
    class="order-form"
    :class="{ grouped }"
    :model="form"
    :rules="orderFormRules"
    label-placement="top"
    @submit.prevent="onSubmit"
  >
    <NAlert
      v-if="error"
      type="error"
      :title="`${error.code} · ${error.message}`"
      class="alert"
    />

    <section class="form-section">
      <header v-if="grouped" class="section-header">
        <h2>行程資訊</h2>
        <p>上車地點為必填，其餘可留空。</p>
      </header>
      <NFormItem path="customer_name" label="客戶姓名">
        <NInput
          v-model:value="form.customer_name"
          placeholder="例如 王先生"
          :disabled="submitting"
        />
      </NFormItem>
      <NFormItem
        path="pickup_location"
        class="pickup-field"
        label="上車地點"
        required
      >
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
    </section>

    <section class="form-section">
      <header v-if="grouped" class="section-header">
        <h2>費用與備註</h2>
        <p>價格與備註皆為選填。</p>
      </header>
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
    </section>

    <div class="actions">
      <NButton
        v-if="showCancel"
        quaternary
        :disabled="submitting"
        @click="emit('cancel')"
      >
        取消
      </NButton>
      <NButton
        type="primary"
        attr-type="submit"
        :loading="submitting"
        :disabled="submitting"
      >
        {{ submitLabel }}
      </NButton>
    </div>
  </NForm>
</template>

<style scoped>
.alert {
  margin-bottom: var(--space-16);
}

.form-section {
  display: flex;
  flex-direction: column;
}

.section-header {
  margin-bottom: var(--space-16);
}

.section-header h2 {
  margin: 0;
  font: var(--font-section-title);
}

.section-header p {
  margin: var(--space-4) 0 0;
  color: var(--color-muted-text);
  font: var(--font-caption);
}

.grouped .form-section + .form-section {
  margin-top: var(--space-8);
  padding-top: var(--space-24);
  border-top: 1px solid var(--color-border);
}

.grouped :deep(.n-form-item) {
  margin-bottom: var(--space-16);
}

.grouped .form-section :deep(.n-form-item:last-child) {
  margin-bottom: 0;
}

.pickup-field :deep(.n-form-item-label) {
  font: var(--font-label);
  color: var(--color-text);
}

.price {
  width: 100%;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-8);
}

.grouped .actions {
  margin-top: var(--space-24);
  padding-top: var(--space-24);
  border-top: 1px solid var(--color-border);
}
</style>
