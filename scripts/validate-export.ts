import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

import type { Manifest, TweetDoc } from '../src/features/bookmarks/model'

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
    readJson<unknown[]>(path.join(outputDirectory, manifest.files.gridOne)),
    readJson<unknown[]>(path.join(outputDirectory, manifest.files.gridAll)),
    readJson<string[]>(path.join(outputDirectory, manifest.files.orderBookmarked)),
    readJson<string[]>(path.join(outputDirectory, manifest.files.orderPosted)),
    readJson<unknown>(path.join(outputDirectory, manifest.files.searchIndex)),
    readJson<unknown[]>(path.join(outputDirectory, manifest.files.searchStore)),
  ])

  for (const fileName of [
    ...manifest.files.docs,
    manifest.files.gridOne,
    manifest.files.gridAll,
    manifest.files.orderBookmarked,
    manifest.files.orderPosted,
    manifest.files.searchIndex,
    manifest.files.searchStore,
  ]) {
    await access(path.join(outputDirectory, fileName))
  }

  const flattenedDocs = docs.flat()

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

  console.log(
    `Validated export: ${manifest.tweetCount} tweets, ${manifest.gridItemCountAll} media tiles.`,
  )
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown validation failure'
  console.error(`validate-export failed: ${reason}`)
  process.exitCode = 1
})
