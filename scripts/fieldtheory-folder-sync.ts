import {
  applyFolderMirror,
  fetchBookmarkFolders,
  walkFolderTimeline,
} from 'fieldtheory/dist/graphql-bookmarks.js'
import {
  pathExists,
  readJson,
  readJsonLines,
  writeJson,
  writeJsonLines,
} from 'fieldtheory/dist/fs.js'
import {
  ensureDataDir,
  twitterBookmarksCachePath,
  twitterBookmarksMetaPath,
} from 'fieldtheory/dist/paths.js'

import {
  assignGlobalFolderTimelineSortIndexes,
  FIELDTHEORY_DELAY_MS,
  FIELDTHEORY_FOLDER_SUBSTRING,
  FIELDTHEORY_INCREMENTAL_INITIAL_PAGES,
  FIELDTHEORY_MAX_PAGES,
  hasKnownIncrementalBoundary,
  mergeIncrementalFolderTimeline,
  resolveFieldTheoryTargetFolders,
  retainFieldTheoryTargetFolders,
} from './fieldtheory'
import { resolveFieldTheoryXCredentials } from './x-credentials'

type Folder = {
  id: string
  name: string
}

type BookmarkRecord = {
  id: string
  sortIndex?: string | null
  folderIds?: string[]
  folderNames?: string[]
}

type SyncMeta = {
  lastFullSyncAt?: string
  lastIncrementalSyncAt?: string
}

type SyncOptions = {
  browser?: string
  chromeUserDataDir?: string
  chromeProfileDirectory?: string
  firefoxProfileDir?: string
  delayMs: number
  full: boolean
  maxPages: number
  pageSize: number
}

function parseArgs(argv: string[]): SyncOptions {
  const options: SyncOptions = {
    delayMs: FIELDTHEORY_DELAY_MS,
    full: false,
    maxPages: FIELDTHEORY_MAX_PAGES,
    pageSize: 100,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    const next = argv[index + 1]

    if (value === '--folder-contains' && next) {
      if (next.trim().toLowerCase() !== FIELDTHEORY_FOLDER_SUBSTRING) {
        throw new Error(`Only folders containing "${FIELDTHEORY_FOLDER_SUBSTRING}" are supported.`)
      }
      index += 1
      continue
    }

    if (value === '--full') {
      options.full = true
      continue
    }

    if (value === '--browser' && next) {
      options.browser = next
      index += 1
      continue
    }

    if (value === '--chrome-user-data-dir' && next) {
      options.chromeUserDataDir = next
      index += 1
      continue
    }

    if (value === '--chrome-profile-directory' && next) {
      options.chromeProfileDirectory = next
      index += 1
      continue
    }

    if (value === '--firefox-profile-dir' && next) {
      options.firefoxProfileDir = next
      index += 1
      continue
    }

    if (value === '--delay-ms' && next) {
      options.delayMs = Number(next)
      index += 1
      continue
    }

    if (value === '--max-pages' && next) {
      options.maxPages = Number(next)
      index += 1
      continue
    }

    if (value === '--page-size' && next) {
      options.pageSize = Number(next)
      index += 1
      continue
    }
  }

  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
    throw new Error(`Invalid --delay-ms value: ${options.delayMs}`)
  }

  if (!Number.isFinite(options.maxPages) || options.maxPages < 1) {
    throw new Error(`Invalid --max-pages value: ${options.maxPages}`)
  }

  if (!Number.isFinite(options.pageSize) || options.pageSize < 1 || options.pageSize > 100) {
    throw new Error(`Invalid --page-size value: ${options.pageSize}`)
  }

  return options
}

async function persistFolderCheckpoint(
  records: BookmarkRecord[],
  full: boolean,
): Promise<void> {
  const cachePath = twitterBookmarksCachePath()
  const metaPath = twitterBookmarksMetaPath()
  const previousMeta = (await pathExists(metaPath))
    ? await readJson<SyncMeta>(metaPath)
    : undefined

  const syncedAt = new Date().toISOString()
  await writeJsonLines(cachePath, records)
  await writeJson(metaPath, {
    provider: 'twitter',
    schemaVersion: 1,
    lastFullSyncAt: full ? syncedAt : previousMeta?.lastFullSyncAt,
    lastIncrementalSyncAt: full ? previousMeta?.lastIncrementalSyncAt : syncedAt,
    totalBookmarks: records.length,
  })
}

async function walkIncrementalFolderTimeline(
  csrfToken: string,
  cookieHeader: string,
  folderId: string,
  knownIds: ReadonlySet<string>,
  options: SyncOptions,
) {
  let maxPages = Math.min(FIELDTHEORY_INCREMENTAL_INITIAL_PAGES, options.maxPages)

  while (true) {
    const result = await walkFolderTimeline(csrfToken, folderId, {
      cookieHeader,
      delayMs: options.delayMs,
      maxPages,
      pageSize: options.pageSize,
    })

    if (result.complete || hasKnownIncrementalBoundary(result.records, knownIds)) {
      return result
    }

    if (maxPages >= options.maxPages) {
      throw new Error(
        `incremental sync could not reach a known-bookmark boundary within ${options.maxPages} pages`,
      )
    }

    maxPages = Math.min(maxPages * 2, options.maxPages)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const { csrfToken, cookieHeader } = resolveFieldTheoryXCredentials(options)

  ensureDataDir()

  const cachePath = twitterBookmarksCachePath()
  const existingRecords = await readJsonLines<BookmarkRecord>(cachePath)
  const allFolders = await fetchBookmarkFolders(csrfToken, cookieHeader)
  const targetFolders = resolveFieldTheoryTargetFolders(allFolders)
  let mergedRecords = retainFieldTheoryTargetFolders(existingRecords, targetFolders)
  const skippedFolders: Array<{ folder: Folder; reason: string }> = []
  let everyWalkComplete = true

  for (const folder of targetFolders) {
    console.error(`  -> ${folder.name}...`)

    try {
      const walkOptions = {
        cookieHeader,
        delayMs: options.delayMs,
        maxPages: options.maxPages,
        pageSize: options.pageSize,
      }

      const existingFolderRecords = retainFieldTheoryTargetFolders(mergedRecords, [folder])
      const knownIds = new Set(existingFolderRecords.map((record) => record.id))
      const walkResult = options.full || knownIds.size === 0
        ? await walkFolderTimeline(csrfToken, folder.id, walkOptions)
        : await walkIncrementalFolderTimeline(
            csrfToken,
            cookieHeader,
            folder.id,
            knownIds,
            options,
          )

      if (options.full && !walkResult.complete) {
        skippedFolders.push({
          folder,
          reason: `incomplete walk (hit page limit ${options.maxPages})`,
        })
        continue
      }

      const targetTimeline = walkResult.complete
        ? walkResult.records
        : mergeIncrementalFolderTimeline(existingFolderRecords, walkResult.records)
      everyWalkComplete &&= walkResult.complete
      const timelineRankedRecords = assignGlobalFolderTimelineSortIndexes(targetTimeline)
      mergedRecords = applyFolderMirror(mergedRecords, folder, timelineRankedRecords).merged as BookmarkRecord[]
      mergedRecords = retainFieldTheoryTargetFolders(mergedRecords, targetFolders)
      if (!options.full) await persistFolderCheckpoint(mergedRecords, false)
    } catch (error) {
      skippedFolders.push({
        folder,
        reason: error instanceof Error ? error.message : 'unknown error',
      })
    }
  }

  if (skippedFolders.length > 0) {
    const skippedSummary = skippedFolders
      .map(({ folder, reason }) => `${folder.name}: ${reason}`)
      .join('; ')

    throw new Error(
      `Folder sync finished with skipped folders. Increase --max-pages or rerun a single folder. ${skippedSummary}`,
    )
  }

  if (options.full || everyWalkComplete) {
    await persistFolderCheckpoint(mergedRecords, true)
  }

  const folderNames = targetFolders.map((folder) => folder.name).join(', ')
  console.log(
    `Folder sync complete: ${folderNames} ${options.full ? 'fully reconciled' : 'incrementally updated'}.`,
  )
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown folder sync failure'
  console.error(`fieldtheory-folder-sync failed: ${reason}`)
  process.exitCode = 1
})
