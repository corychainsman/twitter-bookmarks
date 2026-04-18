export const FIELDTHEORY_VERSION = '1.3.9'
export const FIELDTHEORY_MAX_PAGES = 10_000
export const FIELDTHEORY_MAX_MINUTES = 240
export const FIELDTHEORY_DELAY_MS = 600

export type FieldTheorySyncMode = 'fresh' | 'resume' | 'full'

export function buildFieldTheoryTimelineArgs(mode: FieldTheorySyncMode): string[] {
  const modeArgs =
    mode === 'resume' ? ['--continue'] : mode === 'full' ? ['--rebuild'] : []

  return [
    'sync',
    ...modeArgs,
    '--max-pages',
    String(FIELDTHEORY_MAX_PAGES),
    '--max-minutes',
    String(FIELDTHEORY_MAX_MINUTES),
    '--delay-ms',
    String(FIELDTHEORY_DELAY_MS),
  ]
}

export function buildFieldTheoryGapArgs(): string[] {
  return ['sync', '--gaps', '--delay-ms', String(FIELDTHEORY_DELAY_MS)]
}

export function parseFieldTheorySourceContract(source: string): {
  cliRejectsMixedTimelineAndGaps: boolean
  cliRejectsMixedGapsAndFolders: boolean
  folderSyncOmitsMaxPages: boolean
} {
  return {
    cliRejectsMixedTimelineAndGaps: source.includes(
      '--rebuild, --continue, and --gaps cannot be used together',
    ),
    cliRejectsMixedGapsAndFolders: source.includes(
      '--folders/--folder cannot be combined with --gaps',
    ),
    folderSyncOmitsMaxPages: source.includes(
      'walkResult = await walkFolderTimeline(csrfToken, folder.id, { cookieHeader, delayMs });',
    ),
  }
}
