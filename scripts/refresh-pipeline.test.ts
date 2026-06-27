import { describe, expect, it } from 'vitest'

import {
  buildRefreshPipeline,
  preflightRefreshPipeline,
  runRefreshPipeline,
} from './refresh-pipeline'

describe('refresh pipeline', () => {
  it('owns the default refresh ordering', () => {
    expect(buildRefreshPipeline().map((step) => step.packageScript)).toEqual([
      'sync:ft',
      'data:mirror',
      'data:video-previews',
      'mirror:sync',
      'data:export',
      'data:embeddings',
      'data:validate',
      'build',
    ])
  })

  it('selects the requested sync adapter without changing the rest of the pipeline', () => {
    expect(buildRefreshPipeline('resume')[0].packageScript).toBe('sync:ft:resume')
    expect(buildRefreshPipeline('full')[0].packageScript).toBe('sync:ft:full')
    expect(buildRefreshPipeline('embeddings')[0].packageScript).toBe('sync:ft')
  })

  it('fails preflight before any step when mirror remotes are missing', () => {
    const steps = buildRefreshPipeline()
    const preflight = preflightRefreshPipeline(steps, {
      commandExists: () => true,
      listRcloneRemotes: () => ['r2:'],
    })

    expect(preflight).toEqual({
      ok: false,
      messages: ['Missing rclone remote "gdrive:" for Google Drive media backups.'],
    })
  })

  it('runs every step through the package script interface after preflight passes', () => {
    const packageScripts: string[] = []

    runRefreshPipeline('full', {
      commandExists: () => true,
      listRcloneRemotes: () => ['r2:', 'gdrive:'],
      runStep: (step) => {
        packageScripts.push(step.packageScript)
        return 0
      },
    })

    expect(packageScripts).toEqual([
      'sync:ft:full',
      'data:mirror',
      'data:video-previews',
      'mirror:sync',
      'data:export',
      'data:embeddings',
      'data:validate',
      'build',
    ])
  })
})
