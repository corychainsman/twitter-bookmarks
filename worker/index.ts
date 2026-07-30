import {
  escapeHtmlAttribute,
  renderSocialMetadataTags,
  sanitizeSocialMetadata,
  type SocialMetadata,
} from "./social-metadata"
import {
  getCatalogSocialMetadata,
  handleCatalogApi,
  type CatalogFetcher,
} from "./production-catalog"

interface Env {
  API_ORIGIN?: string
  DATA_ORIGIN?: string
  USE_LOCAL_DATA?: string
  ASSETS: Fetcher
}

function catalogSource(request: Request, env: Env): {
  origin: string
  fetcher?: CatalogFetcher
} | undefined {
  if (env.USE_LOCAL_DATA === "true") {
    return {
      origin: new URL("/data/", request.url).toString(),
      fetcher: (assetRequest) => env.ASSETS.fetch(assetRequest),
    }
  }
  return env.DATA_ORIGIN ? { origin: env.DATA_ORIGIN } : undefined
}

const API_TIMEOUT_MS = 15_000
const SOCIAL_METADATA_TIMEOUT_MS = 2_500
const MAX_SOCIAL_METADATA_BYTES = 64 * 1_024

const FALLBACK_SOCIAL_METADATA: SocialMetadata = {
  title: "X Inspo",
  description: "Open this media in the discovery wall.",
  imageUrl: "https://assets.ui.sh/wallpapers/horizon.webp?variant=jade-corner",
}

const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]

function jsonError(status: number, code: string, requestId: string, headOnly = false) {
  const body = JSON.stringify({ error: { code, requestId } })
  return new Response(headOnly ? null : body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      "x-request-id": requestId,
    },
  })
}

function resolveUpstreamUrl(pathname: string, search: string, apiOrigin: string) {
  const upstream = new URL(apiOrigin)
  if (upstream.protocol !== "https:" && upstream.protocol !== "http:") {
    throw new Error("API_ORIGIN must be an HTTP URL")
  }

  const basePath = upstream.pathname.replace(/\/$/, "")
  upstream.pathname = `${basePath}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
  upstream.search = search
  upstream.hash = ""
  return upstream
}

function resolveApiUrl(requestUrl: URL, apiOrigin: string) {
  return resolveUpstreamUrl(requestUrl.pathname.slice("/api".length) || "/", requestUrl.search, apiOrigin)
}

async function proxyApi(request: Request, env: Env) {
  const requestId = crypto.randomUUID()
  const incoming = new URL(request.url)
  let upstream: URL

  try {
    if (!env.API_ORIGIN) throw new Error("API_ORIGIN is not configured")
    upstream = resolveApiUrl(incoming, env.API_ORIGIN)
  } catch {
    return jsonError(500, "proxy_misconfigured", requestId, request.method === "HEAD")
  }

  const headers = new Headers(request.headers)
  headers.delete("cookie")
  headers.delete("host")
  for (const header of HOP_BY_HOP_HEADERS) headers.delete(header)
  const clientIp = headers.get("cf-connecting-ip")
  headers.delete("x-forwarded-for")
  headers.delete("x-real-ip")
  if (clientIp) {
    headers.set("x-forwarded-for", clientIp)
    headers.set("x-real-ip", clientIp)
  }
  headers.set("x-request-id", requestId)
  headers.set("x-forwarded-host", incoming.host)
  headers.set("x-forwarded-proto", incoming.protocol.slice(0, -1))

  try {
    const upstreamRequest = new Request(upstream, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })
    const response = await fetch(upstreamRequest)
    const responseHeaders = new Headers(response.headers)
    for (const header of HOP_BY_HOP_HEADERS) responseHeaders.delete(header)

    const location = responseHeaders.get("location")
    if (location) {
      try {
        const redirectUrl = new URL(location, upstream)
        if (redirectUrl.origin === upstream.origin) {
          const basePath = new URL(env.API_ORIGIN ?? upstream.origin).pathname.replace(/\/$/, "")
          const redirectPath =
            basePath && redirectUrl.pathname.startsWith(`${basePath}/`)
              ? redirectUrl.pathname.slice(basePath.length)
              : redirectUrl.pathname
          responseHeaders.set(
            "location",
            new URL(`/api${redirectPath}${redirectUrl.search}`, incoming.origin).toString(),
          )
        }
      } catch {
        responseHeaders.delete("location")
      }
    }

    responseHeaders.set("x-request-id", requestId)
    responseHeaders.set("x-content-type-options", "nosniff")

    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError"
    return jsonError(timedOut ? 504 : 502, timedOut ? "upstream_timeout" : "upstream_unavailable", requestId)
  }
}

async function readSocialMetadata(mediaId: string, request: Request, env: Env) {
  try {
    const catalog = catalogSource(request, env)
    if (catalog) return getCatalogSocialMetadata(catalog.origin, mediaId, catalog.fetcher)
    if (!env.API_ORIGIN) return undefined
    if (new URL(env.API_ORIGIN).hostname.endsWith(".invalid")) return undefined
    const socialUrl = resolveUpstreamUrl(`/media/${encodeURIComponent(mediaId)}/social`, "", env.API_ORIGIN)
    const response = await fetch(socialUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(SOCIAL_METADATA_TIMEOUT_MS),
    })
    if (!response.ok) return undefined
    const declaredLength = Number(response.headers.get("content-length"))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_SOCIAL_METADATA_BYTES) return undefined

    const payload = await response.text()
    if (new TextEncoder().encode(payload).byteLength > MAX_SOCIAL_METADATA_BYTES) return undefined
    return sanitizeSocialMetadata(JSON.parse(payload) as unknown)
  } catch {
    return undefined
  }
}

class HeadMetadataHandler implements HTMLRewriterElementContentHandlers {
  constructor(private readonly tags: string) {}

  element(element: Element) {
    element.append(this.tags, { html: true })
  }
}

class ContentAttributeHandler implements HTMLRewriterElementContentHandlers {
  constructor(private readonly content: string) {}

  element(element: Element) {
    element.setAttribute("content", this.content)
  }
}

class TitleHandler implements HTMLRewriterElementContentHandlers {
  constructor(private readonly title: string) {}

  element(element: Element) {
    element.setInnerContent(this.title)
  }
}

function decodeMediaId(pathSegment: string) {
  try {
    const mediaId = decodeURIComponent(pathSegment)
    const hasForbiddenCharacter = Array.from(mediaId).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint <= 31 || codePoint === 127 || character === "/"
    })
    if (!mediaId || mediaId.length > 256 || hasForbiddenCharacter) return undefined
    return mediaId
  } catch {
    return undefined
  }
}

function socialFallbackHtml(metadata: SocialMetadata, tags: string) {
  const title = escapeHtmlAttribute(metadata.title)
  const description = escapeHtmlAttribute(metadata.description)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="description" content="${description}"><title>${title}</title>${tags}</head><body><main><h1>${title}</h1><p>${description}</p></main></body></html>`
}

async function renderSocialShell(request: Request, env: Env, mediaId: string) {
  const requestUrl = new URL(request.url)
  const allowsViteBootstrap = requestUrl.port.length > 0
  const canonicalUrl = new URL(`/media/${encodeURIComponent(mediaId)}`, requestUrl.origin).toString()
  const metadata = (await readSocialMetadata(mediaId, request, env)) ?? FALLBACK_SOCIAL_METADATA
  const tags = renderSocialMetadataTags(metadata, canonicalUrl)

  let shell: Response | undefined
  try {
    shell = await env.ASSETS.fetch(
      new Request(new URL("/index.html", requestUrl), {
        headers: { accept: "text/html" },
      }),
    )
  } catch {
    shell = undefined
  }

  let response: Response
  if (shell?.ok && shell.headers.get("content-type")?.includes("text/html")) {
    response = new HTMLRewriter()
      .on("head", new HeadMetadataHandler(tags))
      .on("title", new TitleHandler(metadata.title))
      .on('meta[name="description"]', new ContentAttributeHandler(metadata.description))
      .on('meta[name="robots"]', new ContentAttributeHandler("noindex,nofollow"))
      .transform(shell)
  } else {
    response = new Response(socialFallbackHtml(metadata, tags), {
      headers: { "content-type": "text/html; charset=utf-8" },
    })
  }

  const headers = new Headers(response.headers)
  headers.set("cache-control", "public, max-age=60, stale-while-revalidate=300")
  headers.set(
    "content-security-policy",
    `default-src 'self'; img-src 'self' https: data:; media-src 'self' https:; script-src 'self'${allowsViteBootstrap ? " 'unsafe-inline'" : ""}; style-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'`,
  )
  headers.set("referrer-policy", "strict-origin-when-cross-origin")
  headers.set("x-content-type-options", "nosniff")
  headers.set("x-frame-options", "DENY")
  headers.set("x-robots-tag", "noindex, nofollow")

  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const catalog = catalogSource(request, env)
      if (catalog) return handleCatalogApi(request, catalog.origin, catalog.fetcher)
      return proxyApi(request, env)
    }

    const mediaMatch = url.pathname.match(/^\/media\/([^/]+)\/?$/)
    if (mediaMatch) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } })
      }

      const mediaId = decodeMediaId(mediaMatch[1] ?? "")
      if (!mediaId) return new Response("Invalid media id", { status: 400 })
      return renderSocialShell(request, env, mediaId)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
