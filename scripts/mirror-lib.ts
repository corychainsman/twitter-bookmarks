import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type MirrorAssetKind = 'image' | 'video'

export type MirrorVariant = {
  key: string
  width: number
  height?: number
  bytes?: number
  contentType?: 'image/avif'
  digest?: string
}

export type MirrorAssetRecord = {
  status: 'ok' | 'failed'
  kind: MirrorAssetKind
  key: string
  /** SHA-256 of the archived original bytes. */
  digest?: string
  bytes?: number
  contentType?: string
  width?: number
  height?: number
  variants?: MirrorVariant[]
  thumbhash?: string
  /** Downscaled, audio-stripped MP4 for in-grid autoplay (videos only). */
  previewKey?: string
  previewBytes?: number
  /** Safari-oriented MP4 for lightbox playback (videos only). */
  playbackKey?: string
  playbackBytes?: number
  fetchedAt?: string
  attempts: number
  error?: string
}

export type MirrorManifest = {
  version: 1
  assets: Record<string, MirrorAssetRecord>
}

const MIRROR_HOST_PREFIXES: Record<string, string> = {
  'pbs.twimg.com': 'pbs',
  'video.twimg.com': 'vid',
}

export const MIRROR_RENDITION_VERSION = 2 as const
export const MIRROR_VARIANT_WIDTHS = [240, 320, 480, 680, 1280, 2048] as const

export function mirrorKeyForUrl(sourceUrl: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(sourceUrl)
  } catch {
    return null
  }

  const prefix = MIRROR_HOST_PREFIXES[parsed.hostname]
  if (!prefix) {
    return null
  }

  return `${prefix}${parsed.pathname}`
}

export function mirrorVariantKey(originalKey: string, width: number, digest?: string): string {
  const extension = path.extname(originalKey)
  const stem = extension ? originalKey.slice(0, -extension.length) : originalKey
  return digest
    ? `${stem}/renditions/v${MIRROR_RENDITION_VERSION}/w${width}-${digest}.avif`
    : `${stem}/w${width}.avif`
}

export function mirrorContentKey(sourceKey: string, digest: string): string {
  const extension = path.extname(sourceKey)
  const stem = extension ? sourceKey.slice(0, -extension.length) : sourceKey
  return `${stem}/objects/${digest}${extension}`
}

export function isContentAddressedMirrorKey(key: string, digest: string | undefined): boolean {
  return Boolean(digest && key.includes(`/objects/${digest}`))
}

// Grid autoplay preview clip key, derived from the original video key by
// convention: <stem>/preview.mp4 (sibling of the AVIF poster variants).
export function videoPreviewKey(originalKey: string): string {
  const extension = path.extname(originalKey)
  const stem = extension ? originalKey.slice(0, -extension.length) : originalKey
  return `${stem}/preview.mp4`
}

export function videoPlaybackKey(originalKey: string): string {
  const extension = path.extname(originalKey)
  const stem = extension ? originalKey.slice(0, -extension.length) : originalKey
  return `${stem}/playback.mp4`
}

// Rendition generation filters this ladder against the oriented source width
// and records the actual output dimensions in the explicit catalog.
export function mirrorVariantWidths(): number[] {
  return [...MIRROR_VARIANT_WIDTHS]
}

export function sha256(buffer: Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export async function writeFileAtomically(filePath: string, buffer: Uint8Array): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`

  try {
    await writeFile(temporaryPath, buffer)
    await rename(temporaryPath, filePath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

export function imageDownloadUrl(sourceUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(sourceUrl)
  } catch {
    return sourceUrl
  }

  if (parsed.hostname !== 'pbs.twimg.com') {
    return sourceUrl
  }

  parsed.searchParams.set('name', 'orig')
  return parsed.toString()
}

export async function readMirrorManifest(manifestPath: string): Promise<MirrorManifest> {
  try {
    const contents = await readFile(manifestPath, 'utf8')
    const parsed = JSON.parse(contents) as MirrorManifest
    if (parsed.version === 1 && parsed.assets && typeof parsed.assets === 'object') {
      return parsed
    }
  } catch {
    // Fall through to a fresh manifest.
  }

  return { version: 1, assets: {} }
}

export async function writeMirrorManifest(
  manifestPath: string,
  manifest: MirrorManifest,
): Promise<void> {
  await mkdir(path.dirname(manifestPath), { recursive: true })
  const temporaryPath = `${manifestPath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, manifestPath)
}

export type FetchAssetResult = {
  buffer: Buffer
  contentType?: string
}

export async function fetchAsset(
  url: string,
  options: { attempts?: number; timeoutMs?: number } = {},
): Promise<FetchAssetResult> {
  const attempts = options.attempts ?? 3
  const timeoutMs = options.timeoutMs ?? 60_000
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      })

      if (response.status === 404 || response.status === 403) {
        throw new PermanentFetchError(`${response.status} ${response.statusText}`)
      }

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.byteLength === 0) {
        throw new Error('empty response body')
      }

      return {
        buffer,
        contentType: response.headers.get('content-type') ?? undefined,
      }
    } catch (error) {
      lastError = error
      if (error instanceof PermanentFetchError || attempt === attempts) {
        break
      }
      await sleep(attempt * 1500)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('download failed')
}

export class PermanentFetchError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0

  async function runLane(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      await worker(items[index], index)
    }
  }

  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () =>
    runLane(),
  )
  await Promise.all(lanes)
}
