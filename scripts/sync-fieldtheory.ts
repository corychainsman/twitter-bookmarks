import { spawnSync } from 'node:child_process'

import {
  buildFieldTheoryGapArgs,
  buildFieldTheoryTimelineArgs,
  FIELDTHEORY_DELAY_MS,
  FIELDTHEORY_MAX_PAGES,
  type FieldTheorySyncMode,
} from './fieldtheory'

function detectMode(argv: string[]): FieldTheorySyncMode {
  if (argv.includes('--rebuild')) {
    return 'full'
  }

  if (argv.includes('--continue')) {
    return 'resume'
  }

  return 'fresh'
}

function partitionArgs(argv: string[]): {
  ftArgs: string[]
  folderArgs: string[]
} {
  const ftArgs: string[] = []
  const folderArgs: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    const next = argv[index + 1]

    if (value === '--rebuild' || value === '--continue') {
      continue
    }

    if (value === '--folders') {
      continue
    }

    if (value === '--folder') {
      if (next) {
        folderArgs.push(value, next)
        index += 1
      }

      continue
    }

    ftArgs.push(value)
    folderArgs.push(value)
  }

  return { ftArgs, folderArgs }
}

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
  const mode = detectMode(argv)
  const { ftArgs, folderArgs } = partitionArgs(argv)

  runStep('Field Theory timeline sync', [
    'x',
    'ft',
    ...buildFieldTheoryTimelineArgs(mode),
    ...ftArgs,
  ])
  runStep('Field Theory gap fill', ['x', 'ft', ...buildFieldTheoryGapArgs(), ...ftArgs])
  runStep('Field Theory folder sync', [
    'run',
    'scripts/fieldtheory-folder-sync.ts',
    '--max-pages',
    String(FIELDTHEORY_MAX_PAGES),
    '--delay-ms',
    String(FIELDTHEORY_DELAY_MS),
    ...folderArgs,
  ])
}

try {
  main()
} catch (error) {
  const reason = error instanceof Error ? error.message : 'Unknown sync failure'
  console.error(`sync-fieldtheory failed: ${reason}`)
  process.exitCode = 1
}
