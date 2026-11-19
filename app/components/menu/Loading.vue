<template>
  <div class="flex flex-col items-center justify-center w-full">
    <UIcon
      name="i-lucide-loader-circle"
      :class="['animate-spin', iconClasses]"
      :style="{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem` }"
    />
    <p v-if="text !== ''" class="text-muted">{{ text }}</p>
  </div>
</template>

<script lang="ts" setup>
const {
  iconClasses = '',
  text = '',
  size = 6,
} = defineProps<{
  iconClasses?: string
  text?: string
  size?: number
}>()
</script>
