export function chooseRunSeed(configuredSeed: number | null): number {
  if (configuredSeed !== null) return configuredSeed
  const values = new Uint32Array(1)
  globalThis.crypto.getRandomValues(values)
  const seed = values[0]
  if (seed === undefined) throw new Error('Could not generate a game seed')
  return seed
}

export function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0
}
