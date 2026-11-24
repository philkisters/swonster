# Creating your own Swonster Instance
This document helps you to create your own local or deployed swonster instance.

## Getting started

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

### Cheat menu

For local testing, set `NUXT_PUBLIC_CHEATS=true` in `.env` and restart
`pnpm dev`. A cheat menu then appears below the spells: it adds gold, offers any
spell for purchase, and raises or lowers the level of monsters on the board.
While the switch is on, games are not saved to Firebase at all, so they never
appear in the history or highscores. The switch only works in the dev server;
builds ignore it.

## Firebase game tracking

Create a Firebase web app, enable **Anonymous** sign-in in Firebase
Authentication, and create a Cloud Firestore database. Copy `.env.example` to
`.env` and fill in the web app's Firebase configuration. Deploy the rules in
`firestore.rules` using the Firestore console or Firebase CLI before playing.

Each player can access only their own profile and games. Each game stores its
start time, end time, current turn, score, highest score, actual initial seed,
config ID, the latest game state, and valid moves and spells in order in its
`steps` subcollection. The configuration rules are loaded from the referenced
config document and are not duplicated in the saved state. Times come from the
player's device. Returning to the menu keeps an unfinished game available
through **Resume Game**; starting a new game marks previous active games as
aborted. Games saved before state snapshots were introduced cannot be resumed.
Pending writes may be lost if the page closes unexpectedly. Concurrent sessions
cannot overwrite a newer saved state: if a save fails, return to the menu and
resume the last saved state. These client-reported scores and actions are not
cheat-proof and must not be used as a trusted leaderboard. Firestore usage
incurs reads and writes for each recorded action.

### Game configurations

Deploy `firestore.rules` and `firestore.indexes.json` before using configurations
and their leaderboards. Configurations are public to signed-in players but
cannot be written by clients. An administrator with Firestore write access can
publish the current rules as the first configuration using Node.js 22.18 or
newer and the Google Cloud CLI:

```powershell
$env:FIRESTORE_ACCESS_TOKEN = gcloud auth print-access-token
node scripts\publish-config.mjs YOUR_PROJECT_ID standard-v1 "Standard"
Remove-Item Env:\FIRESTORE_ACCESS_TOKEN
```

The script creates a document and refuses to overwrite an existing ID. To
publish another configuration, provide a new ID, a name, and a JSON file
containing the complete rules object as the final argument. Create a starting
template with:

```powershell
node --input-type=module -e "import { writeFileSync } from 'node:fs'; import { DEFAULT_GAME_CONFIG } from './game/config.ts'; writeFileSync('rules.json', JSON.stringify(DEFAULT_GAME_CONFIG, null, 2))"
```

Edit the template and publish it with
`node scripts\publish-config.mjs YOUR_PROJECT_ID daily-2026-01-01 "Daily challenge" rules.json`.
The same Zod schema validates configurations when publishing and when players
load them; invalid configurations report the affected fields. The dragon,
griffin, and skeletDragon definitions with their standard factions
are required, and both board dimensions must be at least three. Set
`playerMonsterTypes` to a non-empty array of configured player monster IDs to
control the types used by the starting players, player spawns, and type-change
spell. Set
`startingPlayerMonsterCount` and `startingEnemyMonsterCount` to configure the
initial roster; they default to 1 each, and the enemy count can be 0. Starting
monster positions and types are selected deterministically from the run seed.
Set `availableSpells` to the desired unique spell IDs from the default rules;
an empty array disables spells. `spellCostModifier` multiplies all spell costs,
rounded to the nearest whole gold; it accepts values from 0 to 100000. Zero
makes spells free and 1 is the default.
Older configurations without these fields retain the defaults. Sprite
prefixes must correspond to deployed sprites.

New standard rules use `enemySpawnCurve` to set `difficultyBuffer`,
`maxActiveTiers`, `peakPosition`, and `maxTier` for the spawn balancer's
per-turn enemy tier distribution. It uses `friendSpawnChance` as the friendly
spawn rate; with no friendly spawns, enemies remain tier 1. The curve is
evaluated for the turn each queued monster will spawn, independently of friendly
merges. Friendly monsters still use `spawnTier`. At the end of the curve only
the highest tier spawns. The default rules omit the legacy
`enemyTierProgression` and `enemyTierUnlockPlayerTier` fields. Configurations
without `enemySpawnCurve` must retain both fields; existing configurations and
saved games continue to use their original unlock and progression rules. Publish
a new configuration ID to use the curve. With a curve, these legacy fields may
also be set to `null`.
On `/admin`, the Spawn Balancer edits the friendly spawn chance and curve in the
rules JSON directly; changes to the JSON, resetting the rules, and duplicating
a configuration also update the chart. The editor offers an explicit option to
replace a duplicated legacy configuration's progression with the curve.

Use a **new ID for every rules change**: scores are grouped by configuration
ID, and changing a published document would mix incomparable scores. Games
also save a copy of their rules and the actual `initialSeed` used for the run.
Existing games without a configuration are not shown in the score view.
Set `rngSeed` to `null` to generate a random seed for each new
game (the default), or to an integer from 0 to 4294967295 for a fixed seed.
Fixed seeds make runs reproducible, so an administrator can publish separate
dated configurations for daily challenges. Scores for a random-seed config share
one leaderboard even though runs differ. Publishing and retiring dated challenges
is manual; no automatic schedule is provided. Existing published configurations
retain their fixed seeds; publish a new ID to switch one to random seeds.

The menu requires a published configuration for new saved games. If Firebase
cannot be reached, **Play without saving** uses the bundled standard rules and
does not change any saved active game.
Game-mode images are loaded from `public/sprites/gamemodes` using the config ID
without a trailing version such as `-v1`. Configurations without a matching
image use a cog and their name. The `default-2-types` mode is selected by
default when available.
Admins can archive or restore configurations on `/admin`. Archived configs are
hidden from the new-game menu and score history. Resuming a game loads the
latest archive status: an archived config shows a warning and allows the player
to continue, while its results remain outside score lists. Missing config
documents prevent resume and return the player to the menu. Older clients may
still offer archived configs, so this is a selection control rather than a
security restriction.

### Admin page

The static `/admin` page shows player and game counts, the 25 most recently
started games, and a sample of 25 players. Results are client-reported and
may be incomplete or inaccurate. The page also publishes a new configuration
from JSON and archives or restores existing configurations. Published rules
remain immutable; admin-only Cloud Functions validate new rules using the same
schema as the game and update archive status separately. The functions use the
`europe-west1` region. Counts and queries incur Firestore read costs.

To set it up:

1. Enable the Google provider under Firebase Authentication > Sign-in method.
   Add each app hostname (including your GitHub Pages hostname and, for local
   development, `localhost`) to Authentication > Settings > Authorized domains.
   Use the same Firebase project for the game, admin page, and function.
2. Deploy the Firestore rules, indexes, and function. Cloud Functions deployment
   requires the Firebase Blaze plan. Install the Firebase CLI or use `npx`, and
   sign in with an account allowed to deploy to your project:

   ```powershell
   pnpm install
   npx firebase-tools login
   npx firebase-tools deploy --project YOUR_PROJECT_ID --only firestore,functions
   ```

   The deploy command bundles the shared config validation into the function.
   Redeploy the functions after changing the shared validation schema; otherwise
   the deployed publisher may reject rules accepted by the current admin page.
   The recent-games index may take time to finish building.
3. Open `/admin` on the same origin and browser where you play. If your current
   player is anonymous, choose **Link this player to Google** to preserve its UID
   and saved games. If the Google account is already linked to another Firebase
   user, sign in with that Google account instead; Firebase cannot automatically
   merge the two players. Switching accounts also changes the player used by the
   game in this browser.
4. Copy the UID shown on the admin page. With the Google Cloud CLI installed,
   obtain local Application Default Credentials using a Google account with
   permission to manage Firebase Authentication users in this project, then
   grant the linked account its admin claim:

   ```powershell
   gcloud auth application-default login
   node functions\grant-admin.mjs YOUR_PROJECT_ID YOUR_USER_UID
   ```

   The script preserves other custom claims and refuses to grant access to an
   account that is not linked to Google. Back on `/admin`, choose **Refresh
   admin access** (or sign out and back in). A Google sign-in *and* the admin
   claim are required by the rules and function; a signed-in non-admin cannot
   access the dashboard or publish configs. Firebase credentials used by the
   script must stay on the administrator's machine, never in the app.

On GitHub Pages the address includes the repository base path, for example
`https://YOUR_USER.github.io/swonster/admin/`. The page itself is public;
Firestore rules and the Cloud Function enforce access.

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
