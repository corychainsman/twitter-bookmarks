import { describe, expect, it } from 'vitest'

import type { SemanticQuery } from '@/features/bookmarks/embedding-artifacts'
import {
  resolveBookmarksQueryRequest,
  semanticTextQueryKey,
} from '@/features/bookmarks/query-request'
import { DEFAULT_QUERY_STATE } from '@/features/bookmarks/url-state'

const textSemanticQuery: SemanticQuery = {
  source: 'text',
  vector: [1, 0],
}

const imageSemanticQuery: SemanticQuery = {
  source: 'image',
  vector: [0, 1],
}

describe('semanticTextQueryKey', () => {
  it('keys trimmed semantic text queries', () => {
    expect(semanticTextQueryKey('  neural textures  ')).toBe('text:neural textures')
  })
})

describe('resolveBookmarksQueryRequest', () => {
  it('waits for a semantic query when text is present and the query key does not match', () => {
    const state = {
      ...DEFAULT_QUERY_STATE,
      q: ' woven interface ',
    }

    expect(
      resolveBookmarksQueryRequest({
        state,
        hasEmbeddingIndex: false,
        semanticQuery: textSemanticQuery,
        semanticQueryKey: 'text:old query',
        semanticImageQueryName: null,
      }),
    ).toEqual({ type: 'needs-semantic-query' })
  })

  it('resolves a matching text semantic query', () => {
    const state = {
      ...DEFAULT_QUERY_STATE,
      q: ' woven interface ',
    }

    expect(
      resolveBookmarksQueryRequest({
        state,
        hasEmbeddingIndex: true,
        semanticQuery: textSemanticQuery,
        semanticQueryKey: semanticTextQueryKey(state.q),
        semanticImageQueryName: null,
      }),
    ).toEqual({
      type: 'query',
      state,
      semanticQuery: textSemanticQuery,
    })
  })

  it('resolves an image semantic query when the text query is empty', () => {
    const state = {
      ...DEFAULT_QUERY_STATE,
      q: '   ',
    }

    expect(
      resolveBookmarksQueryRequest({
        state,
        hasEmbeddingIndex: true,
        semanticQuery: imageSemanticQuery,
        semanticQueryKey: null,
        semanticImageQueryName: 'reference.png',
      }),
    ).toEqual({
      type: 'query',
      state,
      semanticQuery: imageSemanticQuery,
    })
  })

  it('lets similarToGridId bypass semantic query readiness', () => {
    const state = {
      ...DEFAULT_QUERY_STATE,
      q: 'visual system',
      similarToGridId: 'tweet-source:0',
    }

    expect(
      resolveBookmarksQueryRequest({
        state,
        hasEmbeddingIndex: true,
        semanticQuery: null,
        semanticQueryKey: null,
        semanticImageQueryName: null,
      }),
    ).toEqual({
      type: 'query',
      state,
    })
  })

  it('requires embeddings after semantic query readiness is satisfied', () => {
    const state = {
      ...DEFAULT_QUERY_STATE,
      q: 'visual system',
    }

    expect(
      resolveBookmarksQueryRequest({
        state,
        hasEmbeddingIndex: false,
        semanticQuery: textSemanticQuery,
        semanticQueryKey: semanticTextQueryKey(state.q),
        semanticImageQueryName: null,
      }),
    ).toEqual({ type: 'needs-embeddings' })
  })

  it('requires embeddings for similarToGridId even without a semantic query', () => {
    const state = {
      ...DEFAULT_QUERY_STATE,
      similarToGridId: 'tweet-source:0',
    }

    expect(
      resolveBookmarksQueryRequest({
        state,
        hasEmbeddingIndex: false,
        semanticQuery: null,
        semanticQueryKey: null,
        semanticImageQueryName: null,
      }),
    ).toEqual({ type: 'needs-embeddings' })
  })

  it('requires embeddings for image semantic queries', () => {
    const state = {
      ...DEFAULT_QUERY_STATE,
      q: '',
    }

    expect(
      resolveBookmarksQueryRequest({
        state,
        hasEmbeddingIndex: false,
        semanticQuery: imageSemanticQuery,
        semanticQueryKey: null,
        semanticImageQueryName: 'reference.png',
      }),
    ).toEqual({ type: 'needs-embeddings' })
  })

  it('resolves non-semantic queries without a semantic query', () => {
    const state = {
      ...DEFAULT_QUERY_STATE,
      q: '',
    }

    expect(
      resolveBookmarksQueryRequest({
        state,
        hasEmbeddingIndex: false,
        semanticQuery: textSemanticQuery,
        semanticQueryKey: semanticTextQueryKey('ignored'),
        semanticImageQueryName: null,
      }),
    ).toEqual({
      type: 'query',
      state,
    })
  })
})
