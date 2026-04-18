import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ExportArtifacts } from '../src/features/bookmarks/export-artifacts'
import type { RawBookmarkRecord } from '../src/features/bookmarks/model'

export async function readJsonLines(filePath: string): Promise<RawBookmarkRecord[]> {
  const fileContents = await readFile(filePath, 'utf8')

  return fileContents
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .map((line: string) => JSON.parse(line) as RawBookmarkRecord)
}

export async function writeExportArtifacts(
  outputDirectory: string,
  artifacts: ExportArtifacts,
): Promise<void> {
  await rm(outputDirectory, { recursive: true, force: true })
  await mkdir(path.join(outputDirectory, 'tweets'), { recursive: true })
  await mkdir(path.join(outputDirectory, 'grid'), { recursive: true })
  await mkdir(path.join(outputDirectory, 'order'), { recursive: true })
  await mkdir(path.join(outputDirectory, 'search'), { recursive: true })

  await Promise.all([
    writeJson(path.join(outputDirectory, 'manifest.json'), artifacts.manifest),
    writeJson(path.join(outputDirectory, artifacts.manifest.files.gridOne), artifacts.gridOne),
    writeJson(path.join(outputDirectory, artifacts.manifest.files.gridAll), artifacts.gridAll),
    writeJson(
      path.join(outputDirectory, artifacts.manifest.files.orderBookmarked),
      artifacts.orderBookmarked,
    ),
    writeJson(
      path.join(outputDirectory, artifacts.manifest.files.orderPosted),
      artifacts.orderPosted,
    ),
    writeJson(path.join(outputDirectory, artifacts.manifest.files.searchIndex), artifacts.searchIndex),
    writeJson(path.join(outputDirectory, artifacts.manifest.files.searchStore), artifacts.searchStore),
    ...artifacts.docsChunks.map((chunk) =>
      writeJson(path.join(outputDirectory, chunk.fileName), chunk.docs),
    ),
  ])
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
