import { thumbHashToDataURL } from 'thumbhash'

const dataUrlCache = new Map<string, string | null>()

export function thumbhashToDataUrl(thumbhash: string | undefined): string | null {
  if (!thumbhash) {
    return null
  }

  const cached = dataUrlCache.get(thumbhash)
  if (cached !== undefined) {
    return cached
  }

  let dataUrl: string | null = null
  try {
    const binary = atob(thumbhash)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    dataUrl = thumbHashToDataURL(bytes)
  } catch {
    dataUrl = null
  }

  dataUrlCache.set(thumbhash, dataUrl)
  return dataUrl
}
