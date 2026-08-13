import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  readXCookiePairFromCache,
  writeXCookiePairToCache,
  type XCookiePair,
} from './x-cookie-store'

const directories: string[] = []
const pair: XCookiePair = {
  ct0: 'ct0-value-long-enough',
  authToken: 'auth-token-long-enough',
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('X cookie cache', () => {
  it('persists a protected local fallback for unattended refreshes', () => {
    const directory = mkdtempSync(join(tmpdir(), 'x-cookie-cache-'))
    directories.push(directory)
    const cachePath = join(directory, 'nested/x-cookies.json')

    writeXCookiePairToCache(pair, { cachePath })

    expect(readXCookiePairFromCache({ cachePath })).toEqual(pair)
    expect(statSync(cachePath).mode & 0o777).toBe(0o600)
  })
})
