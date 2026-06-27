import { spawnSync } from 'node:child_process'

import { fetchBookmarkFolders } from 'fieldtheory/dist/graphql-bookmarks.js'

import { readXBrowserState } from './x-auth-cdp'
import {
  type XCookiePair,
  readXCookiePairFromOnePassword,
  writeXCookiePairToOnePassword,
  xCookieHeader,
} from './x-cookie-store'

const AUTH_BROWSER_SERVICE = 'twitter-bookmarks-x-auth-browser.service'
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const DEFAULT_INTERVAL_MS = 10 * 1000

type ValidationResult = {
  ok: boolean
  message: string
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

function serviceIsActive(service: string): boolean {
  return runSystemctl(['is-active', '--quiet', service]).ok
}

function startService(service: string): void {
  const result = runSystemctl(['start', service])
  if (!result.ok) {
    throw new Error(`Could not start ${service}: ${result.output}`)
  }
}

function stopService(service: string): void {
  const result = runSystemctl(['stop', service])
  if (!result.ok) {
    console.warn(`Could not stop ${service}: ${result.output}`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function validateCookies(pair: XCookiePair | undefined): Promise<ValidationResult> {
  if (!pair) {
    return { ok: false, message: 'No stored X cookies found in 1Password.' }
  }

  try {
    const folders = await fetchBookmarkFolders(pair.ct0, xCookieHeader(pair))
    return { ok: true, message: `X cookies are valid. Found ${folders.length} bookmark folders.` }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown validation failure'
    return { ok: false, message: reason }
  }
}

function containsTemporaryLimit(pageText: string | undefined): boolean {
  const normalized = pageText?.toLowerCase() ?? ''
  return (
    normalized.includes('temporarily limited') ||
    normalized.includes('temporarily restricted') ||
    normalized.includes('try again later') ||
    normalized.includes('automated behavior')
  )
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

async function main() {
  const timeoutMs = envNumber('X_AUTH_ENSURE_TIMEOUT_MS', DEFAULT_TIMEOUT_MS)
  const intervalMs = envNumber('X_AUTH_ENSURE_INTERVAL_MS', DEFAULT_INTERVAL_MS)
  const keepBrowser = envFlag('X_AUTH_ENSURE_KEEP_BROWSER')

  const initialValidation = await validateCookies(readXCookiePairFromOnePassword())
  if (initialValidation.ok) {
    console.log(initialValidation.message)
    return
  }

  console.log(`Stored X cookies failed validation: ${initialValidation.message}`)
  console.log(`Starting ${AUTH_BROWSER_SERVICE} to look for a live browser session...`)

  const wasActive = serviceIsActive(AUTH_BROWSER_SERVICE)
  if (!wasActive) {
    startService(AUTH_BROWSER_SERVICE)
  }

  console.log(`If X asks for a challenge, open: ${vncHint()}`)

  const startedAt = Date.now()

  try {
    while (Date.now() - startedAt < timeoutMs) {
      let state
      try {
        state = await readXBrowserState()
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'CDP read failed'
        console.log(`Waiting for auth browser: ${reason}`)
        await sleep(intervalMs)
        continue
      }

      if (containsTemporaryLimit(state?.pageText)) {
        throw new Error('X is showing a temporary limit/restriction page. Stopped without retrying.')
      }

      if (!state?.cookies) {
        console.log('Waiting for X cookies in the auth browser...')
        await sleep(intervalMs)
        continue
      }

      const result = writeXCookiePairToOnePassword(state.cookies)
      const verb = result.created ? 'Created' : 'Updated'
      console.log(`${verb} "${result.itemTitle}" in the "${result.vault}" vault from browser cookies.`)

      const validation = await validateCookies(state.cookies)
      if (validation.ok) {
        console.log(validation.message)
        return
      }

      console.log(`Captured cookies did not validate yet: ${validation.message}`)
      await sleep(intervalMs)
    }

    throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)} seconds waiting for valid X cookies.`)
  } finally {
    if (!keepBrowser && !wasActive) {
      stopService(AUTH_BROWSER_SERVICE)
    }
  }
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown X cookie ensure failure'
  console.error(`ensure-x-cookies failed: ${reason}`)
  process.exitCode = 1
})
