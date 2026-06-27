import { spawnSync } from 'node:child_process'

import { extractChromeXCookies } from 'fieldtheory/dist/chrome-cookies.js'
import { loadChromeSessionConfig } from 'fieldtheory/dist/config.js'
import { extractFirefoxXCookies } from 'fieldtheory/dist/firefox-cookies.js'
import { fetchBookmarkFolders } from 'fieldtheory/dist/graphql-bookmarks.js'

import { readXBrowserCookies, readXBrowserState, type XBrowserState } from './x-auth-cdp'
import {
  readXCookiePairFromOnePassword,
  type XCookiePair,
  type XCookieStoreOptions,
  writeXCookiePairToOnePassword,
  xCookieHeader,
} from './x-cookie-store'

const AUTH_BROWSER_SERVICE = 'twitter-bookmarks-x-auth-browser.service'
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const DEFAULT_INTERVAL_MS = 10 * 1000

type BrowserConfig = {
  browser: {
    cookieBackend?: string
  }
  chromeUserDataDir: string
  chromeProfileDirectory: string
}

export type XCredentials = XCookiePair

export type FieldTheoryCredentialOptions = {
  browser?: string
  chromeUserDataDir?: string
  chromeProfileDirectory?: string
  firefoxProfileDir?: string
}

export type FieldTheoryCredentials = {
  csrfToken: string
  cookieHeader: string
}

export type XCredentialValidation = {
  ok: boolean
  message: string
}

export type XCredentialEnsureOptions = {
  timeoutMs?: number
  intervalMs?: number
  keepBrowser?: boolean
  service?: string
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  log?: (message: string) => void
  warn?: (message: string) => void
}

export type XCredentialAdapters = {
  readStored?: () => XCredentials | undefined
  writeStored?: (pair: XCredentials) => { vault: string; itemTitle: string; created: boolean }
  fetchBookmarkFolders?: (csrfToken: string, cookieHeader: string) => Promise<unknown[]>
  loadBrowserConfig?: (options: { browserId?: string }) => BrowserConfig
  extractFirefox?: (profileDir?: string) => FieldTheoryCredentials
  extractChrome?: (
    userDataDir: string,
    profileDirectory: string,
    browser: BrowserConfig['browser'],
  ) => FieldTheoryCredentials
  readBrowserCookies?: () => Promise<XCredentials | undefined>
  readBrowserState?: () => Promise<XBrowserState | undefined>
  serviceIsActive?: (service: string) => boolean
  startService?: (service: string) => void
  stopService?: (service: string) => void
}

function envFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]?.trim())
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function runSystemctl(args: string[]): { ok: boolean; output: string } {
  const result = spawnSync('systemctl', ['--user', ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  })
  return {
    ok: result.status === 0,
    output: `${result.stdout}${result.stderr}`.trim(),
  }
}

function defaultServiceIsActive(service: string): boolean {
  return runSystemctl(['is-active', '--quiet', service]).ok
}

function defaultStartService(service: string): void {
  const result = runSystemctl(['start', service])
  if (!result.ok) {
    throw new Error(`Could not start ${service}: ${result.output}`)
  }
}

function defaultStopService(service: string): void {
  const result = runSystemctl(['stop', service])
  if (!result.ok) {
    console.warn(`Could not stop ${service}: ${result.output}`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function vncHint(): string {
  const configured = process.env.X_AUTH_VNC_URL?.trim()
  if (configured) {
    return configured
  }

  const tokenPath =
    process.env.X_COOKIE_CAPTURE_TOKEN_FILE ??
    `${process.env.HOME ?? '.'}/.config/twitter-bookmarks/x-cookie-capture-token`
  const port = process.env.X_AUTH_NOVNC_PORT?.trim() || '6082'
  return `http://127.0.0.1:${port}/vnc_lite.html?path=websockify (password is in ${tokenPath})`
}

function asFieldTheoryCredentials(pair: XCredentials): FieldTheoryCredentials {
  return {
    csrfToken: pair.ct0,
    cookieHeader: xCookieHeader(pair),
  }
}

export function containsTemporaryLimitText(pageText: string | undefined): boolean {
  const normalized = pageText?.toLowerCase() ?? ''
  return (
    normalized.includes('temporarily limited') ||
    normalized.includes('temporarily restricted') ||
    normalized.includes('try again later') ||
    normalized.includes('automated behavior')
  )
}

export function readStoredXCredentials(
  options: XCookieStoreOptions = {},
): XCredentials | undefined {
  return readXCookiePairFromOnePassword(options)
}

export async function validateXCredentials(
  pair: XCredentials | undefined,
  adapters: XCredentialAdapters = {},
): Promise<XCredentialValidation> {
  if (!pair) {
    return { ok: false, message: 'No stored X cookies found in 1Password.' }
  }

  try {
    const fetchFolders = adapters.fetchBookmarkFolders ?? fetchBookmarkFolders
    const folders = await fetchFolders(pair.ct0, xCookieHeader(pair))
    return { ok: true, message: `X cookies are valid. Found ${folders.length} bookmark folders.` }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown validation failure'
    return { ok: false, message: reason }
  }
}

export function resolveFieldTheoryXCredentials(
  options: FieldTheoryCredentialOptions = {},
  adapters: XCredentialAdapters = {},
): FieldTheoryCredentials {
  const readStored = adapters.readStored ?? readStoredXCredentials
  const stored = readStored()
  if (stored) {
    return asFieldTheoryCredentials(stored)
  }

  const loadBrowserConfig = adapters.loadBrowserConfig ?? loadChromeSessionConfig
  const config = loadBrowserConfig({ browserId: options.browser })

  if (config.browser.cookieBackend === 'firefox') {
    const extractFirefox = adapters.extractFirefox ?? extractFirefoxXCookies
    return extractFirefox(options.firefoxProfileDir)
  }

  const extractChrome = adapters.extractChrome ?? extractChromeXCookies
  const chromeDir = options.chromeUserDataDir ?? config.chromeUserDataDir
  const chromeProfile = options.chromeProfileDirectory ?? config.chromeProfileDirectory
  return extractChrome(chromeDir, chromeProfile, config.browser)
}

export async function storeXBrowserCredentials(
  adapters: XCredentialAdapters = {},
): Promise<{ vault: string; itemTitle: string; created: boolean } | undefined> {
  const readBrowser = adapters.readBrowserCookies ?? readXBrowserCookies
  const pair = await readBrowser()
  if (!pair) {
    return undefined
  }

  const writeStored = adapters.writeStored ?? writeXCookiePairToOnePassword
  return writeStored(pair)
}

export async function ensureXCredentials(
  options: XCredentialEnsureOptions = {},
  adapters: XCredentialAdapters = {},
): Promise<XCredentialValidation> {
  const timeoutMs = options.timeoutMs ?? envNumber('X_AUTH_ENSURE_TIMEOUT_MS', DEFAULT_TIMEOUT_MS)
  const intervalMs = options.intervalMs ?? envNumber('X_AUTH_ENSURE_INTERVAL_MS', DEFAULT_INTERVAL_MS)
  const keepBrowser = options.keepBrowser ?? envFlag('X_AUTH_ENSURE_KEEP_BROWSER')
  const service = options.service ?? AUTH_BROWSER_SERVICE
  const now = options.now ?? Date.now
  const sleepFor = options.sleep ?? sleep
  const log = options.log ?? console.log
  const warn = options.warn ?? console.warn

  const readStored = adapters.readStored ?? readStoredXCredentials
  const writeStored = adapters.writeStored ?? writeXCookiePairToOnePassword
  const readState = adapters.readBrowserState ?? readXBrowserState
  const serviceIsActive = adapters.serviceIsActive ?? defaultServiceIsActive
  const startService = adapters.startService ?? defaultStartService
  const stopService = adapters.stopService ?? defaultStopService

  const initialValidation = await validateXCredentials(readStored(), adapters)
  if (initialValidation.ok) {
    return initialValidation
  }

  log(`Stored X cookies failed validation: ${initialValidation.message}`)
  log(`Starting ${service} to look for a live browser session...`)

  const wasActive = serviceIsActive(service)
  if (!wasActive) {
    startService(service)
  }

  log(`If X asks for a challenge, open: ${vncHint()}`)

  const startedAt = now()

  try {
    while (now() - startedAt < timeoutMs) {
      let state: XBrowserState | undefined
      try {
        state = await readState()
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'CDP read failed'
        log(`Waiting for auth browser: ${reason}`)
        await sleepFor(intervalMs)
        continue
      }

      if (containsTemporaryLimitText(state?.pageText)) {
        throw new Error('X is showing a temporary limit/restriction page. Stopped without retrying.')
      }

      if (!state?.cookies) {
        log('Waiting for X cookies in the auth browser...')
        await sleepFor(intervalMs)
        continue
      }

      const result = writeStored(state.cookies)
      const verb = result.created ? 'Created' : 'Updated'
      log(`${verb} "${result.itemTitle}" in the "${result.vault}" vault from browser cookies.`)

      const validation = await validateXCredentials(state.cookies, adapters)
      if (validation.ok) {
        return validation
      }

      log(`Captured cookies did not validate yet: ${validation.message}`)
      await sleepFor(intervalMs)
    }

    throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)} seconds waiting for valid X cookies.`)
  } finally {
    if (!keepBrowser && !wasActive) {
      try {
        stopService(service)
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown stop failure'
        warn(`Could not stop ${service}: ${reason}`)
      }
    }
  }
}
