export function encodeInt8Base64Url(values: Int8Array): string {
  let binary = ""
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength)
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

export function decodeInt8Base64Url(value: string): Int8Array | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return undefined
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=")
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return new Int8Array(bytes.buffer)
  } catch {
    return undefined
  }
}

export function quantizeNormalizedVector(values: ArrayLike<number>): Int8Array {
  let magnitudeSquared = 0
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? 0
    magnitudeSquared += value * value
  }
  const magnitude = Math.sqrt(magnitudeSquared)
  const result = new Int8Array(values.length)
  if (!Number.isFinite(magnitude) || magnitude === 0) return result

  for (let index = 0; index < values.length; index += 1) {
    const normalized = (values[index] ?? 0) / magnitude
    result[index] = Math.max(-127, Math.min(127, Math.round(normalized * 127)))
  }
  return result
}

