import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_VAULT = 'Clawdbot'
const DEFAULT_ITEM_TITLE = 'X Cookies - corychainsman'

export type XCookiePair = {
  ct0: string
  authToken: string
}

export type XCookieStoreOptions = {
  vault?: string
  itemTitle?: string
}

type OnePasswordField = {
  id: string
  label?: string
  purpose?: string
  type?: string
  value?: string
}

type OnePasswordItem = {
  title: string
  category: string
  fields: OnePasswordField[]
  tags?: string[]
}

function optionValue(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

export function xCookieStoreConfig(options: XCookieStoreOptions = {}) {
  return {
    vault: optionValue(options.vault ?? process.env.X_COOKIE_OP_VAULT, DEFAULT_VAULT),
    itemTitle: optionValue(
      options.itemTitle ?? process.env.X_COOKIE_OP_ITEM,
      DEFAULT_ITEM_TITLE,
    ),
  }
}

function runOp(args: string[], input?: string): string | undefined {
  const result = spawnSync('op', args, {
    encoding: 'utf8',
    input,
    maxBuffer: 1024 * 1024 * 8,
  })

  if (result.status !== 0) {
    return undefined
  }

  return result.stdout
}

function withTemplate<T>(contents: string, callback: (path: string) => T): T {
  const directory = mkdtempSync(join(tmpdir(), 'x-cookie-op-'))
  const path = join(directory, 'item.json')

  try {
    writeFileSync(path, contents, { mode: 0o600 })
    return callback(path)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function normalizeCookieValue(value: string): string {
  return value.trim().replace(/^"|"$/g, '')
}

export function extractXCookiePair(input: string): XCookiePair {
  const values = new Map<string, string>()
  const trimmed = input.trim()

  if (!trimmed) {
    throw new Error('Paste a cookie header or ct0/auth_token values.')
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    const records = Array.isArray(parsed) ? parsed : [parsed]

    for (const record of records) {
      if (!record || typeof record !== 'object') {
        continue
      }

      const name = 'name' in record ? String(record.name) : undefined
      const value = 'value' in record ? String(record.value) : undefined

      if (name && value && (name === 'ct0' || name === 'auth_token')) {
        values.set(name, normalizeCookieValue(value))
      }
    }
  } catch {
    // Not JSON. Fall through to permissive text parsing.
  }

  const pairPattern = /(?:^|[\s;,\n\r])([A-Za-z0-9_]+)\s*=\s*("?[^";,\n\r]+"?)/g
  for (const match of trimmed.matchAll(pairPattern)) {
    const [, key, value] = match
    if (key === 'ct0' || key === 'auth_token') {
      values.set(key, normalizeCookieValue(value))
    }
  }

  const lines = trimmed.split(/\r?\n/)
  for (const line of lines) {
    const columns = line.trim().split(/\s+/)
    if (columns.length >= 7) {
      const [name, value] = columns.slice(-2)
      if (name === 'ct0' || name === 'auth_token') {
        values.set(name, normalizeCookieValue(value))
      }
    }
  }

  const ct0 = values.get('ct0')
  const authToken = values.get('auth_token')

  if (!ct0 || !authToken) {
    throw new Error('Could not find both ct0 and auth_token.')
  }

  if (ct0.length < 16) {
    throw new Error('ct0 looks too short.')
  }

  if (authToken.length < 16) {
    throw new Error('auth_token looks too short.')
  }

  return { ct0, authToken }
}

function cookieItem(pair: XCookiePair, title: string): OnePasswordItem {
  return {
    title,
    category: 'API_CREDENTIAL',
    tags: ['twitter-bookmarks', 'x-cookies'],
    fields: [
      {
        id: 'notesPlain',
        type: 'STRING',
        purpose: 'NOTES',
        label: 'notesPlain',
        value:
          'X cookies for twitter-bookmarks Field Theory sync. Replace when X expires the session.',
      },
      { id: 'ct0', type: 'CONCEALED', label: 'ct0', value: pair.ct0 },
      {
        id: 'auth_token',
        type: 'CONCEALED',
        label: 'auth_token',
        value: pair.authToken,
      },
      {
        id: 'updated_at',
        type: 'STRING',
        label: 'updated_at',
        value: new Date().toISOString(),
      },
    ],
  }
}

function findField(item: OnePasswordItem, label: string): string | undefined {
  return item.fields.find((field) => field.label === label || field.id === label)?.value
}

export function readXCookiePairFromOnePassword(
  options: XCookieStoreOptions = {},
): XCookiePair | undefined {
  const { vault, itemTitle } = xCookieStoreConfig(options)
  const output = runOp(['item', 'get', itemTitle, '--vault', vault, '--format', 'json'])
  if (!output) {
    return undefined
  }

  const item = JSON.parse(output) as OnePasswordItem
  const ct0 = findField(item, 'ct0')
  const authToken = findField(item, 'auth_token')

  if (!ct0 || !authToken) {
    return undefined
  }

  return { ct0, authToken }
}

export function writeXCookiePairToOnePassword(
  pair: XCookiePair,
  options: XCookieStoreOptions = {},
): { vault: string; itemTitle: string; created: boolean } {
  const { vault, itemTitle } = xCookieStoreConfig(options)
  const existing = runOp(['item', 'get', itemTitle, '--vault', vault, '--format', 'json'])
  const template = JSON.stringify(cookieItem(pair, itemTitle))

  if (!existing) {
    const created = withTemplate(template, (path) =>
      runOp(['item', 'create', '--vault', vault, '--template', path]),
    )
    if (!created) {
      throw new Error(`Could not create 1Password item "${itemTitle}" in vault "${vault}".`)
    }

    return { vault, itemTitle, created: true }
  }

  const updated = withTemplate(template, (path) =>
    runOp(['item', 'edit', itemTitle, '--vault', vault, '--template', path]),
  )
  if (!updated) {
    throw new Error(`Could not update 1Password item "${itemTitle}" in vault "${vault}".`)
  }

  return { vault, itemTitle, created: false }
}

export function xCookieHeader(pair: XCookiePair): string {
  return `ct0=${pair.ct0}; auth_token=${pair.authToken}`
}
