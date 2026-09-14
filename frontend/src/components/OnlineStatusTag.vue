<script setup lang="ts">
import { NTag } from 'naive-ui'
import { computed } from 'vue'
import type { OnlineStatus } from '../api/types'

const props = defineProps<{
  status: OnlineStatus
}>()

const visual = computed(() =>
  props.status === 'ONLINE'
    ? { label: '上線', type: 'success' as const }
    : { label: '離線', type: 'default' as const },
)
</script>

<template>
  <NTag :type="visual.type" size="small" :bordered="true">
    {{ visual.label }}
  </NTag>
</template>
