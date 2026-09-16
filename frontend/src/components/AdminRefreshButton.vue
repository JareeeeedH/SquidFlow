<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { NButton } from 'naive-ui'

withDefaults(
  defineProps<{
    label: string
    disabled?: boolean
    spinning?: boolean
    size?: 'tiny' | 'small' | 'medium' | 'large'
    text?: boolean
    primary?: boolean
  }>(),
  {
    disabled: false,
    spinning: false,
    size: 'medium',
    text: false,
    primary: false,
  },
)

defineEmits<{
  click: []
}>()
</script>

<template>
  <NButton
    :text="text"
    :type="primary ? 'primary' : 'default'"
    :quaternary="!text && !primary"
    :size="size"
    :disabled="disabled"
    class="admin-refresh-btn"
    @click="$emit('click')"
  >
    <template #icon>
      <RotateCcw
        class="admin-refresh-icon"
        :class="{ 'is-spinning': spinning }"
        :size="size === 'small' || size === 'tiny' ? 14 : 16"
      />
    </template>
    {{ label }}
  </NButton>
</template>

<style scoped>
.admin-refresh-icon {
  transform-origin: center;
}

.admin-refresh-icon.is-spinning {
  animation: admin-refresh-spin 1.25s linear infinite;
}

@keyframes admin-refresh-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-refresh-icon.is-spinning {
    animation: none;
  }
}
</style>
