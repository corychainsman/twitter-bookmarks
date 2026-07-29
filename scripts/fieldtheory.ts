export const FIELDTHEORY_VERSION = '1.3.9'
export const FIELDTHEORY_FOLDER_NAME = '🖼️ Inspo'
export const FIELDTHEORY_MAX_PAGES = 10_000
export const FIELDTHEORY_DELAY_MS = 600
export const FIELDTHEORY_PAGE_SIZE = 100
export const FIELDTHEORY_INCREMENTAL_INITIAL_PAGES = 2
export const FIELDTHEORY_INCREMENTAL_KNOWN_OVERLAP = FIELDTHEORY_PAGE_SIZE

type TimelineSortableRecord = {
  id: string
  sortIndex?: string | null
}

export function buildFieldTheoryFolderArgs(options: { full?: boolean } = {}): string[] {
  const args = [
    'run',
    'scripts/fieldtheory-folder-sync.ts',
    '--folder',
    FIELDTHEORY_FOLDER_NAME,
    '--max-pages',
    String(FIELDTHEORY_MAX_PAGES),
    '--delay-ms',
    String(FIELDTHEORY_DELAY_MS),
    '--page-size',
    String(FIELDTHEORY_PAGE_SIZE),
  ]

  if (options.full) args.push('--full')
  return args
}

export function hasKnownIncrementalBoundary(
  walkedRecords: readonly TimelineSortableRecord[],
  knownIds: ReadonlySet<string>,
  requiredOverlap = FIELDTHEORY_INCREMENTAL_KNOWN_OVERLAP,
): boolean {
  if (walkedRecords.length < requiredOverlap) return false
  return walkedRecords.slice(-requiredOverlap).every((record) => knownIds.has(record.id))
}

export function mergeIncrementalFolderTimeline<T extends TimelineSortableRecord>(
  existingRecords: readonly T[],
  walkedRecords: readonly T[],
): T[] {
  const walkedIds = new Set(walkedRecords.map((record) => record.id))
  const preservedRecords = [...existingRecords]
    .filter((record) => !walkedIds.has(record.id))
    .sort((left, right) => Number(right.sortIndex ?? 0) - Number(left.sortIndex ?? 0))

  return [...walkedRecords, ...preservedRecords]
}

export function assignGlobalFolderTimelineSortIndexes<T extends TimelineSortableRecord>(
  records: readonly T[],
): T[] {
  const totalRecords = records.length

  return records.map((record, index) => ({
    ...record,
    sortIndex: String(totalRecords - index),
  }))
}

export function parseFieldTheorySourceContract(source: string): {
  folderSyncIsInspoOnly: boolean
  folderSyncUsesDedicatedFolderRunner: boolean
  folderSyncNormalizesTimelineSortIndexes: boolean
} {
  return {
    folderSyncIsInspoOnly: source.includes(
      `FIELDTHEORY_FOLDER_NAME = '${FIELDTHEORY_FOLDER_NAME}'`,
    ),
    folderSyncUsesDedicatedFolderRunner: source.includes(
      "scripts/fieldtheory-folder-sync.ts",
    ),
    folderSyncNormalizesTimelineSortIndexes: source.includes(
      'assignGlobalFolderTimelineSortIndexes',
    ),
  }
}
