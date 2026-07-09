import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import {
  mirrorVariantKey,
  mirrorVariantWidths,
  readMirrorManifest,
  runWithConcurrency,
  writeMirrorManifest,
  type MirrorManifest,
} from './mirror-lib'

// Generates any AVIF variant widths that were added to MIRROR_VARIANT_WIDTHS after
// an image was originally mirrored, sourcing from the local archived original.
// Incremental and idempotent: existing variant files are left untouched.

const projectRoot = process.cwd()
const mirrorRoot = path.join(projectRoot, '.data/media')
const assetsRoot = path.join(mirrorRoot, 'assets')
const manifestPath = path.join(mirrorRoot, 'mirror-manifest.json')

const MANIFEST_FLUSH_INTERVAL = 50

type CliOptions = {
  concurrency: number
  dryRun: boolean
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = { concurrency: 4, dryRun: false }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--concurrency') {
      options.concurrency = Number(argv[index + 1])
      index += 1
    } else if (argument === '--dry-run') {
      options.dryRun = true
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
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

type BackfillJob = {
  sourceUrl: string
  inputPath: string
  missingWidths: number[]
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2))
  const manifest: MirrorManifest = await readMirrorManifest(manifestPath)
  const allWidths = mirrorVariantWidths()

  const jobs: BackfillJob[] = []
  let missingOriginal = 0

  for (const [sourceUrl, record] of Object.entries(manifest.assets)) {
    if (record.kind !== 'image' || record.status !== 'ok') {
      continue
    }

    const inputPath = path.join(assetsRoot, record.key)
    const missingWidths: number[] = []
    for (const width of allWidths) {
      if (!(await fileExists(path.join(assetsRoot, mirrorVariantKey(record.key, width))))) {
        missingWidths.push(width)
      }
    }

    if (missingWidths.length === 0) {
      continue
    }

    if (!(await fileExists(inputPath))) {
      missingOriginal += 1
      continue
    }

    jobs.push({ sourceUrl, inputPath, missingWidths })
  }

  console.log(
    `Backfill: ${jobs.length} images need variants` +
      (missingOriginal > 0 ? ` (${missingOriginal} skipped: original missing locally)` : ''),
  )

  if (options.dryRun || jobs.length === 0) {
    return
  }

  let completed = 0
  let failed = 0

  await runWithConcurrency(jobs, options.concurrency, async (job) => {
    const record = manifest.assets[job.sourceUrl]
    try {
      const variants = [...(record.variants ?? [])]
      for (const width of job.missingWidths) {
        const variantKey = mirrorVariantKey(record.key, width)
        const avifBuffer = await sharp(job.inputPath)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .avif({ quality: 60, effort: 4 })
          .toBuffer()
        const filePath = path.join(assetsRoot, variantKey)
        await mkdir(path.dirname(filePath), { recursive: true })
        await writeFile(filePath, avifBuffer)
        variants.push({ key: variantKey, width })
      }
      record.variants = variants.sort((left, right) => left.width - right.width)
      completed += 1
    } catch (error) {
      failed += 1
      console.error(
        `Failed ${record.key}: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }

    if ((completed + failed) % MANIFEST_FLUSH_INTERVAL === 0) {
      await writeMirrorManifest(manifestPath, manifest)
      console.log(`Progress: ${completed + failed}/${jobs.length} (${failed} failed)`)
    }
  })

  await writeMirrorManifest(manifestPath, manifest)
  console.log(`Backfill complete: ${completed} images updated, ${failed} failed.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
