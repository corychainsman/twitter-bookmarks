import path from 'node:path'

import sharp from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'

import {
  mirrorVariantKey,
  mirrorVariantWidths,
  sha256,
  writeFileAtomically,
  type MirrorVariant,
} from './mirror-lib'

export type GeneratedImageRenditions = {
  digest: string
  width: number
  height: number
  thumbhash: string
  variants: MirrorVariant[]
}

function orientedDimensions(metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>) {
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const swapsAxes = metadata.orientation !== undefined && metadata.orientation >= 5
  return swapsAxes ? { width: height, height: width } : { width, height }
}

export function imageRenditionWidths(sourceWidth: number): number[] {
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) return []

  const maximumWidth = Math.min(Math.floor(sourceWidth), Math.max(...mirrorVariantWidths()))
  return [
    ...new Set([
      ...mirrorVariantWidths().filter((width) => width < maximumWidth),
      maximumWidth,
    ]),
  ].sort((left, right) => left - right)
}

export async function generateImageRenditions(input: {
  assetsRoot: string
  buffer: Buffer
  originalKey: string
  requestedWidths?: number[]
}): Promise<GeneratedImageRenditions> {
  const metadata = await sharp(input.buffer).metadata()
  const dimensions = orientedDimensions(metadata)
  if (dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error(`Could not determine image dimensions for ${input.originalKey}`)
  }

  const variants: MirrorVariant[] = []
  const availableWidths = new Set(imageRenditionWidths(dimensions.width))
  const requestedWidths = input.requestedWidths
    ? [...new Set(input.requestedWidths)]
        .filter((width) => availableWidths.has(width))
        .toSorted((left, right) => left - right)
    : [...availableWidths]

  for (const requestedWidth of requestedWidths) {
    const { data, info } = await sharp(input.buffer)
      .rotate()
      .resize({ width: requestedWidth, withoutEnlargement: true })
      .avif({ quality: 60, effort: 2 })
      .toBuffer({ resolveWithObject: true })
    const digest = sha256(data)
    const key = mirrorVariantKey(input.originalKey, info.width, digest)
    await writeFileAtomically(path.join(input.assetsRoot, key), data)
    variants.push({
      key,
      width: info.width,
      height: info.height,
      bytes: data.byteLength,
      contentType: 'image/avif',
      digest,
    })
  }

  const { data: rgba, info } = await sharp(input.buffer)
    .rotate()
    .resize(100, 100, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return {
    digest: sha256(input.buffer),
    width: dimensions.width,
    height: dimensions.height,
    thumbhash: Buffer.from(rgbaToThumbHash(info.width, info.height, rgba)).toString('base64'),
    variants,
  }
}
