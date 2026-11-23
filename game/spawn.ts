export interface SpawnConfig {
  friendlySpawnRate: number; // 0..1
  difficultyBuffer: number; // e.g. 0.1 hard, 0.3 easy
  maxActiveTiers: number;
  peakPosition: number; // 0..1 of lifetime
  maxTier: number;
}

export const defaultSpawnConfig: SpawnConfig = {
  friendlySpawnRate: 0.4,
  difficultyBuffer: 0.2,
  maxActiveTiers: 5,
  peakPosition: 0.35,
  maxTier: 10,
};

// T1 is available immediately; each additional tier unlocks after its expected
// number of friendly T1 spawns, adjusted by difficulty.
export function unlockTurn(tier: number, c: SpawnConfig): number {
  if (tier <= 1) return 0;
  return Math.ceil((2 ** (tier - 1) / c.friendlySpawnRate) * (1 + c.difficultyBuffer));
}

export function tierWeight(tier: number, turn: number, c: SpawnConfig): number {
  if (tier < 1 || tier > c.maxTier || turn < 0) return 0;
  const start = unlockTurn(tier, c);
  // Tier i has vanished when tier i + maxActiveTiers unlocks.
  // Even if maxTier is reached, use the extrapolated unlock turn to fade old tiers.
  const end = unlockTurn(tier + c.maxActiveTiers, c);
  if (turn < start || turn >= end) return 0;
  if (tier === 1) {
    const u = (turn - start) / (end - start);
    return Math.cos((Math.PI / 2) * u) ** 2;
  }
  const peak = start + (end - start) * c.peakPosition;
  if (turn <= peak) {
    const u = (turn - start) / (peak - start);
    return Math.sin((Math.PI / 2) * u) ** 2;
  }
  const u = (turn - peak) / (end - peak);
  return Math.cos((Math.PI / 2) * u) ** 2;
}

export interface TierProbability { tier: number; probability: number; weight: number }
export function spawnDistribution(turn: number, c: SpawnConfig): TierProbability[] {
  const weights = Array.from({ length: c.maxTier }, (_, i) => ({
    tier: i + 1, weight: tierWeight(i + 1, turn, c),
  }));
  const total = weights.reduce((sum, row) => sum + row.weight, 0);
  if (total <= 0) {
    // Once the configured maximum tier has been reached, keep spawning it.
    // This is a deliberate endgame rule, not a hidden zero-probability state.
    return [{ tier: c.maxTier, weight: 1, probability: 1 }];
  }
  return weights.filter(row => row.weight > 0).map(row => ({
    ...row, probability: row.weight / total,
  }));
}

export function pickEnemyTier(turn: number, c: SpawnConfig, random = Math.random): number {
  const distribution = spawnDistribution(turn, c);
  const roll = random();
  let cumulative = 0;
  for (const row of distribution) {
    cumulative += row.probability;
    if (roll < cumulative) return row.tier;
  }
  const last = distribution[distribution.length - 1];
  if (!last) throw new Error('Cannot pick an enemy tier from an empty distribution');
  return last.tier;
}
