export const FIELDTHEORY_VERSION = '1.3.9'
export const FIELDTHEORY_FOLDER_SUBSTRING = 'inspo'
export const FIELDTHEORY_MAX_PAGES = 10_000
export const FIELDTHEORY_DELAY_MS = 600
export const FIELDTHEORY_PAGE_SIZE = 100
export const FIELDTHEORY_INCREMENTAL_INITIAL_PAGES = 2
export const FIELDTHEORY_INCREMENTAL_KNOWN_OVERLAP = FIELDTHEORY_PAGE_SIZE

type TimelineSortableRecord = {
  id: string
  sortIndex?: string | null
}

type NamedFolder = {
  id: string
  name: string
}

type FolderTaggedRecord = {
  folderIds?: string[]
  folderNames?: string[]
}

export function resolveFieldTheoryTargetFolders<T extends NamedFolder>(allFolders: T[]): T[] {
  const lower = FIELDTHEORY_FOLDER_SUBSTRING.toLowerCase()
  const matches = allFolders.filter((folder) =>
    folder.name.trim().toLowerCase().includes(lower),
  )

  if (matches.length === 0) {
    throw new Error(
      `No folders contain "${FIELDTHEORY_FOLDER_SUBSTRING}". Available: ${allFolders.map((folder) => folder.name).join(', ') || '(none)'}`,
    )
  }

  return matches
}

export function retainFieldTheoryTargetFolders<T extends FolderTaggedRecord>(
  records: T[],
  targetFolders: NamedFolder[],
): T[] {
  return records.filter((record) =>
    targetFolders.some((targetFolder) => {
      const folderIdMatch = (record.folderIds ?? []).includes(targetFolder.id)
      const folderNameMatch = (record.folderNames ?? []).some(
        (folderName) =>
          folderName.trim().toLowerCase() === targetFolder.name.trim().toLowerCase(),
      )

      return folderIdMatch || folderNameMatch
    }),
  )
}

export function buildFieldTheoryFolderArgs(options: { full?: boolean } = {}): string[] {
  const args = [
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
      `FIELDTHEORY_FOLDER_SUBSTRING = '${FIELDTHEORY_FOLDER_SUBSTRING}'`,
    ),
    folderSyncUsesDedicatedFolderRunner: source.includes(
      "scripts/fieldtheory-folder-sync.ts",
    ),
    folderSyncNormalizesTimelineSortIndexes: source.includes(
      'assignGlobalFolderTimelineSortIndexes',
    ),
  }
}
