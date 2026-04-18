import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildFieldTheoryGapArgs,
  buildFieldTheoryTimelineArgs,
  FIELDTHEORY_DELAY_MS,
  FIELDTHEORY_MAX_MINUTES,
  FIELDTHEORY_MAX_PAGES,
  parseFieldTheorySourceContract,
} from '../scripts/fieldtheory'

describe('fieldtheory sync wrapper', () => {
  it('builds a high-page-cap timeline sync command for each mode', () => {
    expect(buildFieldTheoryTimelineArgs('fresh')).toEqual([
      'sync',
      '--max-pages',
      String(FIELDTHEORY_MAX_PAGES),
      '--max-minutes',
      String(FIELDTHEORY_MAX_MINUTES),
      '--delay-ms',
      String(FIELDTHEORY_DELAY_MS),
    ])

    expect(buildFieldTheoryTimelineArgs('resume')).toEqual([
      'sync',
      '--continue',
      '--max-pages',
      String(FIELDTHEORY_MAX_PAGES),
      '--max-minutes',
      String(FIELDTHEORY_MAX_MINUTES),
      '--delay-ms',
      String(FIELDTHEORY_DELAY_MS),
    ])

    expect(buildFieldTheoryTimelineArgs('full')).toEqual([
      'sync',
      '--rebuild',
      '--max-pages',
      String(FIELDTHEORY_MAX_PAGES),
      '--max-minutes',
      String(FIELDTHEORY_MAX_MINUTES),
      '--delay-ms',
      String(FIELDTHEORY_DELAY_MS),
    ])
  })

  it('builds a separate gap-fill command for the installed CLI contract', () => {
    expect(buildFieldTheoryGapArgs()).toEqual([
      'sync',
      '--gaps',
      '--delay-ms',
      String(FIELDTHEORY_DELAY_MS),
    ])
  })

  it('detects the installed upstream folder-sync contract that requires the local wrapper', async () => {
    const [cliSource, graphqlSource] = await Promise.all([
      readFile(path.join(process.cwd(), 'node_modules/fieldtheory/dist/cli.js'), 'utf8'),
      readFile(path.join(process.cwd(), 'node_modules/fieldtheory/dist/graphql-bookmarks.js'), 'utf8'),
    ])
    const contract = parseFieldTheorySourceContract(`${cliSource}\n${graphqlSource}`)

    expect(contract).toEqual({
      cliRejectsMixedTimelineAndGaps: true,
      cliRejectsMixedGapsAndFolders: true,
      folderSyncOmitsMaxPages: true,
    })
  })
})
