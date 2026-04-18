import { describe, expect, it } from 'vitest'

import {
  AutoplayCoordinator,
  measureAutoplayCandidate,
  selectAutoplayIds,
} from '@/components/media/autoplay'

describe('autoplay selection', () => {
  it('caps concurrent autoplay and prefers items nearest the viewport center', () => {
    expect(
      selectAutoplayIds([
        { id: 'far', isActiveBand: true, distanceToViewportCenter: 420 },
        { id: 'near-2', isActiveBand: true, distanceToViewportCenter: 80 },
        { id: 'near-1', isActiveBand: true, distanceToViewportCenter: 20 },
      ]),
    ).toEqual(['near-1', 'near-2'])
  })

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
      distanceToViewportCenter: 470,
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
      distanceToViewportCenter: 790,
    })
  })
})

describe('AutoplayCoordinator', () => {
  it('updates subscribers when priority changes', () => {
    const coordinator = new AutoplayCoordinator(2)
    const states = new Map<string, boolean>()

    const unsubs = ['a', 'b', 'c'].map((id) =>
      coordinator.subscribe(id, (shouldPlay) => {
        states.set(id, shouldPlay)
      }),
    )

    coordinator.update({ id: 'a', isActiveBand: true, distanceToViewportCenter: 200 })
    coordinator.update({ id: 'b', isActiveBand: true, distanceToViewportCenter: 40 })
    coordinator.update({ id: 'c', isActiveBand: true, distanceToViewportCenter: 120 })

    expect(states).toEqual(
      new Map([
        ['a', false],
        ['b', true],
        ['c', true],
      ]),
    )

    coordinator.update({ id: 'a', isActiveBand: true, distanceToViewportCenter: 10 })

    expect(states).toEqual(
      new Map([
        ['a', true],
        ['b', true],
        ['c', false],
      ]),
    )

    for (const unsub of unsubs) {
      unsub()
    }
  })
})
