<script setup lang="ts">
import {
  NAlert,
  NButton,
  NDatePicker,
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

.datetime,
.price {
  width: 100%;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-8);
}
</style>
