import { spawnSync } from 'node:child_process'

import { buildFieldTheoryFolderArgs, FIELDTHEORY_FOLDER_NAME } from './fieldtheory'

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

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    const next = argv[index + 1]

    if (value === '--rebuild' || value === '--continue' || value === '--gaps') {
      continue
    }

    if (value === '--folders') {
      continue
    }

    if (value === '--folder') {
      if (next && next !== FIELDTHEORY_FOLDER_NAME) {
        throw new Error(`Only the "${FIELDTHEORY_FOLDER_NAME}" folder is supported.`)
      }
      if (next) {
        index += 1
      }
      continue
    }

    passthroughArgs.push(value)
  }

  runStep('Field Theory folder sync', [...buildFieldTheoryFolderArgs(), ...passthroughArgs])
}

try {
  main()
} catch (error) {
  const reason = error instanceof Error ? error.message : 'Unknown sync failure'
  console.error(`sync-fieldtheory failed: ${reason}`)
  process.exitCode = 1
}
