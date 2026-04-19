import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildFieldTheoryFolderArgs,
  FIELDTHEORY_FOLDER_NAME,
  FIELDTHEORY_DELAY_MS,
  FIELDTHEORY_MAX_PAGES,
  parseFieldTheorySourceContract,
} from '../scripts/fieldtheory'

describe('fieldtheory sync wrapper', () => {
  it('builds a folder-only sync command for Inspo', () => {
    expect(buildFieldTheoryFolderArgs()).toEqual([
      'run',
      'scripts/fieldtheory-folder-sync.ts',
      '--folder',
      FIELDTHEORY_FOLDER_NAME,
      '--max-pages',
      String(FIELDTHEORY_MAX_PAGES),
      '--delay-ms',
      String(FIELDTHEORY_DELAY_MS),
    ])
  })

  it('detects the local Inspo-only wrapper contract', async () => {
    const source = await readFile(path.join(process.cwd(), 'scripts/fieldtheory.ts'), 'utf8')
    const contract = parseFieldTheorySourceContract(source)

    expect(contract).toEqual({
      folderSyncIsInspoOnly: true,
      folderSyncUsesDedicatedFolderRunner: true,
    })
  })
})
