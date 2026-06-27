import { spawnSync } from 'node:child_process'

export type RefreshPipelineMode = 'default' | 'resume' | 'full' | 'embeddings'

export type RefreshPipelineStepId =
  | 'sync:ft'
  | 'sync:ft:resume'
  | 'sync:ft:full'
  | 'data:mirror'
  | 'data:video-previews'
  | 'mirror:sync'
  | 'data:export'
  | 'data:embeddings'
  | 'data:validate'
  | 'build'

export type RefreshPipelineStep = {
  id: RefreshPipelineStepId
  label: string
  packageScript: string
}

export type RefreshPreflightResult = {
  ok: boolean
  messages: string[]
}

export type RefreshPipelineRunner = {
  commandExists?: (command: string) => boolean
  listRcloneRemotes?: () => string[]
  runStep?: (step: RefreshPipelineStep) => number
}

const REFRESH_STEP_SEQUENCE: RefreshPipelineStepId[] = [
  'data:mirror',
  'data:video-previews',
  'mirror:sync',
  'data:export',
  'data:embeddings',
  'data:validate',
  'build',
]

const REFRESH_STEPS: Record<RefreshPipelineStepId, RefreshPipelineStep> = {
  'sync:ft': {
    id: 'sync:ft',
    label: 'Field Theory sync',
    packageScript: 'sync:ft',
  },
  'sync:ft:resume': {
    id: 'sync:ft:resume',
    label: 'Field Theory resume sync',
    packageScript: 'sync:ft:resume',
  },
  'sync:ft:full': {
    id: 'sync:ft:full',
    label: 'Field Theory full sync',
    packageScript: 'sync:ft:full',
  },
  'data:mirror': {
    id: 'data:mirror',
    label: 'Media mirror',
    packageScript: 'data:mirror',
  },
  'data:video-previews': {
    id: 'data:video-previews',
    label: 'Video previews',
    packageScript: 'data:video-previews',
  },
  'mirror:sync': {
    id: 'mirror:sync',
    label: 'Remote mirror sync',
    packageScript: 'mirror:sync',
  },
  'data:export': {
    id: 'data:export',
    label: 'Static data export',
    packageScript: 'data:export',
  },
  'data:embeddings': {
    id: 'data:embeddings',
    label: 'Semantic embeddings export',
    packageScript: 'data:embeddings',
  },
  'data:validate': {
    id: 'data:validate',
    label: 'Export validation',
    packageScript: 'data:validate',
  },
  build: {
    id: 'build',
    label: 'Static app build',
    packageScript: 'build',
  },
}

function defaultCommandExists(command: string): boolean {
  return spawnSync('command', ['-v', command], {
    shell: true,
    stdio: 'ignore',
  }).status === 0
}

function defaultListRcloneRemotes(): string[] {
  const result = spawnSync('rclone', ['listremotes'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  })

  if (result.status !== 0) {
    const output = `${result.stdout}${result.stderr}`.trim()
    throw new Error(output || 'rclone listremotes failed')
  }

  return result.stdout
    .split(/\r?\n/)
    .map((remote) => remote.trim())
    .filter(Boolean)
}

function defaultRunStep(step: RefreshPipelineStep): number {
  const bunExecutable = process.release?.name === 'bun' ? process.execPath : 'bun'
  const result = spawnSync(bunExecutable, ['run', step.packageScript], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })

  return result.status ?? 1
}

function syncStepForMode(mode: RefreshPipelineMode): RefreshPipelineStepId {
  if (mode === 'resume') {
    return 'sync:ft:resume'
  }

  if (mode === 'full') {
    return 'sync:ft:full'
  }

  return 'sync:ft'
}

export function buildRefreshPipeline(mode: RefreshPipelineMode = 'default'): RefreshPipelineStep[] {
  return [syncStepForMode(mode), ...REFRESH_STEP_SEQUENCE].map((id) => REFRESH_STEPS[id])
}

export function preflightRefreshPipeline(
  steps: readonly RefreshPipelineStep[],
  runner: RefreshPipelineRunner = {},
): RefreshPreflightResult {
  const messages: string[] = []

  if (!steps.some((step) => step.id === 'mirror:sync')) {
    return { ok: true, messages }
  }

  const commandExists = runner.commandExists ?? defaultCommandExists
  if (!commandExists('rclone')) {
    return {
      ok: false,
      messages: ['rclone is required before mirror:sync can upload media to R2 and Google Drive.'],
    }
  }

  const listRcloneRemotes = runner.listRcloneRemotes ?? defaultListRcloneRemotes
  let remotes: string[]
  try {
    remotes = listRcloneRemotes()
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown rclone failure'
    return { ok: false, messages: [`Could not inspect rclone remotes: ${reason}`] }
  }

  if (!remotes.includes('r2:')) {
    messages.push('Missing rclone remote "r2:" for Cloudflare R2 serving uploads.')
  }

  if (!remotes.includes('gdrive:')) {
    messages.push('Missing rclone remote "gdrive:" for Google Drive media backups.')
  }

  return { ok: messages.length === 0, messages }
}

export function runRefreshPipeline(
  mode: RefreshPipelineMode = 'default',
  runner: RefreshPipelineRunner = {},
): void {
  const steps = buildRefreshPipeline(mode)
  const preflight = preflightRefreshPipeline(steps, runner)

  if (!preflight.ok) {
    throw new Error(`Refresh preflight failed:\n${preflight.messages.join('\n')}`)
  }

  const runStep = runner.runStep ?? defaultRunStep
  for (const step of steps) {
    console.error(`\n==> ${step.label}`)
    const status = runStep(step)
    if (status !== 0) {
      throw new Error(`${step.packageScript} failed with exit code ${status}`)
    }
  }
}
