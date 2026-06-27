import { readXBrowserCookies } from './x-auth-cdp'
import { writeXCookiePairToOnePassword } from './x-cookie-store'

async function main() {
  const pair = await readXBrowserCookies()
  if (!pair) {
    console.log('X auth cookies not found yet.')
    return
  }

  const result = writeXCookiePairToOnePassword(pair)
  const verb = result.created ? 'Created' : 'Updated'
  console.log(`${verb} "${result.itemTitle}" in the "${result.vault}" vault from browser cookies.`)
}

if (import.meta.main) {
  main().catch((error) => {
    const reason = error instanceof Error ? error.message : 'Unknown CDP cookie sync failure'
    console.error(`store-x-cookies-from-cdp failed: ${reason}`)
    process.exitCode = 1
  })
}
