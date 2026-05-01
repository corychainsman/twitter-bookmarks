export const FIELDTHEORY_VERSION = '1.3.9'
export const FIELDTHEORY_FOLDER_NAME = 'Inspo'
export const FIELDTHEORY_MAX_PAGES = 10_000
export const FIELDTHEORY_DELAY_MS = 600
export const FIELDTHEORY_PAGE_SIZE = 100

type TimelineSortableRecord = {
  id: string
  sortIndex?: string | null
}

export function buildFieldTheoryFolderArgs(): string[] {
  return [
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
    folderSyncIsInspoOnly: source.includes("FIELDTHEORY_FOLDER_NAME = 'Inspo'"),
    folderSyncUsesDedicatedFolderRunner: source.includes(
      "scripts/fieldtheory-folder-sync.ts",
    ),
    folderSyncNormalizesTimelineSortIndexes: source.includes(
      'assignGlobalFolderTimelineSortIndexes',
    ),
  }
}
