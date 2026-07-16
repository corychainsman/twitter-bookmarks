declare module 'fieldtheory/dist/chrome-cookies.js' {
  export function extractChromeXCookies(
    chromeUserDataDir: string,
    chromeProfileDirectory: string,
    browser: unknown,
  ): {
    csrfToken: string
    cookieHeader: string
  }
}

declare module 'fieldtheory/dist/config.js' {
  export function loadChromeSessionConfig(options?: {
    browserId?: string
  }): {
    chromeUserDataDir: string
    chromeProfileDirectory: string
    browser: {
      cookieBackend: 'firefox' | string
    }
  }
}

declare module 'fieldtheory/dist/firefox-cookies.js' {
  export function extractFirefoxXCookies(firefoxProfileDir?: string): {
    csrfToken: string
    cookieHeader: string
  }
}

declare module 'fieldtheory/dist/graphql-bookmarks.js' {
  export function fetchBookmarkFolders(
    csrfToken: string,
    cookieHeader: string,
  ): Promise<Array<{ id: string; name: string }>>

  export function walkFolderTimeline(
    csrfToken: string,
    folderId: string,
    options?: {
      cookieHeader?: string
      delayMs?: number
      maxPages?: number
    },
  ): Promise<{
    complete: boolean
    records: Array<{ id: string; folderIds?: string[]; folderNames?: string[] }>
  }>

  export function applyFolderMirror<T extends { id: string; folderIds?: string[]; folderNames?: string[] }>(
    existing: T[],
    folder: { id: string; name: string },
    walkedRecords: T[],
  ): {
    merged: T[]
  }
}

declare module 'fieldtheory/dist/fs.js' {
  export function pathExists(filePath: string): Promise<boolean>
  export function readJson<T>(filePath: string): Promise<T>
  export function readJsonLines<T>(filePath: string): Promise<T[]>
  export function writeJson(filePath: string, value: unknown): Promise<void>
  export function writeJsonLines(filePath: string, rows: unknown[]): Promise<void>
}

declare module 'fieldtheory/dist/paths.js' {
  export function ensureDataDir(): string
  export function twitterBookmarksCachePath(): string
  export function twitterBookmarksMetaPath(): string
}
