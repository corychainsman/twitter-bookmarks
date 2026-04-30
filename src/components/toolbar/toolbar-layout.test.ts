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

  it('keeps the streamlined control rail visible as the search expands', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 820,
        searchExpanded: true,
        isRandomSort: false,
        hasSemanticSource: false,
      }),
    ).toEqual([])
  })

  it('also collapses rerandomize when random sort would overflow', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 760,
        searchExpanded: true,
        isRandomSort: true,
        hasSemanticSource: false,
      }),
    ).toEqual(['zoom', 'seed'])
  })

  it('falls back to the compact essentials on very narrow widths', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 560,
        searchExpanded: true,
        isRandomSort: false,
        hasSemanticSource: false,
      }),
    ).toEqual(['zoom', 'direction', 'immersive'])
  })

  it('collapses the mode switch into the overflow menu when space gets tight enough', () => {
    expect(
      resolveToolbarOverflow({
        containerWidth: 400,
        searchExpanded: true,
        isRandomSort: false,
        hasSemanticSource: false,
      }),
    ).toEqual(['zoom', 'direction', 'immersive', 'mode', 'imageSearch', 'sort'])
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

  it('auto-expands search only when the expanded toolbar still fits', () => {
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

  it('keeps search compact when random controls need the available space', () => {
    expect(
      shouldAutoExpandToolbarSearch({
        containerWidth: 760,
        isRandomSort: true,
        hasSemanticSource: false,
      }),
    ).toBe(false)
  })
})
