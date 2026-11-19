<template>
  <h1 class="game-header-brand">
    <img
      class="game-logo"
      :src="`${app.baseURL}logo.png`"
      alt="Swonster"
      width="80"
      height="80"
    >
  </h1>
</template>

<script lang="ts" setup>
const { app } = useRuntimeConfig()

</script>

<style>
.game-header-brand {
  flex: 0 0 auto;
  margin: 0;
}

.game-logo {
  display: block;
  width: clamp(4rem, 16vw, 5rem);
  height: clamp(4rem, 16vw, 5rem);
  border: 2px solid color-mix(in srgb, var(--ui-color-warning-400) 65%, var(--ui-border));
  border-radius: 1.15rem;
  box-shadow:
    0 0.75rem 2rem color-mix(in srgb, var(--ui-color-primary-950) 18%, transparent),
    0 0 0 0.25rem color-mix(in srgb, var(--ui-color-warning-500) 8%, transparent);
  object-fit: cover;
}

</style>