<template>
  <main class="game-page">
    <slot />
  </main>
</template>

<style>
:root {
  color-scheme: light dark;
  background: var(--ui-bg);
  color: var(--ui-text);
  --game-accent-text: var(--ui-color-primary-700);
  --game-accent-strong: var(--ui-color-primary-700);
  --game-enemy-text: var(--ui-color-warning-700);
  --game-enemy-strong: var(--ui-color-warning-700);
  --game-player-bg: color-mix(in srgb, var(--ui-color-primary-500) 18%, var(--ui-bg));
  --game-enemy-bg: color-mix(in srgb, var(--ui-color-warning-500) 18%, var(--ui-bg));
  --game-turn-text: var(--ui-color-error-600);
  --game-score-text: var(--ui-text-highlighted);
  --game-gold-text: var(--ui-color-warning-600);
  --game-xp-text: var(--ui-color-success-600);
  --game-target: var(--ui-text-highlighted);
  --game-damage-text: var(--ui-color-error-600);
  --game-heal-text: var(--ui-color-success-600);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

.dark {
  color-scheme: dark;
  --game-accent-text: var(--ui-color-primary-300);
  --game-accent-strong: var(--ui-color-primary-400);
  --game-enemy-text: var(--ui-color-warning-300);
  --game-enemy-strong: var(--ui-color-warning-400);
  --game-player-bg: color-mix(in srgb, var(--ui-color-primary-500) 24%, var(--ui-bg));
  --game-enemy-bg: color-mix(in srgb, var(--ui-color-warning-500) 24%, var(--ui-bg));
  --game-turn-text: var(--ui-color-error-400);
  --game-score-text: #fff;
  --game-gold-text: var(--ui-color-warning-400);
  --game-xp-text: var(--ui-color-success-400);
  --game-damage-text: var(--ui-color-error-400);
  --game-heal-text: var(--ui-color-success-400);
}

.light {
  color-scheme: light;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  background:
    radial-gradient(circle at 15% 10%, color-mix(in srgb, var(--ui-color-primary-500) 12%, transparent), transparent 34rem),
    radial-gradient(circle at 90% 85%, color-mix(in srgb, var(--ui-color-warning-500) 10%, transparent), transparent 30rem),
    var(--ui-bg);
}

button,
input {
  font: inherit;
}

.game-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: clamp(1rem, 4vw, 3rem);
}

.game-shell {
  display: grid;
  width: min(100%, 34rem);
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(1rem, 3vw, 2rem);
}

.game-session {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--ui-text-muted);
  font-size: 0.8rem;
}

.game-session button {
  cursor: pointer;
}

@media (max-width: 480px) {
  .game-page {
    align-items: start;
    padding-top: 0.75rem;
  }
}
</style>