<script setup lang="ts">
withDefaults(
  defineProps<{
    show?: boolean
  }>(),
  {
    show: false,
  },
)
</script>

<template>
  <div class="refreshable" :class="{ 'is-refreshing': show }">
    <div
      v-if="show"
      class="refresh-overlay"
      aria-busy="true"
      aria-live="polite"
    >
      <span class="refresh-spinner" aria-hidden="true" />
    </div>
    <slot />
  </div>
</template>

<style scoped>
.refreshable {
  position: relative;
  min-width: 0;
}

.refresh-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  background: color-mix(in srgb, var(--color-surface) 72%, transparent);
  backdrop-filter: blur(2px);
  pointer-events: all;
}

.refresh-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid color-mix(in srgb, var(--color-primary) 22%, transparent);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: refresh-overlay-spin 0.9s linear infinite;
}

@keyframes refresh-overlay-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .refresh-spinner {
    animation: none;
    border-top-color: var(--color-primary);
    opacity: 0.85;
  }
}
</style>
