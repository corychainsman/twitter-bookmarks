import { fetchBookmarkFolders } from 'fieldtheory/dist/graphql-bookmarks.js'

import { readXCookiePairFromOnePassword, xCookieHeader } from './x-cookie-store'

async function main() {
  const pair = readXCookiePairFromOnePassword()
  if (!pair) {
    throw new Error('No stored X cookies found in 1Password.')
  }

  const folders = await fetchBookmarkFolders(pair.ct0, xCookieHeader(pair))
  console.log(`X cookies are valid. Found ${folders.length} bookmark folders.`)
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown validation failure'
  console.error(`check-x-cookies failed: ${reason}`)
  process.exitCode = 1
})
