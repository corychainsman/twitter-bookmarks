import { describe, expect, it } from 'vitest'

import {
  resolveToolbarOverflow,
  shouldAutoExpandToolbarSearch,
} from '@/components/toolbar/toolbar-layout'

describe('resolveToolbarOverflow', () => {
  it('keeps the full control rail visible when there is enough room', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 920,
        searchExpanded: false,
        isRandomSort: false,
        hasSemanticSource: false,
      }),
    ).toEqual([])
  })

  it('keeps the expanded search comfortable by moving secondary controls into more', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 820,
        searchExpanded: true,
        isRandomSort: false,
        hasSemanticSource: false,
      }),
    ).toEqual(['zoom', 'direction'])
  })

  it('also collapses random controls when expanded search needs room', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 760,
        searchExpanded: true,
        isRandomSort: true,
        hasSemanticSource: false,
      }),
    ).toEqual(['zoom', 'seed', 'rerandomize', 'direction'])
  })

  it('falls back to the compact essentials on very narrow widths', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 560,
        searchExpanded: true,
        isRandomSort: false,
        hasSemanticSource: false,
      }),
    ).toEqual([
      'zoom',
      'direction',
      'immersive',
      'mode',
      'imageSearch',
      'sort',
    ])
  })

  it('collapses the mode switch into the overflow menu when space gets tight enough', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 610,
        searchExpanded: true,
        isRandomSort: false,
        hasSemanticSource: false,
      }),
    ).toEqual(['zoom', 'direction', 'immersive', 'mode', 'imageSearch'])
  })

  it('keeps shrinking to the ellipsis menu instead of clipping on extremely narrow widths', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 300,
        searchExpanded: true,
        isRandomSort: false,
        hasSemanticSource: false,
      }),
    ).toEqual([
      'zoom',
      'direction',
      'immersive',
      'mode',
      'imageSearch',
      'sort',
    ])
  })

  it('auto-expands search when sort can remain visible after secondary controls move', () => {
    expect(
      shouldAutoExpandToolbarSearch({
        containerWidth: 820,
        isRandomSort: false,
        hasSemanticSource: false,
      }),
    ).toBe(true)

    expect(
      shouldAutoExpandToolbarSearch({
        containerWidth: 560,
        isRandomSort: false,
        hasSemanticSource: false,
      }),
    ).toBe(false)
  })

  it('can auto-expand search in random sort by moving random controls into more', () => {
    expect(
      shouldAutoExpandToolbarSearch({
        containerWidth: 760,
        isRandomSort: true,
        hasSemanticSource: false,
      }),
    ).toBe(true)
  })
})
