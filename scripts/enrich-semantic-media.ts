import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import {
  AutoProcessor,
  env,
  Florence2ForConditionalGeneration,
  load_image,
  type Tensor,
  type Florence2Processor,
} from '@huggingface/transformers'

import {
  readSemanticEnrichment,
  type MediaSemanticEnrichment,
  type SemanticEnrichmentFile,
} from './catalog/semantic-enrichment'
import type { Manifest, MediaItem, TweetDoc } from './catalog/model'

const runFile = promisify(execFile)
const projectRoot = process.cwd()
const outputDirectory = path.join(projectRoot, 'public/data')
const enrichmentPath = path.join(projectRoot, 'data/semantic-enrichment.json')
const mirrorAssetsRoot = path.join(projectRoot, '.data/media/assets')
const modelId = 'onnx-community/Florence-2-base-ft'

type Candidate = {
  gridId: string
  media: MediaItem
  sourceUrl: string
}

function parseLimit(args: string[]): number {
  if (args.includes('--all')) return Number.POSITIVE_INFINITY
  const token = args.find((arg) => arg.startsWith('--limit='))
  const value = Number(token?.slice('--limit='.length) ?? process.env.SEMANTIC_ENRICHMENT_LIMIT ?? 32)
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Semantic enrichment limit must be positive')
  return value
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function loadDocs(manifest: Manifest): Promise<TweetDoc[]> {
  const chunks = await Promise.all(
    manifest.files.docs.map((fileName) => readJson<TweetDoc[]>(path.join(outputDirectory, fileName))),
  )
  return chunks.flat()
}

function localMediaSource(url: string): string {
  try {
    const pathname = new URL(url).pathname
    if (pathname.startsWith('/pbs/') || pathname.startsWith('/vid/')) {
      return path.join(mirrorAssetsRoot, decodeURIComponent(pathname.slice(1)))
    }
  } catch {
    // The source may already be a local path.
  }
  return url
}

function candidateSource(media: MediaItem): string {
  return [media.fullUrl, media.posterUrl, media.altText, media.durationMs].filter(Boolean).join('|')
}

function candidates(docs: TweetDoc[], existing: SemanticEnrichmentFile): Candidate[] {
  return docs.flatMap((tweet) => tweet.media.flatMap((media, mediaIndex) => {
    const gridId = `${tweet.id}:${mediaIndex}`
    const sourceUrl = candidateSource(media)
    return existing.media[gridId]?.sourceUrl === sourceUrl ? [] : [{ gridId, media, sourceUrl }]
  }))
}

async function writeEnrichment(value: SemanticEnrichmentFile): Promise<void> {
  await mkdir(path.dirname(enrichmentPath), { recursive: true })
  const temporary = `${enrichmentPath}.next`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, enrichmentPath)
}

async function videoFrames(media: MediaItem): Promise<{ directory: string; paths: string[] }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'x-inspo-semantic-'))
  const input = localMediaSource(media.fullUrl)
  const durationSeconds = Math.max(1, (media.durationMs ?? 6_000) / 1_000)
  const paths: string[] = []

  for (const [index, fraction] of [0.2, 0.5, 0.8].entries()) {
    const framePath = path.join(directory, `frame-${index}.jpg`)
    try {
      await runFile('ffmpeg', [
        '-loglevel', 'error', '-ss', String(durationSeconds * fraction), '-i', input,
        '-frames:v', '1', '-vf', 'scale=min(1280\\,iw):-2', '-y', framePath,
      ])
      paths.push(framePath)
    } catch {
      // A poster caption still provides a useful fallback for an unreadable video.
    }
  }
  return { directory, paths }
}

async function main() {
  const limit = parseLimit(process.argv.slice(2))
  const manifest = await readJson<Manifest>(path.join(outputDirectory, 'manifest.json'))
  const docs = await loadDocs(manifest)
  const enrichment = await readSemanticEnrichment(enrichmentPath)
  const pending = candidates(docs, enrichment).slice(0, limit)
  if (pending.length === 0) {
    console.log('Semantic media enrichment is already current.')
    return
  }

  env.cacheDir = path.join(projectRoot, '.data/models')
  console.log(`Loading ${modelId} for ${pending.length} media assets...`)
  const [model, genericProcessor] = await Promise.all([
    Florence2ForConditionalGeneration.from_pretrained(modelId, { dtype: 'q4' }),
    AutoProcessor.from_pretrained(modelId),
  ])
  const processor = genericProcessor as Florence2Processor

  async function describe(imageSource: string, task: '<MORE_DETAILED_CAPTION>' | '<OCR>') {
    const image = await load_image(imageSource)
    const inputs = await processor(image, processor.construct_prompts(task))
    const generatedIds = await model.generate({ ...inputs, max_new_tokens: task === '<OCR>' ? 256 : 120 })
    const generated = processor.batch_decode(generatedIds as Tensor, { skip_special_tokens: false })[0] ?? ''
    const result = processor.post_process_generation(generated, task, image.size)[task]
    return typeof result === 'string' ? result.trim() : ''
  }

  for (const [index, candidate] of pending.entries()) {
    let temporaryDirectory: string | undefined
    try {
      const poster = localMediaSource(candidate.media.posterUrl ?? candidate.media.fullUrl)
      let sources = [poster]
      if (candidate.media.type !== 'photo') {
        const frames = await videoFrames(candidate.media)
        temporaryDirectory = frames.directory
        sources = [...sources, ...frames.paths]
      }
      const captions: string[] = []
      for (const source of [...new Set(sources)].slice(0, 4)) {
        const caption = await describe(source, '<MORE_DETAILED_CAPTION>')
        if (caption) captions.push(caption)
      }
      const ocrText = await describe(sources[0]!, '<OCR>')
      const entry: MediaSemanticEnrichment = {
        sourceUrl: candidate.sourceUrl,
        updatedAt: new Date().toISOString(),
        ...(captions.length > 0 ? { captions } : {}),
        ...(ocrText ? { ocrText } : {}),
      }
      enrichment.media[candidate.gridId] = entry
      await writeEnrichment(enrichment)
      console.log(`Enriched ${index + 1} / ${pending.length}: ${candidate.gridId}`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error'
      console.warn(`Could not enrich ${candidate.gridId}: ${reason}`)
    } finally {
      if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
    }
  }
}

main().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : 'Unknown semantic enrichment failure'
  console.error(`enrich-semantic-media failed: ${reason}`)
  process.exitCode = 1
})
