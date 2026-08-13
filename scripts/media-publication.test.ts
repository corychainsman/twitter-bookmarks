import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assertVerifiedMediaPublication,
  publishedMediaObjects,
  recordVerifiedMediaPublication,
  verifyMediaPublication,
} from './media-publication'
import type { MirrorManifest } from './mirror-lib'

const manifest: MirrorManifest = {
  version: 1,
  assets: {
    source: {
      status: 'ok',
      kind: 'image',
      key: 'original.jpg',
      bytes: 10,
      contentType: 'image/jpeg',
      variants: [
        {
          key: 'rendition.avif',
          width: 320,
          height: 200,
          bytes: 5,
          contentType: 'image/avif',
          digest: 'abc',
        },
      ],
      attempts: 1,
    },
  },
}

describe('verified media publication', () => {
  it('collects every catalog-addressable object', () => {
    expect(publishedMediaObjects(manifest)).toEqual([
      { key: 'original.jpg', bytes: 10, contentType: 'image/jpeg' },
      { key: 'rendition.avif', digest: 'abc', bytes: 5, contentType: 'image/avif' },
    ])
  })

  it('rejects a public object whose bytes do not match the catalog', async () => {
    await expect(
      verifyMediaPublication({
        manifest,
        mediaBaseUrl: 'https://media.example.com',
        fetchImpl: async () =>
          new Response(null, {
            status: 200,
            headers: { 'content-length': '9', 'content-type': 'image/jpeg' },
          }),
      }),
    ).rejects.toThrow('content-length')
  })

  it('invalidates the publication attestation when the mirror manifest changes', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'twitter-bookmarks-publication-'))
    const manifestPath = path.join(directory, 'manifest.json')
    const publicationPath = path.join(directory, 'publication.json')
    await writeFile(manifestPath, JSON.stringify(manifest))
    await recordVerifiedMediaPublication({
      manifestPath,
      publicationPath,
      mediaBaseUrl: 'https://media.example.com',
      objectCount: 2,
    })

    await expect(
      assertVerifiedMediaPublication({
        manifestPath,
        publicationPath,
        mediaBaseUrl: 'https://media.example.com',
      }),
    ).resolves.toMatchObject({ objectCount: 2 })

    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`)
    await expect(
      assertVerifiedMediaPublication({
        manifestPath,
        publicationPath,
        mediaBaseUrl: 'https://media.example.com',
      }),
    ).rejects.toThrow('changed after')
  })

  it('records the immutable object keys in a current publication attestation', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'twitter-bookmarks-publication-'))
    const manifestPath = path.join(directory, 'manifest.json')
    const publicationPath = path.join(directory, 'publication.json')
    await writeFile(manifestPath, JSON.stringify(manifest))

    await expect(recordVerifiedMediaPublication({
      manifestPath,
      publicationPath,
      mediaBaseUrl: 'https://media.example.com',
      objectCount: 2,
      objectKeys: ['original.jpg', 'rendition.avif'],
      fullVerifiedAt: '2026-08-12T00:00:00.000Z',
    })).resolves.toMatchObject({
      version: 2,
      objectKeys: ['original.jpg', 'rendition.avif'],
      fullVerifiedAt: '2026-08-12T00:00:00.000Z',
    })
  })
})
