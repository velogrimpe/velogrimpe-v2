<script setup lang="ts">
import { useToast } from "@/composables/useToast";

const { toasts, removeToast } = useToast();
</script>

<template>
  <div class="toast toast-end z-[9999]">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="alert shadow-lg"
      :class="{
        'alert-success': toast.type === 'success',
        'alert-error': toast.type === 'error',
        'alert-info': toast.type === 'info',
      }"
    >
      <span>{{ toast.message }}</span>
      <button
        class="btn btn-sm btn-ghost btn-circle"
        @click="removeToast(toast.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>
