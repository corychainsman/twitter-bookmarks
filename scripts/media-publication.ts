import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  readMirrorManifest,
  runWithConcurrency,
  sha256,
  writeFileAtomically,
  type MirrorManifest,
} from './mirror-lib'

export type MediaPublication = {
  version: 1
  manifestDigest: string
  mediaBaseUrl: string
  objectCount: number
  verifiedAt: string
}

export type PublishedMediaObject = {
  key: string
  digest?: string
  bytes?: number
  contentType?: string
}

const projectRoot = process.cwd()
export const mirrorManifestPath = path.join(projectRoot, '.data/media/mirror-manifest.json')
export const mediaPublicationPath = path.join(projectRoot, '.data/media/r2-publication.json')

function normalizeContentType(value: string | null | undefined): string | undefined {
  return value?.split(';', 1)[0]?.trim().toLowerCase() || undefined
}

export function publishedMediaObjects(manifest: MirrorManifest): PublishedMediaObject[] {
  const objects = new Map<string, PublishedMediaObject>()
  const add = (object: PublishedMediaObject | undefined) => {
    if (object?.key) objects.set(object.key, object)
  }

  for (const record of Object.values(manifest.assets)) {
    if (record.status !== 'ok') continue
    add({ key: record.key, digest: record.digest, bytes: record.bytes, contentType: record.contentType })
    for (const variant of record.variants ?? []) {
      add({ key: variant.key, digest: variant.digest, bytes: variant.bytes, contentType: variant.contentType })
    }
    if (record.previewKey) {
      add({ key: record.previewKey, bytes: record.previewBytes, contentType: 'video/mp4' })
    }
    if (record.playbackKey) {
      add({ key: record.playbackKey, bytes: record.playbackBytes, contentType: 'video/mp4' })
    }
  }

  return [...objects.values()].sort((left, right) => left.key.localeCompare(right.key))
}

async function verifyObject(
  object: PublishedMediaObject,
  baseUrl: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  // A version query isolates verification and the published catalog from any
  // negative-cache entry created before an immutable object finished uploading.
  const url = `${baseUrl}/${object.key}${object.digest ? `?v=${object.digest}` : ''}`
  let lastReason = 'unknown response'

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) {
        lastReason = `${response.status} ${response.statusText}`
        continue
      }

      const length = Number(response.headers.get('content-length'))
      if (object.bytes !== undefined && (!Number.isFinite(length) || length !== object.bytes)) {
        lastReason = `content-length ${String(response.headers.get('content-length'))}, expected ${object.bytes}`
        continue
      }

      const expectedType = normalizeContentType(object.contentType)
      const actualType = normalizeContentType(response.headers.get('content-type'))
      if (expectedType && actualType !== expectedType) {
        lastReason = `content-type ${actualType ?? 'missing'}, expected ${expectedType}`
        continue
      }

      return
    } catch (error) {
      lastReason = error instanceof Error ? error.message : 'request failed'
    }
  }

  throw new Error(`${object.key}: ${lastReason}`)
}

export async function verifyMediaPublication(input: {
  manifest: MirrorManifest
  mediaBaseUrl: string
  concurrency?: number
  fetchImpl?: typeof fetch
}): Promise<number> {
  const objects = publishedMediaObjects(input.manifest)
  const baseUrl = input.mediaBaseUrl.replace(/\/+$/, '')
  const fetchImpl = input.fetchImpl ?? fetch
  await runWithConcurrency(objects, input.concurrency ?? 32, async (object) => {
    await verifyObject(object, baseUrl, fetchImpl)
  })
  return objects.length
}

export async function recordVerifiedMediaPublication(input: {
  manifestPath?: string
  publicationPath?: string
  mediaBaseUrl: string
  objectCount: number
}): Promise<MediaPublication> {
  const manifestPath = input.manifestPath ?? mirrorManifestPath
  const publicationPath = input.publicationPath ?? mediaPublicationPath
  const manifestBytes = await readFile(manifestPath)
  const publication: MediaPublication = {
    version: 1,
    manifestDigest: sha256(manifestBytes),
    mediaBaseUrl: input.mediaBaseUrl.replace(/\/+$/, ''),
    objectCount: input.objectCount,
    verifiedAt: new Date().toISOString(),
  }
  await writeFileAtomically(
    publicationPath,
    Buffer.from(`${JSON.stringify(publication, null, 2)}\n`),
  )
  return publication
}

export async function assertVerifiedMediaPublication(input: {
  manifestPath?: string
  publicationPath?: string
  mediaBaseUrl: string
}): Promise<MediaPublication> {
  const manifestPath = input.manifestPath ?? mirrorManifestPath
  const publicationPath = input.publicationPath ?? mediaPublicationPath
  let publication: MediaPublication
  try {
    publication = JSON.parse(await readFile(publicationPath, 'utf8')) as MediaPublication
  } catch {
    throw new Error('Media catalog export requires a successful mirror:sync verification first.')
  }

  const manifestDigest = sha256(await readFile(manifestPath))
  const normalizedBaseUrl = input.mediaBaseUrl.replace(/\/+$/, '')
  if (
    publication.version !== 1 ||
    publication.manifestDigest !== manifestDigest ||
    publication.mediaBaseUrl !== normalizedBaseUrl
  ) {
    throw new Error('Media mirror changed after its last verified R2 publication; run mirror:sync again.')
  }

  return publication
}

async function main() {
  const mediaBaseUrl = process.env.MEDIA_BASE_URL || 'https://tbmedia.corychainsman.com'
  const manifest = await readMirrorManifest(mirrorManifestPath)
  const objectCount = await verifyMediaPublication({ manifest, mediaBaseUrl })
  const publication = await recordVerifiedMediaPublication({ mediaBaseUrl, objectCount })
  console.log(
    `Verified ${publication.objectCount} public media objects; catalog generation ${publication.manifestDigest.slice(0, 16)} is publishable.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
