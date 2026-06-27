import { describe, expect, it } from 'vitest'

import {
  containsTemporaryLimitText,
  ensureXCredentials,
  resolveFieldTheoryXCredentials,
  storeXBrowserCredentials,
  validateXCredentials,
} from './x-credentials'

describe('x credentials', () => {
  it('uses stored 1Password cookies before browser extraction', () => {
    const credentials = resolveFieldTheoryXCredentials(
      {},
      {
        readStored: () => ({ ct0: 'stored-csrf-token', authToken: 'stored-auth-token' }),
        loadBrowserConfig: () => {
          throw new Error('browser config should not be read')
        },
      },
    )

    expect(credentials).toEqual({
      csrfToken: 'stored-csrf-token',
      cookieHeader: 'ct0=stored-csrf-token; auth_token=stored-auth-token',
    })
  })

  it('falls back to the configured firefox cookie adapter', () => {
    const credentials = resolveFieldTheoryXCredentials(
      { browser: 'work', firefoxProfileDir: '/tmp/firefox' },
      {
        readStored: () => undefined,
        loadBrowserConfig: () => ({
          browser: { cookieBackend: 'firefox' },
          chromeUserDataDir: '/unused',
          chromeProfileDirectory: 'Default',
        }),
        extractFirefox: (profileDir) => ({
          csrfToken: `csrf:${profileDir}`,
          cookieHeader: `cookie:${profileDir}`,
        }),
      },
    )

    expect(credentials).toEqual({
      csrfToken: 'csrf:/tmp/firefox',
      cookieHeader: 'cookie:/tmp/firefox',
    })
  })

  it('validates cookies through the bookmark folder interface', async () => {
    const validation = await validateXCredentials(
      { ct0: 'csrf-token', authToken: 'auth-token' },
      {
        fetchBookmarkFolders: async (csrfToken, cookieHeader) => {
          expect(csrfToken).toBe('csrf-token')
          expect(cookieHeader).toBe('ct0=csrf-token; auth_token=auth-token')
          return [{ id: '1' }, { id: '2' }]
        },
      },
    )

    expect(validation).toEqual({
      ok: true,
      message: 'X cookies are valid. Found 2 bookmark folders.',
    })
  })

  it('detects temporary limit pages before storing browser cookies', async () => {
    await expect(
      ensureXCredentials(
        {
          timeoutMs: 1,
          intervalMs: 1,
          now: () => 0,
          sleep: async () => undefined,
          log: () => undefined,
        },
        {
          readStored: () => undefined,
          fetchBookmarkFolders: async () => {
            throw new Error('expired')
          },
          serviceIsActive: () => true,
          startService: () => undefined,
          stopService: () => undefined,
          readBrowserState: async () => ({
            pageText: 'Your account is temporarily limited. Try again later.',
          }),
        },
      ),
    ).rejects.toThrow('temporary limit/restriction')
  })

  it('stores live browser credentials through the credential module', async () => {
    const result = await storeXBrowserCredentials({
      readBrowserCookies: async () => ({ ct0: 'fresh-csrf', authToken: 'fresh-auth' }),
      writeStored: (pair) => ({
        vault: 'vault',
        itemTitle: `${pair.ct0}:${pair.authToken}`,
        created: false,
      }),
    })

    expect(result).toEqual({
      vault: 'vault',
      itemTitle: 'fresh-csrf:fresh-auth',
      created: false,
    })
  })

  it('recognizes common X temporary restriction copy', () => {
    expect(containsTemporaryLimitText('We temporarily restricted access due to automated behavior.')).toBe(true)
    expect(containsTemporaryLimitText('Welcome to X')).toBe(false)
  })
})
