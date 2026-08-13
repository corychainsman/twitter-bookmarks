import { ensureXCredentials } from './x-credentials'

async function main() {
  const validation = await ensureXCredentials()
  console.log(validation.message)
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown X cookie ensure failure'
  console.error(`ensure-x-cookies failed: ${reason}`)
  process.exitCode = 1
})
