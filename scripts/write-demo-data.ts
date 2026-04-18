import path from 'node:path'

import { buildExportArtifacts } from '../src/features/bookmarks/export-artifacts'
import { demoBookmarkRecords } from '../src/features/bookmarks/demo-records'
import { writeExportArtifacts } from './export-lib'

const projectRoot = process.cwd()
const outputDirectory = path.join(projectRoot, 'public/data')

async function main() {
  const artifacts = buildExportArtifacts(demoBookmarkRecords, {
    buildId: 'demo-build',
    builtAt: new Date().toISOString(),
    chunkSize: 500,
  })

  await writeExportArtifacts(outputDirectory, artifacts)
  console.log(`Wrote demo data to ${path.relative(projectRoot, outputDirectory)}.`)
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown demo export failure'
  console.error(`write-demo-data failed: ${reason}`)
  process.exitCode = 1
})
