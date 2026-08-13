import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { generateImageRenditions, imageRenditionWidths } from './image-renditions'
import {
  isContentAddressedMirrorKey,
  mirrorContentKey,
  mirrorKeyForUrl,
  readMirrorManifest,
  runWithConcurrency,
  sha256,
  writeFileAtomically,
  writeMirrorManifest,
  type MirrorManifest,
} from './mirror-lib'

// Migrates legacy convention-based AVIF files to the explicit, content-addressed
// rendition catalog. Existing objects remain in place for old deployed catalogs.

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
}

async function hasCurrentRenditions(record: MirrorManifest['assets'][string]): Promise<boolean> {
  const expectedWidths = imageRenditionWidths(record.width ?? 0)
  if (!record.digest || !record.variants || record.variants.length !== expectedWidths.length) {
    return false
  }
  if (!isContentAddressedMirrorKey(record.key, record.digest)) return false

  const metadataIsCurrent = record.variants.every(
    (variant, index) =>
      variant.width === expectedWidths[index] &&
      Boolean(
        variant.digest &&
          variant.bytes &&
          variant.height &&
          variant.contentType === 'image/avif' &&
          variant.key.includes('/renditions/v2/'),
      ),
  )
  if (!metadataIsCurrent) return false

  return (
    await Promise.all(
      record.variants.map((variant) => fileExists(path.join(assetsRoot, variant.key))),
    )
  ).every(Boolean)
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2))
  const manifest: MirrorManifest = await readMirrorManifest(manifestPath)
  const jobs: BackfillJob[] = []
  let missingOriginal = 0

  for (const [sourceUrl, record] of Object.entries(manifest.assets)) {
    if (record.kind !== 'image' || record.status !== 'ok') {
      continue
    }

    if (await hasCurrentRenditions(record)) {
      continue
    }

    const inputPath = path.join(assetsRoot, record.key)
    if (!(await fileExists(inputPath))) {
      missingOriginal += 1
      continue
    }

    jobs.push({ sourceUrl, inputPath })
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
      const buffer = await readFile(job.inputPath)
      const sourceKey = mirrorKeyForUrl(job.sourceUrl)
      if (!sourceKey) throw new Error(`Cannot derive mirror key for ${job.sourceUrl}`)
      const contentKey = mirrorContentKey(sourceKey, sha256(buffer))
      await writeFileAtomically(path.join(assetsRoot, contentKey), buffer)
      const expectedWidths = imageRenditionWidths(record.width ?? 0)
      const reusableVariants = record.key === contentKey
        ? (await Promise.all(
            (record.variants ?? []).map(async (variant) => ({
              variant,
              reusable:
                expectedWidths.includes(variant.width) &&
                Boolean(
                  variant.digest &&
                    variant.bytes &&
                    variant.height &&
                    variant.contentType === 'image/avif' &&
                    variant.key.includes('/renditions/v2/'),
                ) &&
                await fileExists(path.join(assetsRoot, variant.key)),
            })),
          )).filter(({ reusable }) => reusable).map(({ variant }) => variant)
        : []
      const reusableWidths = new Set(reusableVariants.map((variant) => variant.width))
      const missingWidths = expectedWidths.filter((width) => !reusableWidths.has(width))
      const generated = await generateImageRenditions({
        assetsRoot,
        buffer,
        originalKey: contentKey,
        requestedWidths: missingWidths,
      })
      record.key = contentKey
      record.digest = generated.digest
      record.width = generated.width
      record.height = generated.height
      record.variants = [...reusableVariants, ...generated.variants].toSorted(
        (left, right) => left.width - right.width,
      )
      record.thumbhash = generated.thumbhash
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
