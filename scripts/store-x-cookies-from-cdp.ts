import { storeXBrowserCredentials } from './x-credentials'

async function main() {
  const result = await storeXBrowserCredentials()
  if (!result) {
    console.log('X auth cookies not found yet.')
    return
  }

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
