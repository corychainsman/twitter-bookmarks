import { describe, expect, it } from 'vitest'

import { resolveAppRoute } from '@/app/app-route'

describe('resolveAppRoute', () => {
  it('resolves local and GitHub Pages theme paths', () => {
    expect(resolveAppRoute('/themes', '/')).toBe('themes')
    expect(resolveAppRoute('/themes/', '/')).toBe('themes')
    expect(resolveAppRoute('/twitter-bookmarks/themes', '/twitter-bookmarks/')).toBe('themes')
  })

  it('keeps root and unknown paths on the bookmark browser', () => {
    expect(resolveAppRoute('/', '/')).toBe('bookmarks')
    expect(resolveAppRoute('/twitter-bookmarks/', '/twitter-bookmarks/')).toBe('bookmarks')
    expect(resolveAppRoute('/unknown', '/')).toBe('bookmarks')
  })
})
