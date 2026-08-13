import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assignGlobalFolderTimelineSortIndexes,
  buildFieldTheoryFolderArgs,
  FIELDTHEORY_FOLDER_SUBSTRING,
  FIELDTHEORY_DELAY_MS,
  FIELDTHEORY_MAX_PAGES,
  FIELDTHEORY_PAGE_SIZE,
  hasKnownIncrementalBoundary,
  mergeIncrementalFolderTimeline,
  parseFieldTheorySourceContract,
  resolveFieldTheoryTargetFolders,
  retainFieldTheoryTargetFolders,
} from '../scripts/fieldtheory'

describe('fieldtheory sync wrapper', () => {
  it('builds a folder-only sync command for Inspo', () => {
    expect(buildFieldTheoryFolderArgs()).toEqual([
      'run',
      'scripts/fieldtheory-folder-sync.ts',
      '--folder-contains',
      FIELDTHEORY_FOLDER_SUBSTRING,
      '--max-pages',
      String(FIELDTHEORY_MAX_PAGES),
      '--delay-ms',
      String(FIELDTHEORY_DELAY_MS),
      '--page-size',
      String(FIELDTHEORY_PAGE_SIZE),
    ])
  })

  it('detects the local Inspo-only wrapper contract', async () => {
    const source = await readFile(path.join(process.cwd(), 'scripts/fieldtheory.ts'), 'utf8')
    const contract = parseFieldTheorySourceContract(source)

    expect(contract).toEqual({
      folderSyncIsInspoOnly: true,
      folderSyncUsesDedicatedFolderRunner: true,
      folderSyncNormalizesTimelineSortIndexes: true,
    })
  })

  it('selects every folder containing inspo case-insensitively', () => {
    expect(
      resolveFieldTheoryTargetFolders([
        { id: '1', name: '🖼️ Inspo' },
        { id: '2', name: 'Architecture INSPo' },
        { id: '3', name: 'Recipes' },
      ]).map((folder) => folder.id),
    ).toEqual(['1', '2'])
  })

  it('retains records belonging to any selected inspo folder', () => {
    expect(
      retainFieldTheoryTargetFolders(
        [
          { id: 'first', folderIds: ['1'] },
          { id: 'second', folderNames: ['Architecture Inspo'] },
          { id: 'other', folderIds: ['3'] },
        ],
        [
          { id: '1', name: '🖼️ Inspo' },
          { id: '2', name: 'Architecture Inspo' },
        ],
      ).map((record) => record.id),
    ).toEqual(['first', 'second'])
  })

  it('normalizes folder timeline order to a global bookmark rank', () => {
    const ranked = assignGlobalFolderTimelineSortIndexes([
      { id: 'newest', sortIndex: '20' },
      { id: 'middle', sortIndex: '19' },
      { id: 'oldest', sortIndex: '20' },
    ])

    expect(ranked).toEqual([
      { id: 'newest', sortIndex: '3' },
      { id: 'middle', sortIndex: '2' },
      { id: 'oldest', sortIndex: '1' },
    ])
  })

  it('requires a complete page of known records before accepting an incremental boundary', () => {
    const knownIds = new Set(['known-1', 'known-2'])

    expect(
      hasKnownIncrementalBoundary(
        [{ id: 'new' }, { id: 'known-1' }, { id: 'known-2' }],
        knownIds,
        2,
      ),
    ).toBe(true)
    expect(
      hasKnownIncrementalBoundary(
        [{ id: 'new' }, { id: 'known-1' }],
        knownIds,
        2,
      ),
    ).toBe(false)
  })

  it('prepends the walked overlap and preserves the older stored timeline', () => {
    expect(
      mergeIncrementalFolderTimeline(
        [
          { id: 'known-1', sortIndex: '3' },
          { id: 'known-2', sortIndex: '2' },
          { id: 'oldest', sortIndex: '1' },
        ],
        [
          { id: 'new' },
          { id: 'known-1' },
          { id: 'known-2' },
        ],
      ).map((record) => record.id),
    ).toEqual(['new', 'known-1', 'known-2', 'oldest'])
  })
})
