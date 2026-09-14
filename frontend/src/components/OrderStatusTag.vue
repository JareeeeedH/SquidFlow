<script setup lang="ts">
import { NTag } from 'naive-ui'
import { computed } from 'vue'
import type { OrderStatus } from '../api/types'

const props = defineProps<{
  status: OrderStatus
}>()

const STATUS_VISUAL: Record<
  OrderStatus,
  { label: string; type: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error' }
> = {
  DRAFT: { label: '草稿', type: 'default' },
  OPEN: { label: '搶單中', type: 'warning' },
  ACCEPTED: { label: '已接單', type: 'info' },
  IN_PROGRESS: { label: '行程中', type: 'primary' },
  COMPLETED: { label: '已完成', type: 'success' },
  CANCELLED: { label: '已取消', type: 'error' },
}

const visual = computed(() => STATUS_VISUAL[props.status])
</script>

<template>
  <NTag :type="visual.type" size="small" :bordered="false">
    {{ visual.label }}
  </NTag>
</template>
