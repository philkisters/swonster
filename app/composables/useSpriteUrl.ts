/** Resolves a root-relative sprite path against the app base URL. */
export function useSpriteUrl() {
  const { app } = useRuntimeConfig()

  return (path: string) => `${app.baseURL}${path.replace(/^\//, '')}`
}
