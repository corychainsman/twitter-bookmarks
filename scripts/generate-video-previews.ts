import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

import {
  readMirrorManifest,
  runWithConcurrency,
  videoPreviewKey,
  videoPlaybackKey,
  writeMirrorManifest,
  type MirrorManifest,
} from './mirror-lib'

const projectRoot = process.cwd()
const mirrorRoot = path.join(projectRoot, '.data/media')
const assetsRoot = path.join(mirrorRoot, 'assets')
const manifestPath = path.join(mirrorRoot, 'mirror-manifest.json')

const MANIFEST_FLUSH_INTERVAL = 25

// Downscaled, muted preview tier for in-grid autoplay. The full-resolution
// original is still served in the lightbox; the grid only needs a small clip
// that many tiles can decode at once without saturating bandwidth.
const PREVIEW_WIDTH = 480
const PREVIEW_CRF = 31
// The grid only ever shows a muted loop, so previews never need the full runtime.
// Capping the clip keeps long videos from producing multi-MB previews.
const PREVIEW_MAX_SECONDS = 8
const PLAYBACK_MAX_EDGE = 1280
const PLAYBACK_CRF = 23

type CliOptions = {
  limit?: number
  concurrency: number
  force: boolean
  dryRun: boolean
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = { concurrency: 4, force: false, dryRun: false }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--limit') {
      options.limit = Number(argv[index + 1])
      index += 1
    } else if (argument === '--concurrency') {
      options.concurrency = Number(argv[index + 1])
      index += 1
    } else if (argument === '--force') {
      options.force = true
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg exited ${code}: ${stderr.trim().split('\n').slice(-1)[0] ?? ''}`))
      }
    })
  })
}

export function buildPreviewFfmpegArgs(inputPath: string, outputPath: string): string[] {
  return [
    '-y',
    '-i',
    inputPath,
    '-t',
    String(PREVIEW_MAX_SECONDS),
    '-an',
    '-vf',
    `scale='min(${PREVIEW_WIDTH},iw)':-2:flags=lanczos`,
    '-c:v',
    'libx264',
    '-profile:v',
    'main',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    String(PREVIEW_CRF),
    '-preset',
    'veryfast',
    '-movflags',
    '+faststart',
    '-loglevel',
    'error',
    outputPath,
  ]
}

function runPreviewFfmpeg(inputPath: string, outputPath: string): Promise<void> {
  return runFfmpeg(buildPreviewFfmpegArgs(inputPath, outputPath))
}

export function buildPlaybackFfmpegArgs(inputPath: string, outputPath: string): string[] {
  return [
    '-y',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    `scale='if(gt(iw,ih),min(${PLAYBACK_MAX_EDGE},iw),-2)':'if(gt(iw,ih),-2,min(${PLAYBACK_MAX_EDGE},ih))':flags=lanczos`,
    '-c:v',
    'libx264',
    '-profile:v',
    'main',
    '-level:v',
    '4.0',
    '-tag:v',
    'avc1',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    String(PLAYBACK_CRF),
    '-preset',
    'veryfast',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    '-loglevel',
    'error',
    outputPath,
  ]
}

function runPlaybackFfmpeg(inputPath: string, outputPath: string): Promise<void> {
  return runFfmpeg(buildPlaybackFfmpegArgs(inputPath, outputPath))
}

type PreviewJob = {
  sourceUrl: string
  inputPath: string
  previewKey: string
  outputPath: string
  previewDone: boolean
  playbackKey: string
  playbackOutputPath: string
  playbackDone: boolean
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2))
  const manifest: MirrorManifest = await readMirrorManifest(manifestPath)

  const jobs: PreviewJob[] = []
  let alreadyDone = 0
  let missingOriginal = 0

  for (const [sourceUrl, record] of Object.entries(manifest.assets)) {
    if (record.kind !== 'video' || record.status !== 'ok') {
      continue
    }

    const previewKey = videoPreviewKey(record.key)
    const playbackKey = videoPlaybackKey(record.key)
    const outputPath = path.join(assetsRoot, previewKey)
    const playbackOutputPath = path.join(assetsRoot, playbackKey)
    const inputPath = path.join(assetsRoot, record.key)

    const previewDone = record.previewKey && (await fileExists(outputPath))
    const playbackDone = record.playbackKey && (await fileExists(playbackOutputPath))
    if (!options.force && previewDone && playbackDone) {
      alreadyDone += 1
      continue
    }
    if (!(await fileExists(inputPath))) {
      missingOriginal += 1
      continue
    }

    jobs.push({
      sourceUrl,
      inputPath,
      previewKey,
      outputPath,
      previewDone: Boolean(previewDone),
      playbackKey,
      playbackOutputPath,
      playbackDone: Boolean(playbackDone),
    })
  }

  const queue = options.limit ? jobs.slice(0, options.limit) : jobs

  console.log(
    `Video previews/playback: ${alreadyDone} already generated, ${missingOriginal} missing local original, ` +
      `${queue.length} to encode (preview width ${PREVIEW_WIDTH}, playback max edge ${PLAYBACK_MAX_EDGE}).`,
  )

  if (options.dryRun || queue.length === 0) {
    return
  }

  let completed = 0
  let failed = 0
  let previewBytes = 0
  let sinceFlush = 0

  await runWithConcurrency(queue, options.concurrency, async (job) => {
    try {
      await mkdir(path.dirname(job.outputPath), { recursive: true })
      await mkdir(path.dirname(job.playbackOutputPath), { recursive: true })
      if (!job.previewDone || options.force) {
        await runPreviewFfmpeg(job.inputPath, job.outputPath)
      }
      if (!job.playbackDone || options.force) {
        await runPlaybackFfmpeg(job.inputPath, job.playbackOutputPath)
      }
      const { size: previewSize } = await stat(job.outputPath)
      const { size: playbackSize } = await stat(job.playbackOutputPath)

      const record = manifest.assets[job.sourceUrl]
      record.previewKey = job.previewKey
      record.previewBytes = previewSize
      record.playbackKey = job.playbackKey
      record.playbackBytes = playbackSize
      completed += 1
      previewBytes += previewSize + playbackSize
    } catch (error) {
      failed += 1
      const reason = error instanceof Error ? error.message : 'unknown error'
      console.warn(`  preview failed for ${job.previewKey}: ${reason}`)
    }

    sinceFlush += 1
    if (sinceFlush >= MANIFEST_FLUSH_INTERVAL) {
      sinceFlush = 0
      await writeMirrorManifest(manifestPath, manifest)
    }

    const done = completed + failed
    if (done % 50 === 0 || done === queue.length) {
      console.log(
        `Progress: ${done}/${queue.length} (${failed} failed, ${(previewBytes / 1024 / 1024).toFixed(1)} MB encoded)`,
      )
    }
  })

  await writeMirrorManifest(manifestPath, manifest)

  console.log(
    `Video previews complete: ${completed} encoded (${(previewBytes / 1024 / 1024).toFixed(1)} MB), ${failed} failed.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const reason = error instanceof Error ? error.message : 'Unknown preview failure'
    console.error(`generate-video-previews failed: ${reason}`)
    process.exitCode = 1
  })
}
