export const FIELDTHEORY_VERSION = '1.3.9'
export const FIELDTHEORY_FOLDER_NAME = 'Inspo'
export const FIELDTHEORY_MAX_PAGES = 10_000
export const FIELDTHEORY_DELAY_MS = 600

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
  ]
}

export function parseFieldTheorySourceContract(source: string): {
  folderSyncIsInspoOnly: boolean
  folderSyncUsesDedicatedFolderRunner: boolean
} {
  return {
    folderSyncIsInspoOnly: source.includes("FIELDTHEORY_FOLDER_NAME = 'Inspo'"),
    folderSyncUsesDedicatedFolderRunner: source.includes(
      "scripts/fieldtheory-folder-sync.ts",
    ),
  }
}
