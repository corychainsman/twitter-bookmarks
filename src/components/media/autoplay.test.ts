import { describe, expect, it } from 'vitest'

import { measureAutoplayCandidate } from '@/components/media/autoplay'

describe('autoplay band', () => {
  it('starts playback when at least ten percent of a tile is visible', () => {
    expect(
      measureAutoplayCandidate('inside', {
        isIntersecting: true,
        intersectionRatio: 0.1,
      }),
    ).toEqual({
      id: 'inside',
      isActiveBand: true,
    })

    expect(
      measureAutoplayCandidate('outside', {
        isIntersecting: true,
        intersectionRatio: 0.09,
      }),
    ).toEqual({
      id: 'outside',
      isActiveBand: false,
    })
  })

  it('keeps an active preview playing until it is fully outside the viewport', () => {
    expect(
      measureAutoplayCandidate('still-visible', {
        isIntersecting: true,
        intersectionRatio: 0.01,
        wasActive: true,
      }).isActiveBand,
    ).toBe(true)

    expect(
      measureAutoplayCandidate('outside', {
        isIntersecting: false,
        intersectionRatio: 0,
        wasActive: true,
      }).isActiveBand,
    ).toBe(false)
  })
})
