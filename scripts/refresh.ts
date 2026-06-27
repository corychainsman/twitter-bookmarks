import { type RefreshPipelineMode, runRefreshPipeline } from './refresh-pipeline'

function parseMode(argv: string[]): RefreshPipelineMode {
  let mode: RefreshPipelineMode = 'default'

  for (const arg of argv) {
    if (arg === '--resume') {
      mode = 'resume'
      continue
    }

    if (arg === '--full') {
      mode = 'full'
      continue
    }

    if (arg === '--embeddings') {
      mode = 'embeddings'
      continue
    }

    if (arg === '--help' || arg === '-h') {
      console.log('Usage: bun run scripts/refresh.ts [--resume|--full|--embeddings]')
      process.exit(0)
    }

    throw new Error(`Unknown refresh option: ${arg}`)
  }

  return mode
}

try {
  runRefreshPipeline(parseMode(process.argv.slice(2)))
} catch (error) {
  const reason = error instanceof Error ? error.message : 'Unknown refresh failure'
  console.error(`refresh failed: ${reason}`)
  process.exitCode = 1
}
