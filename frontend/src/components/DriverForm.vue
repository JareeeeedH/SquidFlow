<script setup lang="ts">
import {
  NAlert,
  NButton,
  NForm,
  NFormItem,
  NInput,
  type FormInst,
} from 'naive-ui'
import { computed, reactive, ref, watch } from 'vue'
import type { CreateDriverInput, UpdateDriverInput } from '../api/types'
import {
  driverFormRules,
  emptyDriverFormValues,
  formValuesToCreateInput,
  formValuesToUpdateInput,
  type DriverFormValues,
} from '../lib/driver-form'

const props = defineProps<{
  mode: 'create' | 'edit'
  submitLabel: string
  submitting: boolean
  error: { code: string; message: string } | null
  initialValues?: DriverFormValues | null
  showCancel?: boolean
}>()

const emit = defineEmits<{
  submit: [input: CreateDriverInput | UpdateDriverInput]
  cancel: []
}>()

const formRef = ref<FormInst | null>(null)
const form = reactive<DriverFormValues>(emptyDriverFormValues())
const locked = ref(false)
const rules = computed(() => driverFormRules(props.mode))

watch(
  () => props.initialValues,
  (value) => {
    Object.assign(form, value ?? emptyDriverFormValues())
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

  const input =
    props.mode === 'create'
      ? formValuesToCreateInput(form)
      : formValuesToUpdateInput(form)

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
    class="driver-form"
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

    <NFormItem path="username" label="帳號">
      <NInput
        v-model:value="form.username"
        placeholder="例如 driver01"
        autocomplete="username"
        :disabled="submitting"
      />
    </NFormItem>
    <NFormItem path="password" label="密碼">
      <NInput
        v-model:value="form.password"
        type="password"
        show-password-on="click"
        :placeholder="mode === 'edit' ? '空白則不修改密碼' : '請輸入密碼'"
        autocomplete="new-password"
        :disabled="submitting"
      />
    </NFormItem>
    <NFormItem path="license_plate" label="車牌">
      <NInput
        v-model:value="form.license_plate"
        placeholder="例如 ABC-1234"
        :disabled="submitting"
      />
    </NFormItem>
    <NFormItem path="vehicle_brand" label="品牌">
      <NInput
        v-model:value="form.vehicle_brand"
        placeholder="例如 Toyota"
        :disabled="submitting"
      />
    </NFormItem>
    <NFormItem path="vehicle_model" label="型號">
      <NInput
        v-model:value="form.vehicle_model"
        placeholder="例如 Camry"
        :disabled="submitting"
      />
    </NFormItem>
    <NFormItem path="vehicle_color" label="車色">
      <NInput
        v-model:value="form.vehicle_color"
        placeholder="例如 黑色"
        :disabled="submitting"
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

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-8);
}
</style>
