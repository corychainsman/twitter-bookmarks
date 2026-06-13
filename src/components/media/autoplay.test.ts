import { describe, expect, it } from 'vitest'

import { measureAutoplayCandidate } from '@/components/media/autoplay'

describe('autoplay band', () => {
  it('treats the viewport plus prewarm margin as the active autoplay band', () => {
    expect(
      measureAutoplayCandidate('inside', {
        isIntersecting: true,
        intersectionRatio: 0.6,
        top: -120,
        height: 200,
        viewportHeight: 900,
      }),
    ).toEqual({
      id: 'inside',
      isActiveBand: true,
    })

    expect(
      measureAutoplayCandidate('outside', {
        isIntersecting: true,
        intersectionRatio: 0.6,
        top: -400,
        height: 120,
        viewportHeight: 900,
      }),
    ).toEqual({
      id: 'outside',
      isActiveBand: false,
    })
  })

  it('excludes tiles below the visibility threshold', () => {
    expect(
      measureAutoplayCandidate('barely-visible', {
        isIntersecting: true,
        intersectionRatio: 0.1,
        top: 100,
        height: 200,
        viewportHeight: 900,
      }).isActiveBand,
    ).toBe(false)
  })
})
