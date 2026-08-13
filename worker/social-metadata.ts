export interface SocialMetadata {
  title: string
  description: string
  imageUrl: string
  videoUrl?: string
}

const MAX_TITLE_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 300

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function replaceControlCharacters(value: string) {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 31 || codePoint === 127 ? " " : character
  }).join("")
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined

  const normalized = replaceControlCharacters(value).replace(/\s+/g, " ").trim().slice(0, maxLength)

  return normalized || undefined
}

function normalizeHttpUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2_048) return undefined

  try {
    const url = new URL(value)
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined
    if (url.username || url.password) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

export function sanitizeSocialMetadata(value: unknown): SocialMetadata | undefined {
  if (!isRecord(value)) return undefined

  const title = normalizeText(value.title, MAX_TITLE_LENGTH)
  const description = normalizeText(value.description, MAX_DESCRIPTION_LENGTH)
  const imageUrl = normalizeHttpUrl(value.imageUrl)
  const videoUrl = normalizeHttpUrl(value.videoUrl)

  if (!title || !description || !imageUrl) return undefined

  return {
    title,
    description,
    imageUrl,
    ...(videoUrl ? { videoUrl } : {}),
  }
}

export function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

export function renderSocialMetadataTags(metadata: SocialMetadata, canonicalUrl: string) {
  const title = escapeHtmlAttribute(metadata.title)
  const description = escapeHtmlAttribute(metadata.description)
  const image = escapeHtmlAttribute(metadata.imageUrl)
  const canonical = escapeHtmlAttribute(canonicalUrl)
  const video = metadata.videoUrl
    ? [
        `<meta property="og:video" content="${escapeHtmlAttribute(metadata.videoUrl)}">`,
        ...(metadata.videoUrl.startsWith("https:")
          ? [
              `<meta property="og:video:secure_url" content="${escapeHtmlAttribute(metadata.videoUrl)}">`,
            ]
          : []),
      ]
    : []

  return [
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="X Inspo">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:alt" content="${title}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:url" content="${canonical}">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${image}">`,
    `<meta name="twitter:image:alt" content="${title}">`,
    ...video,
  ].join("")
}
