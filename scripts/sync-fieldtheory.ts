import { spawnSync } from 'node:child_process'

import { buildFieldTheoryFolderArgs, FIELDTHEORY_FOLDER_SUBSTRING } from './fieldtheory'

function runStep(label: string, args: string[]): void {
  const bunExecutable = process.release?.name === 'bun' ? process.execPath : 'bun'
  const result = spawnSync(bunExecutable, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`)
  }
}

function main() {
  const argv = process.argv.slice(2)
  const passthroughArgs: string[] = []
  let full = false

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    const next = argv[index + 1]

    if (value === '--rebuild') {
      full = true
      continue
    }

    if (value === '--continue' || value === '--gaps') {
      continue
    }

    if (value === '--folders') {
      continue
    }

    if (value === '--folder-contains') {
      if (next && next.toLowerCase() !== FIELDTHEORY_FOLDER_SUBSTRING) {
        throw new Error(`Only folders containing "${FIELDTHEORY_FOLDER_SUBSTRING}" are supported.`)
      }
      if (next) {
        index += 1
      }
      continue
    }

    passthroughArgs.push(value)
  }

  runStep('Field Theory folder sync', [
    ...buildFieldTheoryFolderArgs({ full }),
    ...passthroughArgs,
  ])
}

try {
  main()
} catch (error) {
  const reason = error instanceof Error ? error.message : 'Unknown sync failure'
  console.error(`sync-fieldtheory failed: ${reason}`)
  process.exitCode = 1
}
