import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

import type { GridItem, ImageRendition, Manifest, TweetDoc } from './catalog/model'
import type { EmbeddingIndex } from './catalog/embedding-artifacts'
import {
  BOOKMARKS_EMBEDDING_DIMENSIONS,
  BOOKMARKS_EMBEDDING_INDEX_VERSION,
  BOOKMARKS_EMBEDDING_MODEL_ID,
} from './catalog/embedding-config'

const projectRoot = process.cwd()
const outputDirectory = path.join(projectRoot, 'public/data')

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function main() {
  const manifestPath = path.join(outputDirectory, 'manifest.json')
  const manifest = await readJson<Manifest>(manifestPath)

  const [
    docs,
    gridOne,
    gridAll,
    bookmarkedOrder,
    postedOrder,
    searchIndex,
    searchStore,
  ] = await Promise.all([
    Promise.all(
      manifest.files.docs.map((fileName) => readJson<TweetDoc[]>(path.join(outputDirectory, fileName))),
    ),
    readJson<GridItem[]>(path.join(outputDirectory, manifest.files.gridOne)),
    readJson<GridItem[]>(path.join(outputDirectory, manifest.files.gridAll)),
    readJson<string[]>(path.join(outputDirectory, manifest.files.orderBookmarked)),
    readJson<string[]>(path.join(outputDirectory, manifest.files.orderPosted)),
    readJson<unknown>(path.join(outputDirectory, manifest.files.searchIndex)),
    readJson<unknown[]>(path.join(outputDirectory, manifest.files.searchStore)),
  ])

  for (const fileName of [
    ...manifest.files.docs,
    manifest.files.gridOne,
    manifest.files.gridAll,
    ...(manifest.files.gridFirst ? [manifest.files.gridFirst] : []),
    manifest.files.orderBookmarked,
    manifest.files.orderPosted,
    manifest.files.searchIndex,
    manifest.files.searchStore,
    ...(manifest.files.embeddings ? [manifest.files.embeddings] : []),
  ]) {
    await access(path.join(outputDirectory, fileName))
  }

  const flattenedDocs = docs.flat()

  if (manifest.files.embeddings) {
    const embeddings = await readJson<EmbeddingIndex>(
      path.join(outputDirectory, manifest.files.embeddings),
    )
    assert.equal(embeddings.version, BOOKMARKS_EMBEDDING_INDEX_VERSION, 'embedding version mismatch')
    assert.equal(embeddings.buildId, manifest.buildId, 'embedding buildId mismatch')
    assert.equal(embeddings.model.id, BOOKMARKS_EMBEDDING_MODEL_ID, 'embedding model mismatch')
    assert.equal(
      embeddings.model.dimensions,
      BOOKMARKS_EMBEDDING_DIMENSIONS,
      'embedding dimension mismatch',
    )
    assert.equal(embeddings.records.length, manifest.tweetCount, 'embedding record count mismatch')
    assert.equal(
      Buffer.from(embeddings.vectors, 'base64').byteLength,
      embeddings.records.length * BOOKMARKS_EMBEDDING_DIMENSIONS,
      'embedding vector payload length mismatch',
    )
  }

  if (manifest.mediaCatalogVersion === 1 || manifest.mediaCatalogVersion === 2) {
    const mediaBaseUrl = assertNonEmptyString(manifest.mediaBaseUrl, 'mediaBaseUrl')
    if (manifest.mediaCatalogVersion === 2) {
      assertNonEmptyString(manifest.mediaCatalogGeneration, 'mediaCatalogGeneration')
    }
    const assertRenditions = (renditions: ImageRendition[] | undefined, label: string) => {
      assert.ok(renditions?.length, `${label} has no published image renditions`)
      let previousWidth = 0
      const widths = new Set<number>()
      for (const rendition of renditions) {
        assert.equal(rendition.contentType, 'image/avif', `${label} has an invalid rendition type`)
        assert.ok(rendition.url.startsWith(`${mediaBaseUrl}/`), `${label} rendition is off mirror`)
        assert.ok(rendition.width > previousWidth, `${label} renditions are not width-sorted`)
        assert.ok(!widths.has(rendition.width), `${label} has a duplicate rendition width`)
        if (manifest.mediaCatalogVersion === 2) {
          assert.ok(rendition.height && rendition.height > 0, `${label} rendition has no height`)
          assert.ok(rendition.bytes && rendition.bytes > 0, `${label} rendition has no byte size`)
          assert.match(rendition.digest ?? '', /^[a-f0-9]{64}$/, `${label} rendition has no digest`)
          assert.ok(
            rendition.url.includes(rendition.digest!.slice(0, 16)),
            `${label} rendition URL is not content-addressed`,
          )
        }
        widths.add(rendition.width)
        previousWidth = rendition.width
      }
    }

    const docMediaByGridId = new Map<string, TweetDoc['media'][number]>()
    for (const doc of flattenedDocs) {
      doc.media.forEach((media, mediaIndex) => {
        docMediaByGridId.set(`${doc.id}:${mediaIndex}`, media)
        const imageUrl = media.type === 'photo' ? media.fullUrl : media.posterUrl ?? media.thumbUrl
        if (imageUrl.startsWith(`${mediaBaseUrl}/`)) {
          assertRenditions(media.imageRenditions, `${doc.id}:${mediaIndex}`)
        }
      })
    }

    for (const item of gridAll) {
      const imageUrl = item.mediaType === 'photo' ? item.thumbUrl : item.posterUrl ?? item.thumbUrl
      if (!imageUrl.startsWith(`${mediaBaseUrl}/`)) continue
      assertRenditions(item.imageRenditions, item.gridId)
      assert.deepEqual(
        item.imageRenditions,
        docMediaByGridId.get(item.gridId)?.imageRenditions,
        `${item.gridId} grid/doc rendition catalogs differ`,
      )
    }
  }

  assert.equal(flattenedDocs.length, manifest.tweetCount, 'tweetCount mismatch')
  assert.equal(gridOne.length, manifest.gridItemCountOne, 'grid one count mismatch')
  assert.equal(gridAll.length, manifest.gridItemCountAll, 'grid all count mismatch')
  assert.equal(bookmarkedOrder.length, manifest.tweetCount, 'bookmark order count mismatch')
  assert.equal(postedOrder.length, manifest.tweetCount, 'posted order count mismatch')
  assert.ok(searchIndex, 'search index missing')
  assert.ok(searchStore.length >= manifest.tweetCount, 'search store unexpectedly small')
  assert.ok(
    flattenedDocs.every((doc) => doc.media.length > 0),
    'found a non-media tweet in the exported docs',
  )

  const mediaUrls = flattenedDocs.flatMap((doc) =>
    doc.media.flatMap((media) => [media.thumbUrl, media.fullUrl, media.posterUrl ?? '']),
  )
  const presentUrls = mediaUrls.filter((url) => url.length > 0)
  const twimgUrls = presentUrls.filter((url) => url.includes('.twimg.com'))
  const coverage = presentUrls.length - twimgUrls.length
  if (manifest.mediaCatalogVersion === 2) {
    assert.equal(twimgUrls.length, 0, 'media catalog v2 cannot publish runtime twimg fallbacks')
  }

  console.log(
    `Validated export: ${manifest.tweetCount} tweets, ${manifest.gridItemCountAll} media tiles.`,
  )
  console.log(
    `Mirror coverage: ${coverage}/${presentUrls.length} media URLs self-hosted` +
      (twimgUrls.length > 0 ? ` (${twimgUrls.length} still on twimg.com).` : '.'),
  )
}

function assertNonEmptyString(value: string | undefined, label: string): string {
  assert.ok(value, `${label} missing`)
  return value
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown validation failure'
  console.error(`validate-export failed: ${reason}`)
  process.exitCode = 1
})
