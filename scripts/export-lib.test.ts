import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildExportArtifacts } from '../src/features/bookmarks/export-artifacts'
import { writeExportArtifacts } from './export-lib'

describe('atomic export artifact publication', () => {
  it('swaps a complete staged generation into place and removes stale files', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'twitter-bookmarks-export-'))
    const outputDirectory = path.join(parent, 'data')
    const artifacts = buildExportArtifacts(
      [
        {
          id: '1',
          url: 'https://x.com/example/status/1',
          text: 'example',
          mediaObjects: [
            {
              type: 'photo',
              mediaUrl: 'https://pbs.twimg.com/media/example.jpg',
              width: 100,
              height: 100,
            },
          ],
        },
      ],
      { buildId: 'generation-1', builtAt: 'now', chunkSize: 10 },
    )

    await writeExportArtifacts(outputDirectory, artifacts)
    await writeFile(path.join(outputDirectory, 'stale.json'), '{}')
    artifacts.manifest.buildId = 'generation-2'
    await writeExportArtifacts(outputDirectory, artifacts)

    const manifest = JSON.parse(await readFile(path.join(outputDirectory, 'manifest.json'), 'utf8'))
    expect(manifest.buildId).toBe('generation-2')
    await expect(access(path.join(outputDirectory, manifest.files.gridAll))).resolves.toBeUndefined()
    await expect(access(path.join(outputDirectory, 'stale.json'))).rejects.toThrow()
  })
})
