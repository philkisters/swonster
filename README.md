<p align="center">
  <img src="public/logo.png" alt="Swonster logo" width="220">
</p>

# Swonster

**Swonster** is a browser-based monster survival game inspired by 2048. Merge
matching monsters to make them stronger, battle an ever-growing enemy threat,
and chase a new high score. The challenge is to keep your monsters alive and
survive for as many turns as possible.

## Core idea

Move all monsters on the board at once by using the arrow keys, WASD, or touch
gestures. When two monsters of the same type and tier collide, they merge into
a stronger monster with higher health and attack power.

Position matters: monsters attack adjacent opponents in the direction of
movement, and surviving defenders can counterattack. Every valid move adds a
new monster to the board, while the spawn preview lets you plan for what is
coming next.

The run ends when no friendly monsters remain or there is no room left for the
next spawn.

## Increasing pressure

- Merge friendly monsters to build a stronger team.
- Enemy difficulty increases over time as stronger enemy tiers become more
  likely to spawn.
- Stronger enemies are more dangerous and yield greater point and XP rewards.
- Defeating enemies and merging friendly monsters adds to your score.
- The goal is to set the highest score and survive the most turns.

## Getting started

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

## Firebase game tracking

Create a Firebase web app, enable **Anonymous** sign-in in Firebase
Authentication, and create a Cloud Firestore database. Copy `.env.example` to
`.env` and fill in the web app's Firebase configuration. Deploy the rules in
`firestore.rules` using the Firestore console or Firebase CLI before playing.

Each player can access only their own profile and games. Each game stores its
start time, end time, current turn, score, and highest score, with valid moves
and spells recorded in order in its `steps` subcollection. Times come from the
player's device. Restarting or returning to the menu marks an unfinished game
as abandoned. Closing the page unexpectedly can leave it active and pending
writes may be lost; the game does not resume saved runs. These client-reported
scores and actions are not cheat-proof and must not be used as a trusted
leaderboard. Firestore usage incurs reads and writes for each recorded action.

## Quality checks

```bash
pnpm test
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
```

Run `pnpm format` to apply formatting.

## Project structure

- `app/` — Nuxt/Vue user interface, input handling, and game presentation
- `game/` — pure TypeScript game rules for movement, merging, combat, and
  spawning
- `public/` — logo, monster sprites, icons, and other static assets
- `tests/` — unit tests for the game engine and its rules

## Static deployment

Create a production-ready static site with:

```bash
pnpm generate
```

GitHub Pages deployment is configured in
`.github/workflows/deploy-pages.yml`. In the repository settings, set
**Pages** to use **GitHub Actions** as its source. Configure the four
`NUXT_PUBLIC_FIREBASE_*` values from `.env.example` as environment variables in
the `github-pages` environment. They must be present when the static site is
generated, not only when the Pages artifact is deployed.

## License

See [LICENSE](LICENSE).
