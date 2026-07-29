import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { buildRefreshPipeline, preflightRefreshPipeline, runRefreshPipeline } from './refresh-pipeline'
import {
  bookmarkSnapshotChanged,
  readBookmarkSnapshot,
  readRefreshState,
  shouldRunFullReconciliation,
  writeRefreshState,
  type RefreshState,
} from './refresh-state'

const projectRoot = process.cwd()
const STAGING_ORIGIN = 'https://dev.bookmarks.corychainsman.com'
const PRODUCTION_ORIGIN = 'https://bookmarks.corychainsman.com'

type CatalogManifest = {
  buildId: string
  tweetCount: number
}

type Options = {
  deployCurrent: boolean
  forceFull: boolean
}

function parseOptions(argv: string[]): Options {
  const options: Options = { deployCurrent: false, forceFull: false }

  for (const arg of argv) {
    if (arg === '--deploy-current') {
      options.deployCurrent = true
      continue
    }
    if (arg === '--full') {
      options.forceFull = true
      continue
    }
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: bun run scripts/refresh-production.ts [--full] [--deploy-current]')
      process.exit(0)
    }
    throw new Error(`Unknown production refresh option: ${arg}`)
  }

  return options
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`)
  }
}

function runPackageScript(packageScript: string): void {
  const bunExecutable = process.release?.name === 'bun' ? process.execPath : 'bun'
  run(bunExecutable, ['run', packageScript])
}

async function readLocalManifest(): Promise<CatalogManifest> {
  return JSON.parse(
    await readFile(path.join(projectRoot, 'public/data/manifest.json'), 'utf8'),
  ) as CatalogManifest
}

async function verifyDeployment(origin: string, manifest: CatalogManifest): Promise<void> {
  const cacheToken = encodeURIComponent(`${manifest.buildId}-${Date.now()}`)
  const manifestResponse = await fetch(
    `${origin}/data/manifest.json?refresh=${cacheToken}`,
    { cache: 'no-store', signal: AbortSignal.timeout(15_000) },
  )
  if (!manifestResponse.ok) {
    throw new Error(`${origin} manifest check returned ${manifestResponse.status}`)
  }

  const deployed = await manifestResponse.json() as CatalogManifest
  if (deployed.buildId !== manifest.buildId || deployed.tweetCount !== manifest.tweetCount) {
    throw new Error(
      `${origin} served catalog ${deployed.buildId}/${deployed.tweetCount}; expected ${manifest.buildId}/${manifest.tweetCount}`,
    )
  }

  const apiResponse = await fetch(
    `${origin}/api/discovery?sort=newest&refresh=${cacheToken}`,
    { cache: 'no-store', signal: AbortSignal.timeout(15_000) },
  )
  if (!apiResponse.ok) {
    throw new Error(`${origin} discovery smoke check returned ${apiResponse.status}`)
  }
}

function commitAndPushCheckpoint(timestamp: string): void {
  const trackedPaths = ['ops/refresh-state.json', 'public/data']
  run('git', ['add', '--', ...trackedPaths])

  const staged = spawnSync('git', ['diff', '--cached', '--quiet', '--', ...trackedPaths], {
    cwd: projectRoot,
    stdio: 'ignore',
  })
  if (staged.status === 0) return
  if (staged.status !== 1) throw new Error('Could not inspect the staged refresh checkpoint')

  run('git', [
    'commit',
    '--only',
    '-m',
    `Refresh production bookmarks ${timestamp}`,
    '--',
    ...trackedPaths,
  ])
  run('git', ['push', 'origin', 'HEAD'])
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  // A prior deployment may have succeeded while its final GitHub push failed.
  // Publish that checkpoint before deciding whether the current X token is new.
  run('git', ['push', 'origin', 'HEAD'])
  const previousState = await readRefreshState()
  const beforeSnapshot = await readBookmarkSnapshot(previousState?.newestBookmarkId)
  const runFull = options.forceFull || shouldRunFullReconciliation(
    previousState,
    beforeSnapshot,
  )

  if (!options.deployCurrent) {
    const plannedPipeline = buildRefreshPipeline(runFull ? 'full' : 'default')
    const preflight = preflightRefreshPipeline(plannedPipeline)
    if (!preflight.ok) {
      throw new Error(`Refresh preflight failed:\n${preflight.messages.join('\n')}`)
    }

    runPackageScript(runFull ? 'sync:ft:full' : 'sync:ft')
    const syncedSnapshot = await readBookmarkSnapshot(previousState?.newestBookmarkId)
    if (!runFull && !bookmarkSnapshotChanged(previousState, syncedSnapshot)) {
      console.log(
        `No bookmarks newer than GitHub checkpoint ${previousState?.newestBookmarkId}; publication skipped.`,
      )
      return
    }

    runRefreshPipeline('publish')
  }

  const snapshot = await readBookmarkSnapshot(previousState?.newestBookmarkId)
  const manifest = await readLocalManifest()

  runPackageScript('deploy:cf:staging')
  await verifyDeployment(STAGING_ORIGIN, manifest)
  runPackageScript('deploy:cf:production')
  await verifyDeployment(PRODUCTION_ORIGIN, manifest)

  const completedAt = new Date().toISOString()
  const nextState: RefreshState = {
    schemaVersion: 1,
    newestBookmarkId: snapshot.newestBookmarkId,
    bookmarkCount: snapshot.bookmarkCount,
    lastSuccessfulAt: completedAt,
    lastFullReconciliationAt: runFull
      ? completedAt
      : previousState?.lastFullReconciliationAt ?? completedAt,
    catalogBuildId: manifest.buildId,
  }
  await writeRefreshState(nextState)
  commitAndPushCheckpoint(completedAt)

  console.log(
    `Production refresh complete: ${snapshot.bookmarkCount} bookmarks, checkpoint ${snapshot.newestBookmarkId}.`,
  )
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown production refresh failure'
  console.error(`production refresh failed: ${reason}`)
  process.exitCode = 1
})
