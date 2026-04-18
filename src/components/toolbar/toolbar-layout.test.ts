import { describe, expect, it } from 'vitest'

import { resolveToolbarOverflow } from '@/components/toolbar/toolbar-layout'

describe('resolveToolbarOverflow', () => {
  it('keeps the full control rail visible when there is enough room', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 920,
        searchExpanded: false,
        hasFolderControl: true,
        isRandomSort: false,
      }),
    ).toEqual([])
  })

  it('collapses lower-priority controls as the search expands and width tightens', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 760,
        searchExpanded: true,
        hasFolderControl: true,
        isRandomSort: false,
      }),
    ).toEqual(['zoom', 'seed', 'count', 'direction'])
  })

  it('also collapses rerandomize when random sort would overflow', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 760,
        searchExpanded: true,
        hasFolderControl: true,
        isRandomSort: true,
      }),
    ).toEqual(['zoom', 'seed', 'count', 'rerandomize', 'direction'])
  })

  it('falls back to the compact essentials on very narrow widths', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 560,
        searchExpanded: true,
        hasFolderControl: true,
        isRandomSort: false,
      }),
    ).toEqual(['zoom', 'seed', 'count', 'direction', 'folder'])
  })

  it('collapses the mode switch into the overflow menu when space gets tight enough', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 400,
        searchExpanded: true,
        hasFolderControl: true,
        isRandomSort: false,
      }),
    ).toEqual(['zoom', 'seed', 'count', 'direction', 'folder', 'immersive', 'mode'])
  })

  it('keeps shrinking to the ellipsis menu instead of clipping on extremely narrow widths', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 300,
        searchExpanded: true,
        hasFolderControl: true,
        isRandomSort: false,
      }),
    ).toEqual(['zoom', 'seed', 'count', 'direction', 'folder', 'immersive', 'mode', 'sort'])
  })

  it('does not reserve overflow width for folders when none exist in the dataset', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 760,
        searchExpanded: true,
        hasFolderControl: false,
        isRandomSort: false,
      }),
    ).toEqual(['zoom', 'seed'])
  })
})
