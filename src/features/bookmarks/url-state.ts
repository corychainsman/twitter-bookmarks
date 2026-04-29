import type { QueryState } from '@/features/bookmarks/model'

export const DEFAULT_QUERY_STATE: QueryState = {
  q: '',
  sort: 'bookmarked',
  dir: 'desc',
  mode: 'all',
  immersive: true,
  preferMotion: false,
  zoom: -2,
  keepSeed: false,
}

export type ParseQueryStateOptions = {
  generateSeed: () => string
}

export function createQuerySeed(): string {
  return globalThis.crypto?.randomUUID?.().slice(0, 8) ?? `${Date.now().toString(36)}`
}

function parseBooleanFlag(value: string | null, defaultValue = false): boolean {
  if (value === '1') {
    return true
  }

  if (value === '0') {
    return false
  }

  return defaultValue
}

function parseSort(value: string | null): QueryState['sort'] {
  if (value === 'bookmarked' || value === 'posted' || value === 'random') {
    return value
  }

  return DEFAULT_QUERY_STATE.sort
}

function parseDirection(value: string | null): QueryState['dir'] {
  return value === 'asc' || value === 'desc' ? value : DEFAULT_QUERY_STATE.dir
}

function parseMode(value: string | null): QueryState['mode'] {
  return value === 'one' || value === 'all' ? value : DEFAULT_QUERY_STATE.mode
}

function parseZoom(value: string | null): number {
  if (!value) {
    return DEFAULT_QUERY_STATE.zoom
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : DEFAULT_QUERY_STATE.zoom
}

export function parseQueryState(
  params: URLSearchParams,
  options: ParseQueryStateOptions,
): QueryState {
  const sort = parseSort(params.get('sort'))
  const keepSeed = parseBooleanFlag(params.get('keepSeed'), DEFAULT_QUERY_STATE.keepSeed)
  const urlSeed = params.get('seed') ?? undefined
  const similarToGridId = params.get('similar') ?? undefined

  let seed = keepSeed ? urlSeed : undefined
  if (sort === 'random') {
    if (keepSeed && !seed) {
      seed = options.generateSeed()
    }
    if (!keepSeed) {
      seed = options.generateSeed()
    }
  }

  return {
    q: params.get('q') ?? DEFAULT_QUERY_STATE.q,
    sort,
    dir: parseDirection(params.get('dir')),
    mode: parseMode(params.get('mode')),
    immersive: parseBooleanFlag(params.get('immersive'), DEFAULT_QUERY_STATE.immersive),
    preferMotion: parseBooleanFlag(params.get('preferMotion'), DEFAULT_QUERY_STATE.preferMotion),
    similarToGridId,
    zoom: parseZoom(params.get('zoom')),
    keepSeed,
    seed,
  }
}

export function serializeQueryState(state: QueryState): URLSearchParams {
  const params = new URLSearchParams()

  if (state.q !== DEFAULT_QUERY_STATE.q) {
    params.set('q', state.q)
  }
  if (state.sort !== DEFAULT_QUERY_STATE.sort) {
    params.set('sort', state.sort)
  }
  if (state.dir !== DEFAULT_QUERY_STATE.dir) {
    params.set('dir', state.dir)
  }
  if (state.mode !== DEFAULT_QUERY_STATE.mode) {
    params.set('mode', state.mode)
  }
  if (state.immersive !== DEFAULT_QUERY_STATE.immersive) {
    params.set('immersive', state.immersive ? '1' : '0')
  }
  if (state.preferMotion !== DEFAULT_QUERY_STATE.preferMotion) {
    params.set('preferMotion', state.preferMotion ? '1' : '0')
  }
  if (state.similarToGridId) {
    params.set('similar', state.similarToGridId)
  }
  if (state.zoom !== DEFAULT_QUERY_STATE.zoom) {
    params.set('zoom', String(state.zoom))
  }
  if (state.keepSeed) {
    params.set('keepSeed', '1')
    if (state.seed) {
      params.set('seed', state.seed)
    }
  }

  return params
}

export function applyQueryStatePatch(
  current: QueryState,
  patch: Partial<QueryState>,
  options: ParseQueryStateOptions,
): QueryState {
  const next = { ...current, ...patch }
  const enteringRandom = current.sort !== 'random' && next.sort === 'random'
  const toggledKeepSeedOn = current.keepSeed === false && next.keepSeed === true
  const toggledKeepSeedOff = current.keepSeed === true && next.keepSeed === false

  if (next.sort === 'random') {
    if ((enteringRandom || toggledKeepSeedOn) && !next.seed) {
      next.seed = options.generateSeed()
    }

    if (toggledKeepSeedOff || (!next.keepSeed && enteringRandom)) {
      next.seed = options.generateSeed()
    }
  } else if (!next.keepSeed) {
    next.seed = undefined
  }

  return next
}

export function rerandomizeQueryState(
  current: QueryState,
  options: ParseQueryStateOptions,
): QueryState {
  if (current.sort !== 'random') {
    return applyQueryStatePatch(current, { sort: 'random' }, options)
  }

  return {
    ...current,
    seed: options.generateSeed(),
  }
}
