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
  background: color-mix(in srgb, var(--color-background, #070b18) 55%, transparent);
  backdrop-filter: blur(3px);
  pointer-events: all;
  animation: refresh-overlay-fade 180ms ease both;
}

.refresh-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid color-mix(in srgb, var(--color-primary) 22%, transparent);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  box-shadow: 0 0 18px color-mix(in srgb, var(--color-primary) 28%, transparent);
  animation: refresh-overlay-spin 0.9s linear infinite;
}

@keyframes refresh-overlay-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes refresh-overlay-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .refresh-spinner,
  .refresh-overlay {
    animation: none;
  }

  .refresh-spinner {
    border-top-color: var(--color-primary);
    opacity: 0.85;
  }
}
</style>
