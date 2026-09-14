<script setup lang="ts">
import { NTag } from 'naive-ui'
import { computed } from 'vue'
import type { AccountStatus } from '../api/types'

const props = defineProps<{
  status: AccountStatus
}>()

const visual = computed(() =>
  props.status === 'ACTIVE'
    ? { label: '啟用', type: 'success' as const }
    : { label: '停用', type: 'error' as const },
)
</script>

<template>
  <NTag :type="visual.type" size="small" :bordered="false">
    {{ visual.label }}
  </NTag>
</template>
