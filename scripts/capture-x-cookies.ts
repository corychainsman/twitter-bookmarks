import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname } from 'node:path'

import {
  extractXCookiePair,
  writeXCookiePairToOnePassword,
  xCookieStoreConfig,
} from './x-cookie-store'

declare const Bun: {
  serve(options: {
    hostname: string
    port: number
    fetch(request: Request): Response | Promise<Response>
  }): { port: number }
}

const DEFAULT_HOST = '0.0.0.0'
const DEFAULT_PORT = 8787

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function serverHost(): string {
  return envValue('X_COOKIE_CAPTURE_HOST') ?? DEFAULT_HOST
}

function preferredServerPort(): number {
  const value = Number(envValue('X_COOKIE_CAPTURE_PORT') ?? DEFAULT_PORT)
  if (!Number.isFinite(value) || value < 1 || value > 65_535) {
    throw new Error(`Invalid X_COOKIE_CAPTURE_PORT: ${process.env.X_COOKIE_CAPTURE_PORT}`)
  }

  return value
}

function persistentToken(): string {
  const configuredToken = envValue('X_COOKIE_CAPTURE_TOKEN')
  if (configuredToken) {
    return configuredToken
  }

  const tokenPath =
    envValue('X_COOKIE_CAPTURE_TOKEN_FILE') ??
    `${process.env.HOME ?? '.'}/.config/twitter-bookmarks/x-cookie-capture-token`

  if (existsSync(tokenPath)) {
    return readFileSync(tokenPath, 'utf8').trim()
  }

  const nextToken = randomBytes(24).toString('base64url')
  mkdirSync(dirname(tokenPath), { recursive: true, mode: 0o700 })
  writeFileSync(tokenPath, `${nextToken}\n`, { mode: 0o600 })
  chmodSync(tokenPath, 0o600)
  return nextToken
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest()
  const rightHash = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftHash, rightHash)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function requestUrl(request: Request): URL {
  return new URL(request.url)
}

function clientAddresses(port: number, token: string): string[] {
  const candidates = new Set<string>()
  candidates.add(`http://127.0.0.1:${port}/?token=${token}`)

  for (const interfaces of Object.values(networkInterfaces())) {
    for (const address of interfaces ?? []) {
      if (address.family !== 'IPv4' || address.internal) {
        continue
      }

      candidates.add(`http://${address.address}:${port}/?token=${token}`)
    }
  }

  return [...candidates]
}

function page(token: string, message?: { kind: 'success' | 'error'; text: string }): Response {
  const messageHtml = message
    ? `<div class="message ${message.kind}">${escapeHtml(message.text)}</div>`
    : ''

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>X Cookie Capture</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f1419;
      color: #f7f9f9;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 20px;
    }
    main {
      width: min(100%, 560px);
    }
    h1 {
      font-size: 24px;
      line-height: 1.2;
      margin: 0 0 12px;
    }
    p, li {
      color: #cfd9de;
      font-size: 15px;
      line-height: 1.45;
    }
    textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 180px;
      resize: vertical;
      border: 1px solid #536471;
      border-radius: 8px;
      padding: 12px;
      background: #000;
      color: #f7f9f9;
      font: 14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    button {
      width: 100%;
      height: 48px;
      margin-top: 12px;
      border: 0;
      border-radius: 8px;
      background: #1d9bf0;
      color: white;
      font-size: 16px;
      font-weight: 700;
    }
    .message {
      border-radius: 8px;
      padding: 12px;
      margin: 0 0 16px;
      font-weight: 650;
    }
    .success {
      color: #06351d;
      background: #8ef0b4;
    }
    .error {
      color: #3b0a0a;
      background: #ffb3b3;
    }
    code {
      background: #263340;
      border-radius: 4px;
      padding: 1px 4px;
    }
  </style>
</head>
<body>
  <main>
    <h1>Send X Cookies to 1Password</h1>
    ${messageHtml}
    <p>Paste a cookie header, JSON cookie export, or Netscape cookie export containing <code>ct0</code> and <code>auth_token</code>. Values are stored in 1Password and are not shown back.</p>
    <form method="post" action="/capture?token=${escapeHtml(token)}">
      <textarea name="cookies" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ct0=...; auth_token=..."></textarea>
      <button type="submit">Save Cookies</button>
    </form>
    <p>After saving, return to Codex and ask for the refresh again.</p>
  </main>
</body>
</html>`,
    {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  )
}

async function parseForm(request: Request): Promise<string> {
  const formData = await request.formData()
  const value = formData.get('cookies')
  return typeof value === 'string' ? value : ''
}

const host = serverHost()
const port = preferredServerPort()
const token = persistentToken()
const { vault, itemTitle } = xCookieStoreConfig()

function startServer(startPort: number) {
  let lastError: unknown
  const explicitPort = Boolean(envValue('X_COOKIE_CAPTURE_PORT'))

  for (let candidate = startPort; candidate < startPort + 20; candidate += 1) {
    try {
      return Bun.serve({
        hostname: host,
        port: candidate,
        async fetch(request) {
          const url = requestUrl(request)
          const suppliedToken = url.searchParams.get('token') ?? ''

          if (!constantTimeEqual(suppliedToken, token)) {
            return new Response('Not found', { status: 404 })
          }

          if (request.method === 'GET' && url.pathname === '/') {
            return page(token)
          }

          if (request.method === 'POST' && url.pathname === '/capture') {
            try {
              const cookieInput = await parseForm(request)
              const pair = extractXCookiePair(cookieInput)
              const result = writeXCookiePairToOnePassword(pair)
              const verb = result.created ? 'Created' : 'Updated'
              return page(token, {
                kind: 'success',
                text: `${verb} "${result.itemTitle}" in the "${result.vault}" vault.`,
              })
            } catch (error) {
              const reason = error instanceof Error ? error.message : 'Unknown error'
              return page(token, { kind: 'error', text: reason })
            }
          }

          return new Response('Not found', { status: 404 })
        },
      })
    } catch (error) {
      lastError = error
      if (explicitPort) {
        throw error
      }
    }
  }

  throw lastError
}

const server = startServer(port)

console.log(`X cookie capture is running for "${itemTitle}" in vault "${vault}".`)
console.log('Open one of these URLs from your phone:')
for (const url of clientAddresses(server.port, token)) {
  console.log(`  ${url}`)
}
console.log('Press Ctrl-C to stop.')
