import path from 'node:path'

import { buildExportArtifacts } from '../src/features/bookmarks/export-artifacts'
import { readJsonLines, writeExportArtifacts } from './export-lib'
import { assertVerifiedMediaPublication } from './media-publication'
import { readMirrorManifest } from './mirror-lib'
import { applyMirrorRewrite, DEFAULT_MEDIA_BASE_URL } from './mirror-rewrite'

const projectRoot = process.cwd()
const rawBookmarksPath = path.join(projectRoot, '.data/fieldtheory/bookmarks.jsonl')
const mirrorManifestPath = path.join(projectRoot, '.data/media/mirror-manifest.json')
const outputDirectory = path.join(projectRoot, 'public/data')

async function main() {
  const records = await readJsonLines(rawBookmarksPath)
  const artifacts = buildExportArtifacts(records, {
    buildId: new Date().toISOString().replaceAll(':', '-'),
    builtAt: new Date().toISOString(),
    chunkSize: 500,
  })

  const mirrorManifest = await readMirrorManifest(mirrorManifestPath)
  const mirroredAssetCount = Object.values(mirrorManifest.assets).filter(
    (asset) => asset.status === 'ok',
  ).length

  if (mirroredAssetCount > 0) {
    const mediaBaseUrl = process.env.MEDIA_BASE_URL || DEFAULT_MEDIA_BASE_URL
    const publication = await assertVerifiedMediaPublication({ mediaBaseUrl })
    const stats = applyMirrorRewrite(artifacts, mirrorManifest, mediaBaseUrl)
    artifacts.manifest.mediaCatalogGeneration = publication.manifestDigest
    console.log(
      `Mirror rewrite: ${stats.rewrittenUrls}/${stats.totalUrls} media URLs now served from ${mediaBaseUrl} ` +
        `(${stats.thumbhashedGridItems} grid items thumbhashed, ${stats.previewGridItems} with autoplay previews).`,
    )
  } else {
    console.log('Mirror rewrite skipped: no mirrored assets in .data/media/mirror-manifest.json.')
  }

  await writeExportArtifacts(outputDirectory, artifacts)

  console.log(
    `Exported ${artifacts.manifest.tweetCount} media tweets to ${path.relative(projectRoot, outputDirectory)}.`,
  )
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown export failure'
  console.error(`export-fieldtheory failed: ${reason}`)
  process.exitCode = 1
})
