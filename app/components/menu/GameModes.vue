<template>
  <div class="game-modes" role="group" aria-label="Game configuration">
    <button
      v-for="config in configs"
      :key="config.id"
      type="button"
      class="game-mode"
      :class="{ 'game-mode-selected': selectedConfig === config.id }"
      :disabled="disabled"
      :aria-label="`${config.name} (${config.id})`"
      :aria-pressed="selectedConfig === config.id"
      :title="config.name"
      @click="selectedConfig = config.id"
    >
      <img
        v-if="!failedSprites.has(config.id)"
        :src="spriteUrl(gameModeSpritePath(config.id))"
        alt=""
        @error="failedSprites.add(config.id)"
      />
      <span v-else class="game-mode-fallback">
        <UIcon name="i-lucide-cog" class="game-mode-icon" aria-hidden="true" />
        <span>{{ config.name }}</span>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AvailableConfig } from '~~/game/configValidation'
import { gameModeSpritePath } from '~/utils/gameModes'

const props = defineProps<{
  configs: AvailableConfig[]
  disabled?: boolean
}>()
const selectedConfig = defineModel<string>({ required: true })
const spriteUrl = useSpriteUrl()
const failedSprites = ref(new Set<string>())

watch(() => props.configs, () => {
  failedSprites.value = new Set()
})
</script>

<style scoped>
.game-modes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.game-mode {
  aspect-ratio: 1;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 3px solid transparent;
  border-radius: 0.7rem;
  cursor: pointer;
}

.game-mode:disabled {
  cursor: wait;
}

.game-mode-selected {
  border-color: var(--game-gold-text);
}

.game-mode img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.game-mode-fallback {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  overflow-wrap: anywhere;
}

.game-mode-icon {
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
}
</style>
