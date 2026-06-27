export type XBrowserCookiePair = {
  ct0: string
  authToken: string
}

export type XBrowserState = {
  cookies?: XBrowserCookiePair
  url?: string
  pageText?: string
}

type DevtoolsTarget = {
  type: string
  url: string
  webSocketDebuggerUrl?: string
}

type PendingCall = (message: CdpResponse) => void

type CdpResponse = {
  id?: number
  result?: unknown
}

type CdpCookie = {
  name: string
  value: string
  domain: string
}

type RuntimeEvaluateResult = {
  result?: {
    value?: string
  }
}

function endpoint(): string {
  return process.env.X_AUTH_CHROME_DEVTOOLS ?? 'http://127.0.0.1:9334'
}

async function findXPageTarget(): Promise<DevtoolsTarget | undefined> {
  const targets = (await fetch(`${endpoint()}/json/list`).then((response) =>
    response.json(),
  )) as DevtoolsTarget[]

  return (
    targets.find((target) => target.type === 'page' && target.url.includes('x.com')) ??
    targets.find((target) => target.type === 'page')
  )
}

async function cdpCall<T>(
  websocket: WebSocket,
  pending: Map<number, PendingCall>,
  id: number,
  method: string,
  params: Record<string, unknown> = {},
): Promise<T | undefined> {
  websocket.send(JSON.stringify({ id, method, params }))
  const response = await new Promise<CdpResponse>((resolve) => pending.set(id, resolve))
  return response.result as T | undefined
}

function extractCookiePair(cookies: CdpCookie[]): XBrowserCookiePair | undefined {
  const xCookies = cookies.filter(
    (cookie) => cookie.domain === '.x.com' || cookie.domain === 'x.com',
  )
  const ct0 = xCookies.find((cookie) => cookie.name === 'ct0')?.value
  const authToken = xCookies.find((cookie) => cookie.name === 'auth_token')?.value

  if (!ct0 || !authToken) {
    return undefined
  }

  return { ct0, authToken }
}

export async function readXBrowserState(): Promise<XBrowserState | undefined> {
  const target = await findXPageTarget()
  if (!target?.webSocketDebuggerUrl) {
    return undefined
  }

  const websocket = new WebSocket(target.webSocketDebuggerUrl)
  const pending = new Map<number, PendingCall>()

  websocket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as CdpResponse
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)?.(message)
      pending.delete(message.id)
    }
  })

  await new Promise<void>((resolve, reject) => {
    websocket.addEventListener('open', () => resolve(), { once: true })
    websocket.addEventListener('error', () => reject(new Error('CDP websocket failed')), {
      once: true,
    })
  })

  try {
    const cookieResult = await cdpCall<{ cookies?: CdpCookie[] }>(
      websocket,
      pending,
      1,
      'Network.getAllCookies',
    )
    const textResult = await cdpCall<RuntimeEvaluateResult>(
      websocket,
      pending,
      2,
      'Runtime.evaluate',
      {
        expression: 'document.body ? document.body.innerText : ""',
        returnByValue: true,
      },
    )

    return {
      cookies: extractCookiePair(cookieResult?.cookies ?? []),
      url: target.url,
      pageText: textResult?.result?.value,
    }
  } finally {
    websocket.close()
  }
}

export async function readXBrowserCookies(): Promise<XBrowserCookiePair | undefined> {
  return (await readXBrowserState())?.cookies
}
