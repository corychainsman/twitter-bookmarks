import type { Manifest } from '@/features/bookmarks/model'

export function resolveArtifactPath(path: string): string {
  return `data/${path.replace(/^\/+/, '')}`
}

export function withArtifactVersion(path: string, version: string): string {
  const [pathname, existingQuery = ''] = path.split('?')
  const params = new URLSearchParams(existingQuery)
  params.set('v', version)

  return `${pathname}?${params.toString()}`
}

export function resolveArtifactUrl(
  path: string,
  version: string,
  appBase = new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
): string {
  return new URL(withArtifactVersion(resolveArtifactPath(path), version), appBase).toString()
}

export function resolveEmbeddingIndexUrl(
  manifest: Manifest,
  appBase?: string,
): string {
  if (!manifest.files.embeddings) {
    throw new Error('Semantic embeddings are not exported. Run bun run data:embeddings.')
  }

  return resolveArtifactUrl(manifest.files.embeddings, manifest.buildId, appBase)
}
