import { readStoredXCredentials, validateXCredentials } from './x-credentials'

async function main() {
  const validation = await validateXCredentials(readStoredXCredentials())
  if (!validation.ok) {
    throw new Error(validation.message)
  }

  console.log(validation.message)
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown validation failure'
  console.error(`check-x-cookies failed: ${reason}`)
  process.exitCode = 1
})
