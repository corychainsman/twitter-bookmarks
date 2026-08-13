import { stat } from 'node:fs/promises'
import path from 'node:path'

import { buildExportArtifacts } from './catalog/export-artifacts'
import { readJsonLines } from './export-lib'
import { generateImageRenditions } from './image-renditions'
import {
  fetchAsset,
  imageDownloadUrl,
  mirrorContentKey,
  mirrorKeyForUrl,
  PermanentFetchError,
  readMirrorManifest,
  runWithConcurrency,
  sha256,
  writeFileAtomically,
  writeMirrorManifest,
  type MirrorAssetKind,
  type MirrorAssetRecord,
  type MirrorManifest,
} from './mirror-lib'

const projectRoot = process.cwd()
const rawBookmarksPath = path.join(projectRoot, '.data/fieldtheory/bookmarks.jsonl')
const mirrorRoot = path.join(projectRoot, '.data/media')
const assetsRoot = path.join(mirrorRoot, 'assets')
const manifestPath = path.join(mirrorRoot, 'mirror-manifest.json')

const MANIFEST_FLUSH_INTERVAL = 25

type MirrorJob = {
  sourceUrl: string
  kind: MirrorAssetKind
}

type CliOptions = {
  limit?: number
  concurrency: number
  retryFailed: boolean
  dryRun: boolean
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = { concurrency: 6, retryFailed: false, dryRun: false }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--limit') {
      options.limit = Number(argv[index + 1])
      index += 1
    } else if (argument === '--concurrency') {
      options.concurrency = Number(argv[index + 1])
      index += 1
    } else if (argument === '--retry-failed') {
      options.retryFailed = true
    } else if (argument === '--dry-run') {
      options.dryRun = true
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }

  if (options.limit !== undefined && (!Number.isFinite(options.limit) || options.limit <= 0)) {
    throw new Error('--limit must be a positive number')
  }
  if (!Number.isFinite(options.concurrency) || options.concurrency <= 0) {
    throw new Error('--concurrency must be a positive number')
  }

  return options
}

function collectMirrorJobs(): Promise<MirrorJob[]> {
  return readJsonLines(rawBookmarksPath).then((records) => {
    const artifacts = buildExportArtifacts(records, {
      buildId: 'mirror-scan',
      builtAt: 'mirror-scan',
      chunkSize: 500,
    })

    const jobsByUrl = new Map<string, MirrorJob>()
    const addJob = (sourceUrl: string | undefined, kind: MirrorAssetKind) => {
      if (!sourceUrl || jobsByUrl.has(sourceUrl) || !mirrorKeyForUrl(sourceUrl)) {
        return
      }
      jobsByUrl.set(sourceUrl, { sourceUrl, kind })
    }

    for (const chunk of artifacts.docsChunks) {
      for (const doc of chunk.docs) {
        for (const media of doc.media) {
          if (media.type === 'photo') {
            addJob(media.fullUrl, 'image')
            addJob(media.thumbUrl, 'image')
          } else {
            addJob(media.fullUrl, 'video')
            addJob(media.posterUrl, 'image')
            addJob(media.thumbUrl, 'image')
          }
        }
      }
    }

    return [...jobsByUrl.values()]
  })
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function writeAssetFile(key: string, buffer: Buffer): Promise<void> {
  await writeFileAtomically(path.join(assetsRoot, key), buffer)
}

async function mirrorImage(job: MirrorJob, key: string): Promise<MirrorAssetRecord> {
  const { buffer, contentType } = await fetchAsset(imageDownloadUrl(job.sourceUrl))

  const digest = sha256(buffer)
  const contentKey = mirrorContentKey(key, digest)
  await writeAssetFile(contentKey, buffer)
  const generated = await generateImageRenditions({ assetsRoot, buffer, originalKey: contentKey })

  return {
    status: 'ok',
    kind: 'image',
    key: contentKey,
    digest: generated.digest,
    bytes: buffer.byteLength,
    contentType,
    width: generated.width,
    height: generated.height,
    variants: generated.variants,
    thumbhash: generated.thumbhash,
    fetchedAt: new Date().toISOString(),
    attempts: 1,
  }
}

async function mirrorVideo(job: MirrorJob, key: string): Promise<MirrorAssetRecord> {
  const { buffer, contentType } = await fetchAsset(job.sourceUrl, { timeoutMs: 180_000 })
  await writeAssetFile(key, buffer)

  return {
    status: 'ok',
    kind: 'video',
    key,
    digest: sha256(buffer),
    bytes: buffer.byteLength,
    contentType,
    fetchedAt: new Date().toISOString(),
    attempts: 1,
  }
}

async function isAssetComplete(record: MirrorAssetRecord): Promise<boolean> {
  if (!(await fileExists(path.join(assetsRoot, record.key)))) {
    return false
  }

  for (const variant of record.variants ?? []) {
    if (!(await fileExists(path.join(assetsRoot, variant.key)))) {
      return false
    }
  }

  return true
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2))
  const jobs = await collectMirrorJobs()
  const manifest: MirrorManifest = await readMirrorManifest(manifestPath)

  const pending: MirrorJob[] = []
  let alreadyMirrored = 0
  let skippedFailed = 0

  for (const job of jobs) {
    const existing = manifest.assets[job.sourceUrl]
    if (existing?.status === 'ok' && (await isAssetComplete(existing))) {
      alreadyMirrored += 1
      continue
    }
    if (existing?.status === 'failed' && !options.retryFailed) {
      skippedFailed += 1
      continue
    }
    pending.push(job)
  }

  const queue = options.limit ? pending.slice(0, options.limit) : pending

  console.log(
    `Mirror scan: ${jobs.length} assets total, ${alreadyMirrored} already mirrored, ` +
      `${skippedFailed} previously failed (use --retry-failed), ${queue.length} to download.`,
  )

  if (options.dryRun || queue.length === 0) {
    if (options.dryRun) {
      const images = queue.filter((job) => job.kind === 'image').length
      console.log(`Dry run: would download ${images} images and ${queue.length - images} videos.`)
    }
    return
  }

  let completed = 0
  let failed = 0
  let bytesDownloaded = 0
  let sinceFlush = 0

  await runWithConcurrency(queue, options.concurrency, async (job) => {
    const key = mirrorKeyForUrl(job.sourceUrl)
    if (!key) {
      return
    }

    const previousAttempts = manifest.assets[job.sourceUrl]?.attempts ?? 0

    try {
      const record = job.kind === 'image' ? await mirrorImage(job, key) : await mirrorVideo(job, key)
      record.attempts = previousAttempts + 1
      manifest.assets[job.sourceUrl] = record
      completed += 1
      bytesDownloaded += record.bytes ?? 0
    } catch (error) {
      failed += 1
      manifest.assets[job.sourceUrl] = {
        status: 'failed',
        kind: job.kind,
        key,
        attempts: previousAttempts + 1,
        error:
          error instanceof PermanentFetchError
            ? `gone: ${error.message}`
            : error instanceof Error
              ? error.message
              : 'unknown error',
        fetchedAt: new Date().toISOString(),
      }
    }

    sinceFlush += 1
    if (sinceFlush >= MANIFEST_FLUSH_INTERVAL) {
      sinceFlush = 0
      await writeMirrorManifest(manifestPath, manifest)
    }

    const done = completed + failed
    if (done % 100 === 0 || done === queue.length) {
      console.log(
        `Progress: ${done}/${queue.length} (${failed} failed, ${(bytesDownloaded / 1024 / 1024).toFixed(1)} MB)`,
      )
    }
  })

  await writeMirrorManifest(manifestPath, manifest)

  const okCount = Object.values(manifest.assets).filter((asset) => asset.status === 'ok').length
  console.log(
    `Mirror complete: ${completed} downloaded (${(bytesDownloaded / 1024 / 1024).toFixed(1)} MB), ` +
      `${failed} failed this run. Manifest coverage: ${okCount}/${jobs.length}.`,
  )

  if (failed > 0) {
    console.log('Failed assets are recorded in the manifest; re-run with --retry-failed to retry.')
  }
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown mirror failure'
  console.error(`mirror-media failed: ${reason}`)
  process.exitCode = 1
})
