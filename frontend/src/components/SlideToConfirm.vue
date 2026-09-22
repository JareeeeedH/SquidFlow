<script setup lang="ts">
/* eslint-disable no-undef -- DOM typings used in pointer slide handlers */
import { ChevronRight } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    loadingLabel?: string
    disabled?: boolean
    loading?: boolean
  }>(),
  {
    loadingLabel: '處理中...',
    disabled: false,
    loading: false,
  },
)

const emit = defineEmits<{
  confirm: []
}>()

const trackRef = ref<HTMLElement | null>(null)
const offset = ref(0)
const dragging = ref(false)
const completed = ref(false)

const maxOffset = ref(0)
const startX = ref(0)
const startOffset = ref(0)

const locked = computed(() => props.disabled || props.loading || completed.value)

const fillRatio = computed(() => {
  if (maxOffset.value <= 0) {
    return 0
  }
  return Math.min(1, Math.max(0, offset.value / maxOffset.value))
})

const displayLabel = computed(() =>
  props.loading ? props.loadingLabel : props.label,
)

function measure() {
  const track = trackRef.value
  if (!track) {
    return
  }
  const thumb = 48
  const pad = 4
  maxOffset.value = Math.max(0, track.clientWidth - thumb - pad * 2)
}

function reset() {
  offset.value = 0
  dragging.value = false
  completed.value = false
}

function finish() {
  if (props.disabled || props.loading || completed.value) {
    return
  }
  completed.value = true
  offset.value = maxOffset.value
  emit('confirm')
}

function onPointerDown(event: PointerEvent) {
  if (locked.value) {
    return
  }
  measure()
  dragging.value = true
  startX.value = event.clientX
  startOffset.value = offset.value
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value || locked.value) {
    return
  }
  const delta = event.clientX - startX.value
  offset.value = Math.min(maxOffset.value, Math.max(0, startOffset.value + delta))
}

function onPointerUp(event: PointerEvent) {
  if (!dragging.value) {
    return
  }
  dragging.value = false
  try {
    ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
  } catch {
    // ignore
  }
  if (maxOffset.value > 0 && offset.value >= maxOffset.value * 0.88) {
    finish()
    return
  }
  offset.value = 0
}

watch(
  () => props.loading,
  (value, previous) => {
    if (previous && !value) {
      reset()
    }
  },
)

watch(
  () => props.disabled,
  (value) => {
    if (value) {
      reset()
    }
  },
)

onBeforeUnmount(() => {
  dragging.value = false
})

defineExpose({
  reset,
  /** Test / a11y helper: complete the slide and emit confirm. */
  complete: () => {
    measure()
    finish()
  },
})
</script>

<template>
  <div
    ref="trackRef"
    class="slide"
    :class="{
      'is-disabled': disabled,
      'is-loading': loading,
      'is-dragging': dragging,
      'is-complete': completed,
    }"
    role="slider"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuenow="Math.round(fillRatio * 100)"
    :aria-disabled="locked ? 'true' : 'false'"
    :aria-label="displayLabel"
  >
    <div class="slide-fill" :style="{ width: `${fillRatio * 100}%` }" />
    <p class="slide-label">{{ displayLabel }}</p>
    <button
      type="button"
      class="slide-thumb"
      :style="{ transform: `translateX(${offset}px)` }"
      :disabled="locked"
      aria-hidden="true"
      tabindex="-1"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <span v-if="loading" class="slide-spinner" aria-hidden="true" />
      <ChevronRight v-else :size="22" stroke-width="2.5" />
    </button>
  </div>
</template>

<style scoped>
.slide {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 56px;
  padding: 4px;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-primary, #3b82f6) 16%, rgba(28, 38, 62, 0.95)),
    color-mix(in srgb, var(--color-primary, #3b82f6) 10%, rgba(22, 32, 54, 0.98))
  );
  border: 1px solid color-mix(in srgb, var(--color-primary, #3b82f6) 32%, var(--color-border, rgba(186, 203, 225, 0.26)));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 8px 20px rgba(8, 12, 24, 0.25);
  user-select: none;
  touch-action: none;
  overflow: hidden;
}

.slide-fill {
  position: absolute;
  left: 4px;
  top: 4px;
  bottom: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary, #3b82f6) 28%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--color-primary, #3b82f6) 22%, transparent);
  pointer-events: none;
  transition: width 0.05s linear;
}

.slide.is-dragging .slide-fill {
  transition: none;
}

.slide-label {
  position: relative;
  z-index: 1;
  margin: 0;
  padding: 0 56px;
  color: #e2e8f0;
  font: var(--font-label);
  font-weight: 700;
  letter-spacing: 0.04em;
  pointer-events: none;
  opacity: 0.92;
}

.slide-thumb {
  position: absolute;
  left: 4px;
  top: 50%;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-top: -24px;
  border: 0;
  border-radius: 999px;
  color: #f8fafc;
  background: linear-gradient(145deg, #60a5fa 0%, var(--color-primary, #3b82f6) 50%, #4f46e5 100%);
  box-shadow:
    0 6px 16px rgba(37, 99, 235, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
  cursor: grab;
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide.is-dragging .slide-thumb {
  transition: none;
  cursor: grabbing;
}

.slide-thumb:disabled {
  cursor: default;
  opacity: 0.92;
}

.slide.is-disabled,
.slide.is-loading {
  opacity: 0.92;
}

.slide-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgb(248 250 252 / 35%);
  border-top-color: #f8fafc;
  border-radius: 50%;
  animation: slide-spin 0.8s linear infinite;
}

@keyframes slide-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .slide-thumb,
  .slide-fill,
  .slide-spinner {
    transition: none;
    animation: none;
  }
}
</style>
