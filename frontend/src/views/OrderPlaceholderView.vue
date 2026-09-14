<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { NButton } from 'naive-ui'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <section class="page">
    <NButton text type="primary" @click="router.push({ name: 'orders' })">
      <template #icon>
        <ArrowLeft :size="16" />
      </template>
      返回訂單列表
    </NButton>
    <h1>訂單詳情</h1>
    <p>此畫面尚未開放。</p>
  </section>
</template>

<style scoped>
.page {
  max-width: 640px;
}

h1 {
  margin: var(--space-16) 0 var(--space-8);
  font: var(--font-page-title);
}

p {
  margin: 0;
  color: var(--color-muted-text);
}
</style>
