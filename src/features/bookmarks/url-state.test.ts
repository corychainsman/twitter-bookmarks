import { describe, expect, it } from 'vitest'

import {
  DEFAULT_QUERY_STATE,
  parseQueryState,
  serializeQueryState,
} from '@/features/bookmarks/url-state'

describe('query url state', () => {
  it('uses the default bookmark view without emitting query params', () => {
    const parsed = parseQueryState(new URLSearchParams(), {
      generateSeed: () => 'seed-1234',
    })

    expect(parsed).toEqual({
      ...DEFAULT_QUERY_STATE,
      seed: undefined,
    })

    expect(serializeQueryState(parsed).toString()).toBe('')
  })

  it('hydrates pinned random mode with a generated seed and omits default params on serialization', () => {
    const parsed = parseQueryState(
      new URLSearchParams('q=compiler&sort=random&keepSeed=1'),
      {
        generateSeed: () => 'seed-1234',
      },
    )

    expect(parsed).toEqual({
      ...DEFAULT_QUERY_STATE,
      q: 'compiler',
      sort: 'random',
      keepSeed: true,
      seed: 'seed-1234',
    })

    const serialized = serializeQueryState(parsed)

    expect(serialized.toString()).toBe(
      new URLSearchParams({
        q: 'compiler',
        sort: 'random',
        keepSeed: '1',
        seed: 'seed-1234',
      }).toString(),
    )
  })

  it('rounds legacy fractional zoom params to integer steps', () => {
    const parsed = parseQueryState(
      new URLSearchParams('zoom=1.7'),
      {
        generateSeed: () => 'seed-1234',
      },
    )

    expect(parsed.zoom).toBe(2)
    expect(serializeQueryState(parsed).toString()).toBe(
      new URLSearchParams({
        zoom: '2',
      }).toString(),
    )
  })

  it('round-trips a folder filter through the query string', () => {
    const parsed = parseQueryState(
      new URLSearchParams('folder=Research%20Trail'),
      {
        generateSeed: () => 'seed-1234',
      },
    )

    expect(parsed.folder).toBe('Research Trail')
    expect(serializeQueryState(parsed).toString()).toBe(
      new URLSearchParams({
        folder: 'Research Trail',
      }).toString(),
    )
  })

  it('round-trips immersive mode through the query string', () => {
    const parsed = parseQueryState(
      new URLSearchParams('immersive=0'),
      {
        generateSeed: () => 'seed-1234',
      },
    )

    expect(parsed.immersive).toBe(false)
    expect(serializeQueryState(parsed).toString()).toBe(
      new URLSearchParams({
        immersive: '0',
      }).toString(),
    )
  })

  it('round-trips all-images mode off through the query string', () => {
    const parsed = parseQueryState(
      new URLSearchParams('mode=one'),
      {
        generateSeed: () => 'seed-1234',
      },
    )

    expect(parsed.mode).toBe('one')
    expect(serializeQueryState(parsed).toString()).toBe(
      new URLSearchParams({
        mode: 'one',
      }).toString(),
    )
  })
})
