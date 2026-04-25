import { extractChromeXCookies } from 'fieldtheory/dist/chrome-cookies.js'
import { loadChromeSessionConfig } from 'fieldtheory/dist/config.js'
import { extractFirefoxXCookies } from 'fieldtheory/dist/firefox-cookies.js'
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
  FIELDTHEORY_FOLDER_NAME,
  FIELDTHEORY_MAX_PAGES,
} from './fieldtheory'

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
}

type SyncOptions = {
  browser?: string
  chromeUserDataDir?: string
  chromeProfileDirectory?: string
  firefoxProfileDir?: string
  delayMs: number
  maxPages: number
}

function parseArgs(argv: string[]): SyncOptions {
  const options: SyncOptions = {
    delayMs: FIELDTHEORY_DELAY_MS,
    maxPages: FIELDTHEORY_MAX_PAGES,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    const next = argv[index + 1]

    if (value === '--folder' && next) {
      if (next.trim() !== FIELDTHEORY_FOLDER_NAME) {
        throw new Error(`Only the "${FIELDTHEORY_FOLDER_NAME}" folder is supported.`)
      }
      index += 1
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
  }

  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
    throw new Error(`Invalid --delay-ms value: ${options.delayMs}`)
  }

  if (!Number.isFinite(options.maxPages) || options.maxPages < 1) {
    throw new Error(`Invalid --max-pages value: ${options.maxPages}`)
  }

  return options
}

async function resolveFolderSyncCookies(options: SyncOptions): Promise<{
  csrfToken: string
  cookieHeader: string
}> {
  const config = loadChromeSessionConfig({ browserId: options.browser })

  if (config.browser.cookieBackend === 'firefox') {
    const cookies = extractFirefoxXCookies(options.firefoxProfileDir)
    return { csrfToken: cookies.csrfToken, cookieHeader: cookies.cookieHeader }
  }

  const chromeDir = options.chromeUserDataDir ?? config.chromeUserDataDir
  const chromeProfile = options.chromeProfileDirectory ?? config.chromeProfileDirectory
  const cookies = extractChromeXCookies(chromeDir, chromeProfile, config.browser)

  return { csrfToken: cookies.csrfToken, cookieHeader: cookies.cookieHeader }
}

function resolveTargetFolders(allFolders: Folder[]): Folder[] {
  const lower = FIELDTHEORY_FOLDER_NAME.trim().toLowerCase()
  const exact = allFolders.find((folder) => folder.name.trim().toLowerCase() === lower)
  const prefix = allFolders.filter((folder) =>
    folder.name.trim().toLowerCase().startsWith(lower),
  )
  const resolved = exact ?? (prefix.length === 1 ? prefix[0] : undefined)

  if (!resolved) {
    const hint =
      prefix.length > 1
        ? `Multiple matches: ${prefix.map((folder) => folder.name).join(', ')}. Be more specific.`
        : `Available: ${allFolders.map((folder) => folder.name).join(', ') || '(none)'}`

    throw new Error(`No folder matches "${FIELDTHEORY_FOLDER_NAME}". ${hint}`)
  }

  return [resolved]
}

function retainOnlyTargetFolder(
  records: BookmarkRecord[],
  targetFolder: Folder,
): BookmarkRecord[] {
  return records.filter((record) => {
    const folderIdMatch = (record.folderIds ?? []).includes(targetFolder.id)
    const folderNameMatch = (record.folderNames ?? []).some(
      (folderName) => folderName.trim().toLowerCase() === targetFolder.name.trim().toLowerCase(),
    )

    return folderIdMatch || folderNameMatch
  })
}

async function persistFolderCheckpoint(records: BookmarkRecord[]): Promise<void> {
  const cachePath = twitterBookmarksCachePath()
  const metaPath = twitterBookmarksMetaPath()
  const previousMeta = (await pathExists(metaPath))
    ? await readJson<SyncMeta>(metaPath)
    : undefined

  await writeJsonLines(cachePath, records)
  await writeJson(metaPath, {
    provider: 'twitter',
    schemaVersion: 1,
    lastFullSyncAt: previousMeta?.lastFullSyncAt,
    lastIncrementalSyncAt: new Date().toISOString(),
    totalBookmarks: records.length,
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const { csrfToken, cookieHeader } = await resolveFolderSyncCookies(options)

  ensureDataDir()

  const cachePath = twitterBookmarksCachePath()
  const existingRecords = await readJsonLines<BookmarkRecord>(cachePath)
  const allFolders = await fetchBookmarkFolders(csrfToken, cookieHeader)
  const targetFolders = resolveTargetFolders(allFolders)
  let mergedRecords = retainOnlyTargetFolder(existingRecords, targetFolders[0])
  const skippedFolders: Array<{ folder: Folder; reason: string }> = []

  await persistFolderCheckpoint(mergedRecords)

  for (const folder of targetFolders) {
    console.error(`  -> ${folder.name}...`)

    try {
      const walkResult = await walkFolderTimeline(csrfToken, folder.id, {
        cookieHeader,
        delayMs: options.delayMs,
        maxPages: options.maxPages,
      })

      if (!walkResult.complete) {
        skippedFolders.push({
          folder,
          reason: `incomplete walk (hit page limit ${options.maxPages})`,
        })
        continue
      }

      const timelineRankedRecords = assignGlobalFolderTimelineSortIndexes(walkResult.records)
      mergedRecords = applyFolderMirror(mergedRecords, folder, timelineRankedRecords).merged as BookmarkRecord[]
      mergedRecords = retainOnlyTargetFolder(mergedRecords, folder)
      await persistFolderCheckpoint(mergedRecords)
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

  console.log(
    `Folder sync complete: ${targetFolders[0].name} mirrored with max-pages=${options.maxPages}.`,
  )
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown folder sync failure'
  console.error(`fieldtheory-folder-sync failed: ${reason}`)
  process.exitCode = 1
})
