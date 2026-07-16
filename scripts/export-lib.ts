import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ExportArtifacts } from './catalog/export-artifacts'
import type { RawBookmarkRecord } from './catalog/model'

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
  const parentDirectory = path.dirname(outputDirectory)
  const outputName = path.basename(outputDirectory)
  const generation = randomUUID()
  const stagingDirectory = path.join(parentDirectory, `.${outputName}.staging-${generation}`)
  const backupDirectory = path.join(parentDirectory, `.${outputName}.backup-${generation}`)
  await rm(stagingDirectory, { recursive: true, force: true })
  await mkdir(path.join(stagingDirectory, 'tweets'), { recursive: true })
  await mkdir(path.join(stagingDirectory, 'grid'), { recursive: true })
  await mkdir(path.join(stagingDirectory, 'order'), { recursive: true })
  await mkdir(path.join(stagingDirectory, 'search'), { recursive: true })

  await Promise.all([
    writeJson(path.join(stagingDirectory, artifacts.manifest.files.gridOne), artifacts.gridOne),
    writeJson(path.join(stagingDirectory, artifacts.manifest.files.gridAll), artifacts.gridAll),
    ...(artifacts.manifest.files.gridFirst && artifacts.gridFirst
      ? [
          writeJson(
            path.join(stagingDirectory, artifacts.manifest.files.gridFirst),
            artifacts.gridFirst,
          ),
        ]
      : []),
    writeJson(
      path.join(stagingDirectory, artifacts.manifest.files.orderBookmarked),
      artifacts.orderBookmarked,
    ),
    writeJson(
      path.join(stagingDirectory, artifacts.manifest.files.orderPosted),
      artifacts.orderPosted,
    ),
    writeJson(path.join(stagingDirectory, artifacts.manifest.files.searchIndex), artifacts.searchIndex),
    writeJson(path.join(stagingDirectory, artifacts.manifest.files.searchStore), artifacts.searchStore),
    ...artifacts.docsChunks.map((chunk) =>
      writeJson(path.join(stagingDirectory, chunk.fileName), chunk.docs),
    ),
  ])

  // The manifest is the catalog commit point: never place it in a generation
  // before every file it names has been written successfully.
  await writeJson(path.join(stagingDirectory, 'manifest.json'), artifacts.manifest)

  let movedPreviousGeneration = false
  try {
    try {
      await rename(outputDirectory, backupDirectory)
      movedPreviousGeneration = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await rename(stagingDirectory, outputDirectory)
    await rm(backupDirectory, { recursive: true, force: true })
  } catch (error) {
    if (movedPreviousGeneration) {
      await rename(backupDirectory, outputDirectory).catch(() => undefined)
    }
    throw error
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true })
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
