import path from 'node:path'

import { buildExportArtifacts } from '../src/features/bookmarks/export-artifacts'
import { readJsonLines, writeExportArtifacts } from './export-lib'

const projectRoot = process.cwd()
const rawBookmarksPath = path.join(projectRoot, '.data/fieldtheory/bookmarks.jsonl')
const outputDirectory = path.join(projectRoot, 'public/data')

async function main() {
  const records = await readJsonLines(rawBookmarksPath)
  const artifacts = buildExportArtifacts(records, {
    buildId: new Date().toISOString().replaceAll(':', '-'),
    builtAt: new Date().toISOString(),
    chunkSize: 500,
  })

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
