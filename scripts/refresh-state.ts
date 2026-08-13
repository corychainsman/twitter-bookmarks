import { createReadStream } from 'node:fs'
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline'

const projectRoot = process.cwd()

export const REFRESH_STATE_PATH = path.join(projectRoot, 'ops/refresh-state.json')
export const RAW_BOOKMARKS_PATH = path.join(
  projectRoot,
  '.data/fieldtheory/bookmarks.jsonl',
)
export const FULL_RECONCILIATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000

export type RefreshState = {
  schemaVersion: 1
  newestBookmarkId: string
  bookmarkCount: number
  lastSuccessfulAt: string
  lastFullReconciliationAt: string
  catalogBuildId: string
}

export type BookmarkSnapshot = {
  newestBookmarkId: string
  bookmarkCount: number
  checkpointTokenPresent: boolean
}

type BookmarkTokenRecord = {
  id: string
  sortIndex?: string | null
}

export function selectBookmarkSnapshot(
  records: readonly BookmarkTokenRecord[],
  checkpointToken?: string,
): BookmarkSnapshot {
  let newestBookmarkId = ''
  let newestSortIndex = Number.NEGATIVE_INFINITY
  let checkpointTokenPresent = !checkpointToken

  for (const record of records) {
    const sortIndex = Number(record.sortIndex ?? 0)
    if (sortIndex > newestSortIndex) {
      newestSortIndex = sortIndex
      newestBookmarkId = record.id
    }
    if (record.id === checkpointToken) checkpointTokenPresent = true
  }

  return {
    newestBookmarkId,
    bookmarkCount: records.length,
    checkpointTokenPresent,
  }
}

export async function readRefreshState(
  statePath = REFRESH_STATE_PATH,
): Promise<RefreshState | undefined> {
  try {
    return JSON.parse(await readFile(statePath, 'utf8')) as RefreshState
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

export async function readBookmarkSnapshot(
  checkpointToken?: string,
  bookmarksPath = RAW_BOOKMARKS_PATH,
): Promise<BookmarkSnapshot> {
  try {
    await access(bookmarksPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return selectBookmarkSnapshot([], checkpointToken)
  }

  const records: BookmarkTokenRecord[] = []
  const input = createReadStream(bookmarksPath, { encoding: 'utf8' })
  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY })

  for await (const line of lines) {
    if (!line.trim()) continue
    records.push(JSON.parse(line) as BookmarkTokenRecord)
  }

  return selectBookmarkSnapshot(records, checkpointToken)
}

export function shouldRunFullReconciliation(
  state: RefreshState | undefined,
  snapshot: BookmarkSnapshot,
  now = new Date(),
): boolean {
  if (!state || !snapshot.checkpointTokenPresent) return true
  const lastFull = Date.parse(state.lastFullReconciliationAt)
  return !Number.isFinite(lastFull) || now.getTime() - lastFull >= FULL_RECONCILIATION_INTERVAL_MS
}

export function bookmarkSnapshotChanged(
  state: RefreshState | undefined,
  snapshot: BookmarkSnapshot,
): boolean {
  return !state ||
    state.newestBookmarkId !== snapshot.newestBookmarkId ||
    state.bookmarkCount !== snapshot.bookmarkCount
}

export async function writeRefreshState(
  state: RefreshState,
  statePath = REFRESH_STATE_PATH,
): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true })
  const temporaryPath = `${statePath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, statePath)
}
