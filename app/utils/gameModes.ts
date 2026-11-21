export function gameModeSpritePath(configId: string): string {
  const modeId = configId.replace(/-v\d+$/i, '')
  return `/sprites/gamemodes/${encodeURIComponent(modeId)}.png`
}

export function selectGameMode(configs: { id: string }[], selectedId: string): string {
  if (configs.some(config => config.id === selectedId)) return selectedId
  return configs.find(config => /^default-2-types(?:-v\d+)?$/i.test(config.id))?.id
    ?? configs[0]?.id
    ?? ''
}
