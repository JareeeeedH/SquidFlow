<script setup lang="ts">
import { useAppStore } from '../stores/app'

const app = useAppStore()
</script>

<template>
  <main>
    <h1>{{ app.name }}</h1>
    <p>Frontend is running.</p>
  </main>
</template>
