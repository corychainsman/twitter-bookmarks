import { readFile, writeFile } from 'node:fs/promises'
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
  version: 2
  manifestDigest: string
  mediaBaseUrl: string
  objectCount: number
  objectKeys: string[]
  verifiedAt: string
  fullVerifiedAt: string
}

type LegacyMediaPublication = {
  version: 1
  manifestDigest: string
  mediaBaseUrl: string
  objectCount: number
  verifiedAt: string
}

type PublicationPlan = {
  version: 1
  manifestDigest: string
  pendingKeys: string[]
}

export type PublishedMediaObject = {
  key: string
  digest?: string
  bytes?: number
  contentType?: string
}

const projectRoot = process.cwd()
const defaultMediaBaseUrl = 'https://tbmedia.corychainsman.com'
export const mirrorManifestPath = path.join(projectRoot, '.data/media/mirror-manifest.json')
export const mediaPublicationPath = path.join(projectRoot, '.data/media/r2-publication.json')
export const mediaPublicationPlanPath = path.join(projectRoot, '.data/media/r2-publication-plan.json')
export const mediaUploadListPath = path.join(projectRoot, '.data/media/r2-upload-list.txt')
const FULL_VERIFICATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000

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
  objectKeys?: string[]
  fullVerifiedAt?: string
}): Promise<MediaPublication> {
  const manifestPath = input.manifestPath ?? mirrorManifestPath
  const publicationPath = input.publicationPath ?? mediaPublicationPath
  const manifestBytes = await readFile(manifestPath)
  const publication: MediaPublication = {
    version: 2,
    manifestDigest: sha256(manifestBytes),
    mediaBaseUrl: input.mediaBaseUrl.replace(/\/+$/, ''),
    objectCount: input.objectCount,
    objectKeys: input.objectKeys ?? [],
    verifiedAt: new Date().toISOString(),
    fullVerifiedAt: input.fullVerifiedAt ?? new Date().toISOString(),
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
  let publication: MediaPublication | LegacyMediaPublication
  try {
    publication = JSON.parse(await readFile(publicationPath, 'utf8')) as
      | MediaPublication
      | LegacyMediaPublication
  } catch {
    throw new Error('Media catalog export requires a successful mirror:sync verification first.')
  }

  const manifestDigest = sha256(await readFile(manifestPath))
  const normalizedBaseUrl = input.mediaBaseUrl.replace(/\/+$/, '')
  if (
    publication.manifestDigest !== manifestDigest ||
    publication.mediaBaseUrl !== normalizedBaseUrl
  ) {
    throw new Error('Media mirror changed after its last verified R2 publication; run mirror:sync again.')
  }

  if (publication.version === 1) {
    return {
      ...publication,
      version: 2,
      objectKeys: [],
      fullVerifiedAt: publication.verifiedAt,
    }
  }

  return publication
}

async function readPublication(): Promise<MediaPublication | LegacyMediaPublication | undefined> {
  try {
    return JSON.parse(await readFile(mediaPublicationPath, 'utf8')) as
      | MediaPublication
      | LegacyMediaPublication
  } catch {
    return undefined
  }
}

export async function prepareMediaPublication(): Promise<PublicationPlan> {
  const manifest = await readMirrorManifest(mirrorManifestPath)
  const manifestDigest = sha256(await readFile(mirrorManifestPath))
  const objects = publishedMediaObjects(manifest)
  const publication = await readPublication()
  const mediaBaseUrl = (process.env.MEDIA_BASE_URL || defaultMediaBaseUrl).replace(/\/+$/, '')
  const previouslyPublished = publication?.version === 2 && publication.mediaBaseUrl === mediaBaseUrl
    ? new Set(publication.objectKeys)
    : publication?.manifestDigest === manifestDigest && publication.mediaBaseUrl === mediaBaseUrl
      ? new Set(objects.map((object) => object.key))
      : new Set<string>()
  const pendingKeys = objects
    .map((object) => object.key)
    .filter((key) => !previouslyPublished.has(key))
  const plan: PublicationPlan = { version: 1, manifestDigest, pendingKeys }

  await writeFile(mediaPublicationPlanPath, `${JSON.stringify(plan, null, 2)}\n`)
  await writeFile(mediaUploadListPath, pendingKeys.length > 0 ? `${pendingKeys.join('\n')}\n` : '')
  return plan
}

export async function verifyPlannedMediaPublication(input: {
  forceFull?: boolean
  now?: Date
  fetchImpl?: typeof fetch
} = {}): Promise<MediaPublication> {
  const manifest = await readMirrorManifest(mirrorManifestPath)
  const objects = publishedMediaObjects(manifest)
  const objectsByKey = new Map(objects.map((object) => [object.key, object]))
  const plan = JSON.parse(await readFile(mediaPublicationPlanPath, 'utf8')) as PublicationPlan
  const manifestDigest = sha256(await readFile(mirrorManifestPath))
  if (plan.version !== 1 || plan.manifestDigest !== manifestDigest) {
    throw new Error('Media manifest changed after the R2 publication plan was created.')
  }

  const previous = await readPublication()
  const now = input.now ?? new Date()
  const previousFullVerification = previous?.version === 2
    ? previous.fullVerifiedAt
    : previous?.verifiedAt
  const mediaBaseUrl = (process.env.MEDIA_BASE_URL || defaultMediaBaseUrl).replace(/\/+$/, '')
  const previousFullVerificationMs = previousFullVerification
    ? Date.parse(previousFullVerification)
    : Number.NaN
  const fullVerificationDue = input.forceFull || previous?.mediaBaseUrl !== mediaBaseUrl ||
    !previousFullVerification ||
    !Number.isFinite(previousFullVerificationMs) ||
    now.getTime() - previousFullVerificationMs >= FULL_VERIFICATION_INTERVAL_MS
  const verificationObjects = fullVerificationDue
    ? objects
    : plan.pendingKeys.map((key) => {
        const object = objectsByKey.get(key)
        if (!object) throw new Error(`Publication plan references unknown media key: ${key}`)
        return object
      })

  await runWithConcurrency(verificationObjects, 32, async (object) => {
    await verifyObject(object, mediaBaseUrl, input.fetchImpl ?? fetch)
  })

  return recordVerifiedMediaPublication({
    mediaBaseUrl,
    objectCount: objects.length,
    objectKeys: objects.map((object) => object.key),
    fullVerifiedAt: fullVerificationDue ? now.toISOString() : previousFullVerification,
  })
}

async function main() {
  const command = process.argv[2] ?? 'verify'
  if (command === 'plan') {
    const plan = await prepareMediaPublication()
    console.log(`R2 publication plan contains ${plan.pendingKeys.length} new immutable objects.`)
    return
  }
  if (command !== 'verify') throw new Error(`Unknown media publication command: ${command}`)

  const publication = await verifyPlannedMediaPublication({
    forceFull: process.argv.includes('--full'),
  })
  console.log(`Published media attestation now covers ${publication.objectCount} objects.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
