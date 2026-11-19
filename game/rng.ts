export function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0
}
