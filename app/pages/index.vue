<template>
  <section class="game-menu" aria-label="Main menu">
    <MenuHeader class="mb-6" />

    <template v-if="!ready && error === ''">
      <MenuLoading text="Loading game data..." :size="8" />
    </template>

    <template v-if="!loading && ready">
      <div class="text-center text-xl">
        Welcome to Swonster!
      </div>
      <form
        class="game-menu-username"
        @submit.prevent="saveUsername(username)"
      >
        <input
          id="username"
          v-model="username"
          class="text-center"
          maxlength="32"
          required
        />
        <button v-if="hasUnsavedUsername" type="submit" :disabled="loading">
          Save username
        </button>
      </form>
      <button
        type="button"
        class="game-menu-button-primary"
        :disabled="loading"
        @click="startGame"
      >
        New Game
      </button>
      <button
        type="button"
        class="game-menu-button-secondary"
        :disabled="loading"
      >
        History (soon)
      </button>
      
      <button
        type="button"
        class="game-menu-button-secondary"
        :disabled="loading"
      >
        High Scores (soon)
      </button>
    </template>
    <template v-if="!ready && error !== ''">
      <button type="button" @click="connect()">
        Retry connection
      </button>
      <button type="button" class="game-menu-button-primary" @click="startGame">
        Play without saving
      </button>
    </template>
    <p v-if="error" class="game-menu-error" role="alert">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">

const {
  username,
  ready,
  loading,
  error,
  hasUnsavedUsername,
  connect,
  saveUsername,
} = useGameTracking()

const router = useRouter()

function startGame() {
  if (!ready) return
  router.push('/game')
}

onMounted(() => void connect())
</script>

<style scoped>
.game-menu {
  display: grid;
  width: min(100%, 28rem);
  gap: 1rem;
  padding: 1.5rem;
}

.game-menu h1,
.game-menu p {
  margin: 0;
}

.game-menu-username {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 3rem;
}

.game-menu-username input {
  width: 75%;
  justify-self: center;
}

.game-menu input,
.game-menu button {
  padding: 0.7rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.7rem;
}

.game-menu button {
  cursor: pointer;
}

.game-menu button:disabled {
  cursor: wait;
}

.game-menu-button-primary {
  border: 0;
  font-weight: 750;
  background: var(--game-accent-strong);
  color: var(--ui-text-inverted);
}
  
.game-menu-button-secondary {
  border: 0;
  font-weight: 750;
  border: 1px solid var(--game-gold-text);
}

.game-menu-error {
  color: var(--game-damage-text);
}
</style>
