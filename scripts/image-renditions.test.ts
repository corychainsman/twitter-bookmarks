import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { generateImageRenditions, imageRenditionWidths } from './image-renditions'
import { sha256 } from './mirror-lib'

describe('image rendition ingestion', () => {
  it('uses a bounded ladder with one truthful largest width', () => {
    expect(imageRenditionWidths(200)).toEqual([200])
    expect(imageRenditionWidths(832)).toEqual([240, 320, 480, 680, 832])
    expect(imageRenditionWidths(3000)).toEqual([240, 320, 480, 680, 1280, 2048])
  })

  it('publishes content-addressed AVIF metadata matching the written bytes', async () => {
    const assetsRoot = await mkdtemp(path.join(os.tmpdir(), 'twitter-bookmarks-renditions-'))
    const buffer = await sharp({
      create: { width: 500, height: 250, channels: 3, background: '#ff3366' },
    })
      .jpeg()
      .toBuffer()

    const generated = await generateImageRenditions({
      assetsRoot,
      buffer,
      originalKey: 'pbs/media/example.jpg',
    })

    expect(generated).toMatchObject({
      digest: sha256(buffer),
      width: 500,
      height: 250,
    })
    expect(generated.variants.map(({ width, height }) => [width, height])).toEqual([
      [240, 120],
      [320, 160],
      [480, 240],
      [500, 250],
    ])

    for (const variant of generated.variants) {
      const written = await readFile(path.join(assetsRoot, variant.key))
      expect(variant.key).toContain(variant.digest!.slice(0, 16))
      expect(variant.bytes).toBe(written.byteLength)
      expect(variant.digest).toBe(sha256(written))
    }
  })

  it('can generate only missing widths during an incremental backfill', async () => {
    const assetsRoot = await mkdtemp(path.join(os.tmpdir(), 'twitter-bookmarks-renditions-'))
    const buffer = await sharp({
      create: { width: 800, height: 400, channels: 3, background: '#3366ff' },
    })
      .jpeg()
      .toBuffer()

    const generated = await generateImageRenditions({
      assetsRoot,
      buffer,
      originalKey: 'pbs/media/incremental.jpg',
      requestedWidths: [240, 480],
    })

    expect(generated.variants.map((variant) => variant.width)).toEqual([240, 480])
  })
})
